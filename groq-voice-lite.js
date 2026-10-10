(()=>{
  // Small cloud transcription path: no bundled ML model or new Android dependencies.
  const KEY="xy.groqVoice.v1";
  const DEFAULT={base:"https://api.groq.com/openai/v1",apiKey:"",model:"whisper-large-v3-turbo",language:"zh",autoSend:true};
  const options=()=>({...DEFAULT,...store.get(KEY,{})});
  let recorder=null,stream=null,parts=[],started=0,busy=false;
  let activeAudio=null,activeUrl="";
  const toast=(message,isError=false)=>{
    document.querySelector(".xy-groq-toast")?.remove();
    const el=document.createElement("div");
    el.className="xy-groq-toast"+(isError?" error":"");
    el.textContent=String(message||"");
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),5000);
  };
  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error("本机没有音频存储功能"));return}
      const request=indexedDB.open("xy-voice-cache",1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("audio"))request.result.createObjectStore("audio")};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("音频存储失败"));
    });
  }
  async function archive(blob){
    const db=await openDb();
    const id="v_"+Date.now()+"_"+Math.random().toString(36).slice(2,9);
    return new Promise((resolve,reject)=>{
      const tr=db.transaction("audio","readwrite");tr.objectStore("audio").put(blob,id);
      tr.oncomplete=()=>{db.close();resolve(id)};
      tr.onerror=()=>{db.close();reject(tr.error||new Error("无法保存录音"))};
    });
  }
  async function retrieve(key){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tr=db.transaction("audio","readonly"),req=tr.objectStore("audio").get(key);
      req.onsuccess=()=>{db.close();resolve(req.result)};
      req.onerror=()=>{db.close();reject(req.error||new Error("录音读取失败"))};
    });
  }
  document.addEventListener("click",async e=>{
    const play=e.target.closest?.("[data-audio-key]");
    if(!play)return;
    const key=play.dataset.audioKey;
    try{
      if(activeAudio){activeAudio.pause();activeAudio=null;URL.revokeObjectURL(activeUrl);activeUrl=""}
      const blob=await retrieve(key);
      if(!blob){toast("这段录音只存放在原手机中，当前设备没有音频文件",true);return}
      const url=URL.createObjectURL(blob),audio=new Audio(url);
      activeUrl=url;activeAudio=audio;
      const cleanup=()=>{if(activeAudio===audio){activeAudio=null;activeUrl=""}URL.revokeObjectURL(url)};
      audio.onended=cleanup;audio.onerror=()=>{cleanup();toast("语音播放失败",true)};
      await audio.play();
    }catch(error){toast("播放失败："+String(error?.message||error),true)}
  });
  async function transcribe(blob){
    const config=options();
    if(!config.apiKey.trim())throw new Error("先到侧栏「语音」填写 Groq API Key");
    const base=String(config.base||DEFAULT.base).trim().replace(/\/$/,"").replace(/\/audio\/transcriptions$/,"");
    if(!/^https:\/\//.test(base))throw new Error("语音转写地址必须使用 HTTPS");
    const mime=String(blob.type||"");
    const ext=/mp4|m4a|aac/i.test(mime)?"m4a":/wav/i.test(mime)?"wav":/ogg/i.test(mime)?"ogg":"webm";
    const form=new FormData();
    form.append("file",blob,"voice-"+Date.now()+"."+ext);
    form.append("model",config.model||DEFAULT.model);
    if(config.language)form.append("language",config.language);
    const res=await fetch(base+"/audio/transcriptions",{
      method:"POST",headers:{Authorization:"Bearer "+config.apiKey.trim(),Accept:"application/json"},body:form
    });
    const raw=await res.text();
    let data;try{data=JSON.parse(raw)}catch{throw new Error("转写接口返回了非 JSON 内容（HTTP "+res.status+"）")}
    if(!res.ok)throw new Error("Groq HTTP "+res.status+"："+String(data?.error?.message||raw).slice(0,130));
    const transcript=String(data.text||data.transcript||"").trim();
    if(!transcript)throw new Error("识别没有返回文字，重新靠近麦克风说话");
    return transcript;
  }
  function updateButton(){
    const el=document.querySelector("#xyVoiceRecorder");if(!el)return;
    el.disabled=busy;
    el.classList.toggle("recording",!!recorder);
    el.textContent=recorder?"■":"🎙";
    el.title=recorder?"停止录音并转成文字":busy?"识别中…":"录制语音条";
    el.setAttribute("aria-label",el.title);
  }
  function stopStream(){
    try{stream?.getTracks().forEach(track=>track.stop())}catch{}
    stream=null;
  }
  async function sendVoice(blob,seconds){
    busy=true;updateButton();toast("正在用 Groq 识别语音…");
    let audioKey="";
    try{audioKey=await archive(blob)}
    catch(error){toast("录音能转文字，但本机保存失败："+String(error?.message||error),true)}
    try{
      const text=await transcribe(blob);
      const item={kind:"audio",name:"语音 "+seconds+" 秒",duration:seconds,size:blob.size,type:blob.type,
        transcript:text,audioKey,transcriptionError:""};
      if(!window.xyAttachments?.restore)throw new Error("附件发送模块还没有加载完成");
      window.xyAttachments.restore([item]);
      if(options().autoSend){
        if(window.xySendQueued){
          await window.xySendQueued();
          document.querySelector("#xyReplyNow")?.click();
        }else await send();
        toast("已识别并发送给角色");
      }else toast("已经识别出来，点发送即可");
    }catch(error){
      if(audioKey)window.xyAttachments?.restore?.([{kind:"audio",name:"未转写语音 "+seconds+" 秒",duration:seconds,
        type:blob.type,size:blob.size,audioKey,transcript:"",transcriptionError:String(error?.message||error)}]);
      toast("语音未送给角色："+String(error?.message||error),true);
    }finally{busy=false;updateButton()}
  }
  function finish(){
    const blob=new Blob(parts,{type:recorder?.mimeType||parts[0]?.type||"audio/webm"});
    const duration=Math.max(1,Math.ceil((Date.now()-started)/1000));
    parts=[];recorder=null;stopStream();updateButton();
    if(blob.size<600){toast("录音太短，没有录到内容",true);return}
    sendVoice(blob,duration);
  }
  async function startRecording(){
    if(busy||recorder)return;
    if(!options().apiKey.trim()){toast("请先在语音设置填写 Groq API Key",true);openPanel("voice");return}
    if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){toast("当前浏览器没有可用的录音能力",true);return}
    busy=true;updateButton();
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(m=>MediaRecorder.isTypeSupported?.(m));
      parts=[];recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data)};
      recorder.onstop=finish;recorder.onerror=()=>{toast("录音发生错误",true);recorder=null;stopStream();updateButton()};
      started=Date.now();recorder.start(250);
    }catch(error){toast("麦克风启动失败："+String(error?.message||error),true);stopStream();recorder=null}
    finally{busy=false;updateButton()}
  }
  function toggleRecording(){
    if(recorder){busy=true;recorder.stop();stopStream();return}
    startRecording();
  }
  const style=document.createElement("style");
  style.textContent=[
    "#xyVoiceRecorder{border:0;background:transparent;color:#54685c;font-size:19px;min-width:35px;height:38px;border-radius:12px;cursor:pointer;flex-shrink:0}",
    "#xyVoiceRecorder.recording{background:#a44242;color:#fff}",
    "#xyVoiceRecorder:disabled{opacity:.4}",
    ".xy-groq-toast{position:fixed;z-index:200;left:50%;bottom:112px;transform:translateX(-50%);background:#345345;color:#fff;border-radius:14px;padding:12px 16px;font-size:12px;max-width:90vw;box-shadow:0 6px 28px #0002}",
    ".xy-groq-toast.error{background:#873e3f}",
    ".xy-voice-note{display:inline-flex;flex-direction:column;gap:7px;max-width:100%}",
    ".xy-voice-note-play{display:inline-block;padding:7px 13px;border:1px solid #becabf;border-radius:99px;background:rgba(255,255,255,.52);color:#385542;cursor:pointer;font:inherit}",
    ".xy-voice-note-play.disabled{opacity:.6}",
    ".xy-voice-note-transcript{font-size:12px;opacity:.76;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".xy-groq-config label{display:block;margin:14px 0 5px;font-size:12px;color:#657469}",
    ".xy-groq-config input{width:100%;border:1px solid #c9d1c9;background:#fff;border-radius:9px;padding:10px;font:inherit;box-sizing:border-box}",
    ".xy-groq-config input[type=checkbox]{width:auto;vertical-align:middle;margin-right:8px}",
    ".xy-groq-config small{display:block;line-height:1.65;margin:9px 0;color:#7c897e}"
  ].join("\n");
  document.head.appendChild(style);
  const composer=document.querySelector(".composer");
  const sendBtn=composer?.querySelector("#sendBtn");
  if(composer&&sendBtn&&!document.querySelector("#xyVoiceRecorder")){
    const button=document.createElement("button");button.type="button";button.id="xyVoiceRecorder";
    composer.insertBefore(button,sendBtn);
    button.onclick=toggleRecording;updateButton();
  }
  const nav=document.querySelector(".sidebar-bottom");
  if(nav&&!nav.querySelector('[data-panel="voice"]')){
    const b=document.createElement("button");b.type="button";b.className="nav-btn";b.dataset.panel="voice";
    b.textContent="♫ 语音";
    nav.insertBefore(b,nav.querySelector('[data-panel="settings"]'));
    b.addEventListener("click",()=>openPanel("voice"));
  }
  const previousOpen=openPanel;
  function voicePanel(){
    previousOpen("settings");
    document.querySelector("#panelEyebrow").textContent="VOICE";
    document.querySelector("#panelTitle").textContent="语音转写";
    const cfg=options(),root=document.querySelector("#panelBody");
    root.innerHTML="";
    const form=document.createElement("div");form.className="xy-groq-config";root.appendChild(form);
    const p=document.createElement("p");p.textContent="使用 GroqCloud 免费层的 Whisper 转写，不在 APK 内置大模型。聊天仍使用原来的露娜或当前角色接口。";form.appendChild(p);
    function field(text,id,value,type="text"){
      const label=document.createElement("label");label.htmlFor=id;label.textContent=text;form.appendChild(label);
      const input=document.createElement("input");input.id=id;input.type=type;input.value=value;form.appendChild(input);
    }
    field("Groq API Key（仅保存在本机）","xyGroqKey",cfg.apiKey,"password");
    field("转写 Base URL","xyGroqBase",cfg.base);
    field("转写模型","xyGroqModel",cfg.model);
    field("语言（普通话 zh）","xyGroqLang",cfg.language);
    const check=document.createElement("label");form.appendChild(check);
    const auto=document.createElement("input");auto.type="checkbox";auto.id="xyGroqAuto";auto.checked=cfg.autoSend;check.appendChild(auto);
    check.appendChild(document.createTextNode("识别成功后自动发送语音条"));
    const saveBtn=document.createElement("button");saveBtn.className="panel-action";saveBtn.type="button";saveBtn.textContent="保存语音设置";form.appendChild(saveBtn);
    saveBtn.onclick=()=>{
      store.set(KEY,{apiKey:form.querySelector("#xyGroqKey").value.trim(),
        base:form.querySelector("#xyGroqBase").value.trim()||DEFAULT.base,
        model:form.querySelector("#xyGroqModel").value.trim()||DEFAULT.model,
        language:form.querySelector("#xyGroqLang").value.trim(),
        autoSend:!!form.querySelector("#xyGroqAuto").checked});
      toast("语音设置已保存");voicePanel();
    };
    const notice=document.createElement("small");form.appendChild(notice);
    notice.textContent="Groq 免费层有速率与用量限制；录音会传至 Groq 识别。旧语音不受影响。录音文件只存在本设备 IndexedDB，备份只保存转写和索引。";
    const link=document.createElement("a");link.href="https://console.groq.com/keys";link.target="_blank";link.rel="noopener noreferrer";
    link.textContent="打开 GroqCloud 创建 Key";form.appendChild(link);
  }
  openPanel=function(type){return type==="voice"?voicePanel():previousOpen(type)};
})();
