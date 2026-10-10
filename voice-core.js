(()=>{
  const DEFAULTS={
    voiceMode:"system",
    systemEnginePackage:"",
    systemVoiceURI:"",
    voiceMcpId:"",
    voiceId:"",
    voiceModel:"",
    autoSpeak:false,
    sttBase:"",
    sttKey:"",
    sttModel:"whisper-1",
    sttLanguage:"zh",
    sendAfterTranscript:true
  };
  const savedVoiceSettings=store.get("xy.voice",{});
  const legacyVoiceSettings=!savedVoiceSettings?.voiceMode;
  let voiceSettings={...DEFAULTS,...savedVoiceSettings};
  if(legacyVoiceSettings){
    voiceSettings.voiceMode="system";
    voiceSettings.voiceMcpId="";
    voiceSettings.voiceId="";
    voiceSettings.voiceModel="";
    store.set("xy.voice",voiceSettings);
  }
  let recorder=null,recordStream=null,recordChunks=[],recordTimer=null,recordStarting=false,voiceBusy=false,nativeRecording=false,nativeRecognizing=false;
  let nativeRecognitionResolve=null,nativeRecognitionReject=null,nativeRecognitionTimer=null,nativeRecognitionFallbackTried=false,nativeRecognitionAllowActivityFallback=true;
  let recognitionObserver=null;
  function notifyRecognition(stage,detail=""){
    try{recognitionObserver?.({stage,detail:String(detail||"").slice(0,200)})}catch{}
  }
  let composerActionState="idle",voiceNoteStartedAt=0;
  let activeAudio=null,activeMessage=null;
  const busyMessages=new Set();

  const persist=()=>store.set("xy.voice",voiceSettings);
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0]||{};
  const voiceServers=()=>mcps.filter(server=>server.enabled&&server.tools?.some(tool=>tool.name==="text_to_speech"));
  const resolveVoiceServer=()=>voiceSettings.voiceMcpId?voiceServers().find(x=>x.id===voiceSettings.voiceMcpId)||null:null;
  const currentChat=()=>{try{return chat()}catch{return null}};
  const nativeVoiceBridge=()=>window.AevrenVoiceNative&&typeof window.AevrenVoiceNative.startRecording==="function"?window.AevrenVoiceNative:null;
  function parseNativeVoiceResult(raw){
    try{return typeof raw==="string"?JSON.parse(raw):raw||{}}catch{return {ok:false,error:String(raw||"native_voice_error")}}
  }
  function nativeVoiceList(){
    const bridge=nativeVoiceBridge();if(!bridge?.listVoices)return [];
    const result=parseNativeVoiceResult(bridge.listVoices());
    return Array.isArray(result)?result:[];
  }
  function nativeEngineList(){
    const bridge=nativeVoiceBridge();if(!bridge?.listEngines)return [];
    const result=parseNativeVoiceResult(bridge.listEngines());
    return Array.isArray(result)?result:[];
  }
  function switchNativeEngine(packageName){
    const bridge=nativeVoiceBridge();if(!bridge?.switchEngine)return {ok:false,error:"native_tts_engine_unavailable"};
    return parseNativeVoiceResult(bridge.switchEngine(String(packageName||"")));
  }
  function base64ToBlob(value,mime){
    const bin=atob(String(value||"")),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new Blob([bytes],{type:mime||"audio/mp4"});
  }
  function startNativeCapture(){
    const bridge=nativeVoiceBridge();if(!bridge)return {ok:false,error:"native_voice_unavailable"};
    return parseNativeVoiceResult(bridge.startRecording());
  }
  function stopNativeCapture(){
    const bridge=nativeVoiceBridge();if(!bridge)return {ok:false,error:"native_voice_unavailable"};
    const result=parseNativeVoiceResult(bridge.stopRecording());
    if(result.ok&&result.base64)result.blob=base64ToBlob(result.base64,result.mime||"audio/mp4");
    return result;
  }
  function hasNativeRecognition(){
    const bridge=nativeVoiceBridge();return Boolean(bridge&&typeof bridge.startRecognition==="function");
  }
  function canStartNativeRecognitionActivity(){
    const bridge=nativeVoiceBridge();
    if(!bridge||typeof bridge.startRecognitionActivity!=="function"||typeof bridge.canStartRecognitionActivity!=="function")return false;
    try{return Boolean(bridge.canStartRecognitionActivity(voiceSettings.sttLanguage||"zh-CN"))}catch{return false}
  }
  function startNativeRecognitionActivity(){
    const bridge=nativeVoiceBridge();
    if(!canStartNativeRecognitionActivity())return {ok:false,error:"speech_activity_unavailable"};
    return parseNativeVoiceResult(bridge.startRecognitionActivity(voiceSettings.sttLanguage||"zh-CN"));
  }
  function normalizeSpeechError(value){
    const code=String(value||"speech_error");
    if(/No Activity found to handle Intent|speech_activity_unavailable/i.test(code))return "speech_activity_unavailable";
    if(code==="speech_error_7"||code==="speech_error_6")return "speech_no_match";
    if(code==="speech_error_9"||/permission/i.test(code))return "speech_permission";
    if(code==="speech_error_8")return "speech_busy";
    if(code==="speech_error_12"||code==="speech_error_13")return "speech_language";
    if(code==="speech_error_1"||code==="speech_error_2"||code==="speech_error_4"||code==="speech_error_11")return "speech_service";
    return code;
  }
  function recognizeNativeOnce(options={}){
    const bridge=nativeVoiceBridge();
    if(!bridge||typeof bridge.startRecognition!=="function")return Promise.reject(new Error("native_speech_unavailable"));
    if(nativeRecognizing)return Promise.reject(new Error("already_listening"));
    nativeRecognizing=true;nativeRecognitionFallbackTried=false;
    nativeRecognitionAllowActivityFallback=options?.allowActivityFallback!==false;
    notifyRecognition("starting");
    return new Promise((resolve,reject)=>{
      nativeRecognitionResolve=resolve;nativeRecognitionReject=reject;
      clearTimeout(nativeRecognitionTimer);
      nativeRecognitionTimer=setTimeout(()=>{
        if(!nativeRecognizing)return;
        try{bridge.stopRecognition?.()}catch{}
        if(nativeRecognitionAllowActivityFallback&&!nativeRecognitionFallbackTried&&canStartNativeRecognitionActivity()){
          nativeRecognitionFallbackTried=true;
          const fallback=startNativeRecognitionActivity();
          if(fallback.ok){
            toast("切到系统语音输入");
            nativeRecognitionTimer=setTimeout(()=>{
              if(!nativeRecognizing)return;
              nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
              reject(new Error("speech_timeout"));
            },30000);
            return;
          }
        }
        nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
        reject(new Error("speech_timeout"));
      },12000);
      const result=parseNativeVoiceResult(bridge.startRecognition(voiceSettings.sttLanguage||"zh-CN"));
      if(!result.ok){
        clearTimeout(nativeRecognitionTimer);
        if(nativeRecognitionAllowActivityFallback&&canStartNativeRecognitionActivity()){
          nativeRecognitionFallbackTried=true;
          const fallback=startNativeRecognitionActivity();
          if(fallback.ok){
            nativeRecognitionTimer=setTimeout(()=>{
              if(!nativeRecognizing)return;
              nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
              reject(new Error("speech_timeout"));
            },30000);
            return;
          }
        }
        nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
        reject(new Error(result.error||"native_speech_start_failed"));
      }
    });
  }
  function stopNativeRecognition(){
    try{return parseNativeVoiceResult(nativeVoiceBridge()?.stopRecognition?.())}catch{return {ok:false,error:"native_speech_stop_failed"}}
  }
  const currentText=m=>String(m?.text||"").trim();
  const messageKey=(c,index)=>`${c?.id||"chat"}:${index}`;

  function toast(text,isError=false){
    document.querySelector(".xy-voice-toast")?.remove();
    const node=document.createElement("div");
    node.className="xy-voice-toast"+(isError?" error":"");node.textContent=text;
    document.body.appendChild(node);setTimeout(()=>node.remove(),3200);
  }

  function titleFromText(value){
    const plain=String(value||"").replace(/\[[^\]]+\]/g,"").replace(/\s+/g," ").trim();
    return (plain.split(/[。！？!?；;…]/)[0]||plain||"语音").trim().slice(0,28);
  }

  function speechText(value,forCall=false){
    const text=String(value||"").trim();
    if(!forCall)return /^\[[^\]\n]{1,32}\]/.test(text)?text:`[softly] ${text}`;
    const match=text.match(/^\[([^\]\n]{1,160})\]\s*([\s\S]+)$/);
    if(!match)return /^\[[^\]\n]{1,32}\]/.test(text)?text:`[softly] ${text}`;
    const line=match[2],chars=[...line.replace(/[\s，。！？、；;,.!?]/g,"")].length;
    const limit=chars<=8?2:chars<=18?4:chars<=40?7:12;
    const sections=match[1].split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    const words=parts=>parts.join(" ").split(/\s+/).filter(Boolean).length;
    while(sections.length>1&&words(sections)>limit)sections.pop();
    if(words(sections)>limit)sections[0]=sections[0].split(/\s+/).slice(0,limit).join(" ");
    return `[${sections.join(", ")}] ${line}`;
  }

  function plainSpeechText(value){
    return String(value||"").replace(/\[[^\]\n]{1,32}\]\s*/g,"").trim();
  }

  function speakWithSystem(text,key){
    const native=nativeVoiceBridge();
    if(activeAudio){activeAudio.pause();activeAudio=null}
    if(activeMessage===key){
      try{native?.stopTts?.()}catch{}
      window.speechSynthesis?.cancel?.();
      activeMessage=null;decorateMessages();return;
    }
    if(native?.speak){
      const result=parseNativeVoiceResult(native.speak(plainSpeechText(text),voiceSettings.systemVoiceURI||"",String(key)));
      if(!result.ok){toast(result.error==="tts_not_ready"?"系统语音还在初始化，等一秒再试":"系统语音播放失败："+(result.error||"unknown"),true);return}
      activeMessage=key;decorateMessages();return;
    }
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){toast("当前设备没有可用的系统语音",true);return}
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance(plainSpeechText(text));
    const voices=window.speechSynthesis.getVoices?.()||[];
    const selected=voices.find(v=>v.voiceURI===voiceSettings.systemVoiceURI);
    const preferred=selected||voices.find(v=>/^zh(?:-|_)/i.test(v.lang||""))||null;
    if(preferred){utter.voice=preferred;utter.lang=preferred.lang||"zh-CN"}else utter.lang="zh-CN";
    activeMessage=key;decorateMessages();
    utter.onend=()=>{if(activeMessage===key){activeMessage=null;decorateMessages()}};
    utter.onerror=()=>{if(activeMessage===key){activeMessage=null;decorateMessages()}};
    window.speechSynthesis.speak(utter);
  }

  function parseVoiceResult(result){
    if(result?.isError){
      const detail=result.content?.find(x=>x.type==="text")?.text||"语音服务返回错误";
      throw new Error(detail);
    }
    const structured=result?.structuredContent||{};
    let url=structured.audio_url||"";
    if(!url){
      const link=result?.content?.find(x=>x.type==="resource_link"&&String(x.mimeType||"").startsWith("audio/"));
      if(link?.uri)url=link.uri;
    }
    if(!url)throw new Error("语音服务没有返回音频");
    return {url,title:structured.title||titleFromText(structured.text)};
  }

  async function archiveMcpVoice(message,url,title,text){
    const existing=(message.attachments||[]).find(x=>x.kind==="audio"&&x.generatedBy==="mcp");
    if(existing&&existing.speechText===text)return existing;
    const note={kind:"audio",name:title||"AI语音",generatedBy:"mcp",speechText:text,duration:0,transcript:plainSpeechText(text),voiceUrl:url};
    try{
      // MCP links may be short-lived. Keep the actual audio locally when CORS allows.
      const response=await fetch(url);
      if(response.ok){
        const blob=await response.blob();
        if(blob.size>0&&blob.size<=16*1024*1024&&blob.type.startsWith("audio/")){
          note.localAudioKey=await window.xyAudioArchive?.put?.(blob)||"";
          note.type=blob.type;note.size=blob.size;
        }
      }
    }catch{}
    message.attachments=(message.attachments||[]).filter(x=>!(x.kind==="audio"&&x.generatedBy==="mcp"));
    message.attachments.push(note);
    save();renderMessages();
    return note;
  }
  async function synthesizeMessage(index,autoplay=true,targetChat=currentChat(),playbackAllowed=null){
    const mayPlay=()=>typeof playbackAllowed!=="function"||playbackAllowed();
    const c=targetChat,message=c?.messages?.[index];
    if(!message||message.role!=="assistant")return;
    const text=currentText(message);
    if(!text)return;
    const key=messageKey(c,index);
    if(voiceSettings.voiceMode==="system"){
      if(autoplay&&mayPlay())speakWithSystem(text,key);
      return;
    }
    if(message.voiceUrl&&message.voiceText===text){
      if(!(message.attachments||[]).some(x=>x.kind==="audio"&&x.generatedBy==="mcp")){
        await archiveMcpVoice(message,message.voiceUrl,message.voiceTitle,text);
      }
      if(autoplay&&mayPlay())playAudio(message.voiceUrl,key,message);
      return;
    }
    const server=resolveVoiceServer();
    if(!server){toast("先选择一个支持 text_to_speech 的 MCP 语音服务",true);return}
    if(busyMessages.has(key))return;
    busyMessages.add(key);decorateMessages();
    try{
      const args={text:speechText(text,Boolean(playbackAllowed)),title:titleFromText(text)};
      if(voiceSettings.voiceId.trim())args.voice_id=voiceSettings.voiceId.trim();
      if(voiceSettings.voiceModel.trim())args.model_id=voiceSettings.voiceModel.trim();
      const result=await callMcpTool(server,"text_to_speech",args);
      const audio=parseVoiceResult(result);
      message.voiceUrl=audio.url;message.voiceTitle=audio.title||args.title;message.voiceText=text;
      await archiveMcpVoice(message,audio.url,message.voiceTitle,text);
      save();decorateMessages();
      if(autoplay&&mayPlay())playAudio(message.voiceUrl,key,message);
    }catch(error){toast("语音生成失败："+error.message,true)}
    finally{busyMessages.delete(key);decorateMessages()}
  }

  function playAudio(url,key,message=null){
    if(activeAudio){activeAudio.pause();activeAudio=null}
    if(activeMessage===key){activeMessage=null;decorateMessages();return}
    const audio=new Audio(url);activeAudio=audio;activeMessage=key;decorateMessages();
    audio.onended=()=>{if(activeAudio===audio){activeAudio=null;activeMessage=null;decorateMessages()}};
    audio.onerror=()=>{
      if(message?.voiceUrl===url){delete message.voiceUrl;delete message.voiceTitle;delete message.voiceText;save()}
      if(activeAudio===audio){activeAudio=null;activeMessage=null;decorateMessages()}
      toast("这条语音失效了，点一下会重新生成",true);
    };
    audio.play().catch(error=>{activeAudio=null;activeMessage=null;decorateMessages();toast("播放失败："+error.message,true)});
  }

  function decorateMessages(){
    const box=document.querySelector("#messages");if(!box)return;
    box.querySelectorAll(".xy-voice-row").forEach(x=>x.remove());
    box.querySelectorAll(".message.assistant.has-voice").forEach(x=>x.classList.remove("has-voice"));
  }

  function systemEngineOptions(){
    const engines=nativeEngineList();
    if(!engines.length)return '<option value="">系统默认引擎</option>';
    const options=['<option value="">系统默认引擎</option>'];
    for(const item of engines){
      const pkg=String(item.packageName||"");
      const label=String(item.label||pkg||"未命名引擎");
      options.push('<option value="'+esc(pkg)+'" '+(pkg===voiceSettings.systemEnginePackage?'selected':'')+'>'+esc(label)+'</option>');
    }
    return options.join("");
  }

  function systemVoiceOptions(){
    const native=nativeVoiceList();
    if(native.length){
      const options=['<option value="">系统默认</option>'];
      const seen=new Set();
      for(const item of native){
        const id=String(item.id||item.name||"");
        const lang=String(item.lang||"未知语言");
        const kind=item.network?"网络":"本地";
        const dedupe=lang+"|"+kind+"|"+String(item.quality??"");
        if(seen.has(dedupe))continue;
        seen.add(dedupe);
        const label=lang+" · "+kind;
        options.push('<option value="'+esc(id)+'" '+(id===voiceSettings.systemVoiceURI?'selected':'')+'>'+esc(label)+'</option>');
      }
      return options.join("");
    }
    if(voiceSettings.systemEnginePackage)return '<option value="">由当前 TTS 引擎决定</option>';
    const voices=window.speechSynthesis?.getVoices?.()||[];
    return '<option value="">系统默认</option>'+voices.filter(v=>/^zh(?:-|_)/i.test(v.lang||"")).map(v=>'<option value="'+esc(v.voiceURI)+'" '+(v.voiceURI===voiceSettings.systemVoiceURI?'selected':'')+'>'+esc((v.lang||'中文')+' · '+(v.localService===false?'网络':'本地'))+'</option>').join('');
  }

  function refreshSystemVoiceSelect(){
    const select=document.querySelector("#systemVoice");if(!select)return;
    const wanted=voiceSettings.systemVoiceURI||select.value||"";
    select.innerHTML=systemVoiceOptions();
    if([...select.options].some(option=>option.value===wanted))select.value=wanted;
  }

  async function requestMicStream(){
    const attempts=[
      {audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}},
      {audio:true}
    ];
    let lastError=null;
    for(const constraints of attempts){
      try{return await navigator.mediaDevices.getUserMedia(constraints)}
      catch(error){
        lastError=error;
        if(error?.name==="NotAllowedError"||error?.name==="SecurityError")throw error;
        await new Promise(resolve=>setTimeout(resolve,260));
      }
    }
    throw lastError||new Error("Could not start audio source");
  }

  function renderVoicePanel(){
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="VOICE";
    document.querySelector("#panelTitle").textContent="语音";
    const body=document.querySelector("#panelBody"),servers=voiceServers();
    const selected=resolveVoiceServer()?.id||"";
    body.innerHTML=`<p class="setting-note">默认使用设备自带系统语音，不需要额外服务；也可以切换到任意提供 text_to_speech 的 MCP。录音转写与语音合成互相独立。</p>
      <div class="voice-setting-grid">
        <div class="voice-setting-card"><label>语音方式</label><select id="voiceMode"><option value="system" ${voiceSettings.voiceMode==="system"?"selected":""}>系统语音（无需 MCP）</option><option value="mcp" ${voiceSettings.voiceMode==="mcp"?"selected":""}>MCP 语音服务</option></select><label>系统 TTS 引擎</label><select id="systemEngine">${systemEngineOptions()}</select><label>系统音色</label><select id="systemVoice">${systemVoiceOptions()}</select><label>text_to_speech 服务</label><select id="voiceMcp"><option value="">请选择服务</option>${servers.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?"selected":""}>${esc(x.name)}</option>`).join("")}</select><label>Voice ID（可选）</label><input id="voiceId" value="${esc(voiceSettings.voiceId)}" placeholder="由语音服务提供"><label>Model（可选）</label><input id="voiceModel" value="${esc(voiceSettings.voiceModel)}" placeholder="由语音服务提供"><label class="voice-check"><input id="voiceAutoSpeak" type="checkbox" ${voiceSettings.autoSpeak?"checked":""}>每次新回复自动念出来</label></div>
        <div class="voice-setting-card"><label>语音转写 Base URL（留空跟随当前聊天接口）</label><input id="voiceSttBase" value="${esc(voiceSettings.sttBase)}" placeholder="https://api.example.com/v1"><label>转写 Key（Base 留空时才跟随当前接口）</label><input id="voiceSttKey" type="password" value="${esc(voiceSettings.sttKey)}" placeholder="仅保存在本机"><label>转写模型</label><input id="voiceSttModel" value="${esc(voiceSettings.sttModel)}" placeholder="whisper-1"><label>语言</label><input id="voiceSttLanguage" value="${esc(voiceSettings.sttLanguage)}" placeholder="zh / en"><label class="voice-check"><input id="voiceAutoSend" type="checkbox" ${voiceSettings.sendAfterTranscript?"checked":""}>转写完成后直接发送</label></div>
      </div>
      <div class="voice-test-row"><button class="panel-action" id="voiceOpenMcp">MCP 设置</button><button class="panel-action" id="voiceTest">试听</button></div>
      <button class="panel-action" id="voiceSave" style="margin-top:8px">保存语音设置</button>`;
    document.querySelector("#panel")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show");
  }

  function collectVoiceSettings(){
    voiceSettings={...voiceSettings,
      voiceMode:document.querySelector("#voiceMode")?.value||"system",
      systemEnginePackage:document.querySelector("#systemEngine")?.value||"",
      systemVoiceURI:document.querySelector("#systemVoice")?.value||"",
      voiceMcpId:document.querySelector("#voiceMcp")?.value||"",
      voiceId:document.querySelector("#voiceId")?.value.trim()||"",
      voiceModel:document.querySelector("#voiceModel")?.value.trim()||"",
      autoSpeak:Boolean(document.querySelector("#voiceAutoSpeak")?.checked),
      sttBase:document.querySelector("#voiceSttBase")?.value.trim().replace(/\/$/,"")||"",
      sttKey:document.querySelector("#voiceSttKey")?.value.trim()||"",
      sttModel:document.querySelector("#voiceSttModel")?.value.trim()||"whisper-1",
      sttLanguage:document.querySelector("#voiceSttLanguage")?.value.trim()||"",
      sendAfterTranscript:Boolean(document.querySelector("#voiceAutoSend")?.checked)
    };persist();
  }

  function recorderMime(){
    const choices=["audio/webm;codecs=opus","audio/webm","audio/mp4"];
    return choices.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||"";
  }

  async function transcribe(blob){
    const ep=activeEndpoint(),customBase=voiceSettings.sttBase.trim();
    const rawBase=(customBase||ep.base||"").trim().replace(/\/$/,"");
    const base=rawBase.replace(/\/(?:chat\/completions|responses|audio\/transcriptions)$/i,"");
    const key=voiceSettings.sttKey||(!customBase?ep.key:"")||"";
    if(!base)throw new Error("先在语音设置里填写转写 Base URL");
    const ext=blob.type.includes("mp4")?"m4a":"webm",form=new FormData();
    form.append("file",blob,"amao-"+Date.now()+"."+ext);form.append("model",voiceSettings.sttModel||"whisper-1");
    if(voiceSettings.sttLanguage)form.append("language",voiceSettings.sttLanguage);
    const headers={Accept:"application/json"};if(key)headers.Authorization="Bearer "+key;
    const response=await fetch(base+"/audio/transcriptions",{method:"POST",headers,body:form});
    const raw=await response.text().catch(()=>"");
    if(!response.ok)throw new Error("HTTP "+response.status+(raw?" · "+raw.slice(0,120):""));
    let data;
    try{data=JSON.parse(raw)}
    catch{
      if(/^\s*</.test(raw))throw new Error("这个转写地址返回了网页，不是语音转写 API");
      throw new Error("转写接口没有返回有效 JSON");
    }
    const text=String(data.text||data.transcript||"").trim();
    if(!text)throw new Error("转写接口没有返回文字");
    return text;
  }

  const micIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7"></path></svg>';
  const stopIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"></rect></svg>';
  const sendIcon='<span class="xy-send-arrow">↑</span>';

  function hasComposerPayload(){
    const text=document.querySelector("#input")?.value.trim()||"";
    const attachments=window.xyAttachments?.peek?.()||[];
    return Boolean(text||(Array.isArray(attachments)&&attachments.length));
  }

  function refreshComposerAction(){
    const button=document.querySelector("#sendBtn");if(!button)return;
    const recording=nativeRecording||recorder?.state==="recording";
    const listening=recording||composerActionState==="requesting"||composerActionState==="transcribing";
    const mode=recording?"recording":hasComposerPayload()?"send":"mic";
    button.dataset.mode=mode;
    button.classList.toggle("is-mic",mode==="mic");
    button.classList.toggle("is-recording",mode==="recording");
    button.classList.toggle("is-transcribing",composerActionState==="transcribing"||composerActionState==="requesting");
    button.innerHTML=mode==="send"?sendIcon:mode==="recording"?stopIcon:micIcon;
    button.title=mode==="send"?"发送":mode==="recording"?"结束并发送语音":"录制语音";
    button.setAttribute("aria-label",button.title);
    button.disabled=composerActionState==="transcribing"||composerActionState==="requesting";
    if(!listening&&composerActionState!=="idle")composerActionState="idle";
  }

  function setMicState(state){
    composerActionState=state||"idle";
    refreshComposerAction();
  }

  const blobDataUrl=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(reader.error||new Error("语音读取失败"));
    reader.readAsDataURL(blob);
  });

  function voiceNoteFormat(type){
    const mime=String(type||"").toLowerCase();
    if(mime.includes("wav"))return "wav";
    if(mime.includes("mpeg")||mime.includes("mp3"))return "mp3";
    if(mime.includes("mp4")||mime.includes("m4a")||mime.includes("aac"))return "m4a";
    if(mime.includes("webm"))return "webm";
    if(mime.includes("ogg"))return "ogg";
    return "audio";
  }

  async function sendVoiceNoteBlob(blob){
    const elapsed=Math.max(1,Math.round((Date.now()-(voiceNoteStartedAt||Date.now()))/1000));
    if(!blob||blob.size<700){
      toast("这段太短了，没录下来",true);
      return;
    }
    setMicState("transcribing");
    try{
      const dataUrl=await blobDataUrl(blob);
      const format=voiceNoteFormat(blob.type);
      let localAudioKey="";
      try{localAudioKey=await window.xyAudioArchive?.put?.(blob)||""}
      catch(error){toast("本地录音保存失败："+(error?.message||error),true)}
      let transcript="",transcriptError="";
      if(voiceSettings.sttBase.trim()||activeEndpoint()?.base){
        try{transcript=String(await transcribe(blob)).trim()}
        catch(error){
          transcriptError=String(error?.message||error).slice(0,160);
          toast("语音已录下，但AI暂时听不懂：语音转写失败",true);
        }
      }else{
        transcriptError="尚未设置支持语音转写的接口";
        toast("语音已录下，但需要配置支持语音转写的接口",true);
      }
      const attachment={
        kind:"audio",
        name:"语音 "+elapsed+"秒",
        type:blob.type||"audio/mp4",
        size:blob.size,
        duration:elapsed,
        format,
        localAudioKey,
        transcript,
        transcriptError,
        dataUrl
      };
      const api=window.xyAttachments;
      if(!api?.restore)throw new Error("语音附件模块还没准备好");
      api.restore([attachment]);
      window.xyVoiceRefreshComposer?.();
      await send();
    }catch(error){
      toast("语音发送失败："+(error?.message||error),true);
    }finally{
      voiceBusy=false;
      voiceNoteStartedAt=0;
      setMicState("idle");
    }
  }

  async function startRecording(){
    if(recordStarting||recorder||nativeRecording||voiceBusy)return;
    const native=nativeVoiceBridge();
    if(native){
      recordStarting=true;voiceBusy=true;setMicState("requesting");
      try{
        const result=startNativeCapture();
        if(!result.ok){
          if(result.error==="permission_requested")toast("已经请求麦克风权限，允许后再点一下麦克风");
          else throw new Error(result.error||"native_record_failed");
          voiceBusy=false;setMicState("idle");return;
        }
        voiceNoteStartedAt=Date.now();
        nativeRecording=true;
        setMicState("recording");
        toast("正在录语音，点一下结束并发送");
        recordTimer=setTimeout(()=>{if(nativeRecording)stopRecording()},60000);
      }catch(error){
        voiceBusy=false;setMicState("idle");
        toast("录音失败："+(error?.message||error),true);
      }finally{recordStarting=false}
      return;
    }

    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
      toast("这个浏览器暂不支持录音",true);return;
    }
    recordStarting=true;voiceBusy=true;setMicState("requesting");
    try{
      recordStream=await requestMicStream();
      recordChunks=[];
      const mime=recorderMime();
      recorder=new MediaRecorder(recordStream,mime?{mimeType:mime}:undefined);
      recorder.ondataavailable=e=>{if(e.data?.size)recordChunks.push(e.data)};
      recorder.onstop=finishRecording;
      voiceNoteStartedAt=Date.now();
      recorder.start(250);
      setMicState("recording");
      toast("正在录语音，点一下结束并发送");
      const liveRecorder=recorder;
      recordTimer=setTimeout(()=>{if(liveRecorder.state==="recording")liveRecorder.stop()},60000);
    }catch(error){
      recordStream?.getTracks().forEach(track=>track.stop());
      recordStream=null;recorder=null;voiceBusy=false;setMicState("idle");
      const sourceFail=error?.name==="NotReadableError"||error?.name==="AbortError"||/audio source|could not start/i.test(String(error?.message||""));
      toast(error?.name==="NotAllowedError"?"没有拿到麦克风权限":sourceFail?"麦克风启动失败：请检查是否有别的应用正在占用麦克风":"录音失败："+(error?.message||error),true);
    }finally{recordStarting=false}
  }

  async function stopRecording(){
    if(nativeRecording){
      clearTimeout(recordTimer);
      nativeRecording=false;
      setMicState("transcribing");
      try{
        const result=stopNativeCapture();
        if(!result.ok||!result.blob)throw new Error(result.error||"native_record_stop_failed");
        await sendVoiceNoteBlob(result.blob);
      }catch(error){
        voiceBusy=false;voiceNoteStartedAt=0;setMicState("idle");
        toast("录音失败："+(error?.message||error),true);
      }
      return;
    }
    if(recorder?.state==="recording")recorder.stop();
  }

  async function finishRecording(){
    clearTimeout(recordTimer);
    recordStream?.getTracks().forEach(track=>track.stop());
    recordStream=null;
    const type=recorder?.mimeType||recordChunks[0]?.type||"audio/webm";
    const blob=new Blob(recordChunks,{type});
    recorder=null;recordChunks=[];
    await sendVoiceNoteBlob(blob);
  }

  function installComposerAction(){
    document.querySelector("#voiceMic")?.remove();
    const input=document.querySelector("#input"),button=document.querySelector("#sendBtn");
    if(!input||!button)return;
    const refresh=()=>refreshComposerAction();
    input.addEventListener("input",refresh);
    button.onclick=e=>{
      e?.preventDefault?.();e?.stopPropagation?.();
      if(nativeRecording||recorder?.state==="recording"){stopRecording();return}
      if(hasComposerPayload()){send();return}
      startRecording();
    };
    window.xyVoiceRefreshComposer=refresh;
    refresh();
  }

  function openVoicePanel(){
    try{return renderVoicePanel()}
    catch(error){console.error("[AevrenVoice] open panel failed",error);toast("语音工具打开失败："+(error?.message||error),true)}
  }

  const priorOpenPanel=openPanel;
  openPanel=function(type){if(type==="voice")return openVoicePanel();return priorOpenPanel(type)};

  const priorRender=renderMessages;
  renderMessages=function(){const result=priorRender();requestAnimationFrame(decorateMessages);return result};

  const priorSend=send;
  send=async function(){
    const targetChat=currentChat(),before=targetChat?.messages?.length||0,result=await priorSend();
    if(voiceSettings.autoSpeak&&currentChat()===targetChat){
      const index=targetChat?.messages?.findLastIndex?.((m,i)=>i>=before&&m.role==="assistant")??-1;
      if(index>=0&&!/^请求失败[:：]/.test(currentText(targetChat.messages[index])))await synthesizeMessage(index,true,targetChat);
    }
    return result;
  };
  const sendButton=document.querySelector("#sendBtn");if(sendButton)requestAnimationFrame(refreshComposerAction);

  document.querySelector("#messages")?.addEventListener("click",e=>{
    const button=e.target.closest?.("[data-voice-message]");if(!button)return;
    e.preventDefault();e.stopPropagation();synthesizeMessage(Number(button.dataset.voiceMessage),true);
  });

  document.querySelector("#messages")?.addEventListener("click",async e=>{
    const button=e.target.closest?.(".xy-message-voice-note");
    if(!button)return;
    e.preventDefault();e.stopPropagation();
    let src=button.dataset.voiceNoteSrc||"";
    let localObjectUrl="";
    if(!src&&button.dataset.voiceNoteKey){
      try{
        const blob=await window.xyAudioArchive?.get?.(button.dataset.voiceNoteKey);
        if(blob){localObjectUrl=URL.createObjectURL(blob);src=localObjectUrl}
      }catch(error){toast("语音读取失败："+(error?.message||error),true)}
    }
    if(!src){toast("这条语音没有可播放的录音",true);return}
    const icon=button.querySelector(".xy-message-voice-icon");
    if(activeAudio&&button.classList.contains("playing")){
      activeAudio.pause();activeAudio=null;button.classList.remove("playing");
      if(icon)icon.textContent="▶";
      return;
    }
    if(activeAudio){activeAudio.pause();activeAudio=null}
    document.querySelectorAll(".xy-message-voice-note.playing").forEach(node=>{
      node.classList.remove("playing");
      const nodeIcon=node.querySelector(".xy-message-voice-icon");if(nodeIcon)nodeIcon.textContent="▶";
    });
    const audio=new Audio(src);activeAudio=audio;activeMessage=null;
    button.classList.add("playing");if(icon)icon.textContent="Ⅱ";
    const finish=()=>{if(activeAudio===audio)activeAudio=null;button.classList.remove("playing");if(icon)icon.textContent="▶";if(localObjectUrl)URL.revokeObjectURL(localObjectUrl)};
    audio.onended=finish;audio.onerror=()=>{finish();toast("这条语音现在播不了",true)};
    audio.play().catch(error=>{finish();toast("播放失败："+error.message,true)});
  });

  document.addEventListener("change",e=>{
    if(e.target?.id!=="systemEngine")return;
    const pkg=e.target.value||"";
    voiceSettings.systemEnginePackage=pkg;
    voiceSettings.systemVoiceURI="";
    persist();
    const result=switchNativeEngine(pkg);
    if(!result.ok){toast("切换系统语音引擎失败："+(result.error||"unknown"),true);return}
    toast("正在切换系统语音引擎…");
  });

  document.addEventListener("click",async e=>{
    if(e.target.id==="voiceSave"){collectVoiceSettings();toast("语音设置保存了");renderVoicePanel()}
    if(e.target.id==="voiceOpenMcp")openPanel("mcp");
    if(e.target.id==="voiceTest"){
      collectVoiceSettings();
      if(voiceSettings.voiceMode==="system"){
        speakWithSystem("你好，这是一条语音试听。","voice-test");
        return;
      }
      const server=resolveVoiceServer();if(!server){toast("先选择一个支持 text_to_speech 的 MCP 语音服务",true);return}
      e.target.disabled=true;e.target.textContent="生成中…";
      try{const args={text:"[softly] 你好，这是一条语音试听。",title:"语音试听"};if(voiceSettings.voiceId.trim())args.voice_id=voiceSettings.voiceId.trim();if(voiceSettings.voiceModel.trim())args.model_id=voiceSettings.voiceModel.trim();const result=await callMcpTool(server,"text_to_speech",args),audio=parseVoiceResult(result);playAudio(audio.url,"voice-test")}
      catch(error){toast("试听失败："+error.message,true)}
      finally{if(document.querySelector("#voiceTest")){document.querySelector("#voiceTest").disabled=false;document.querySelector("#voiceTest").textContent="试听"}}
    }
  });

  document.addEventListener("click",e=>{
    if(!voiceBusy)return;
    if(e.target.closest?.("#newChat,#chatList [data-id]")){e.preventDefault();e.stopPropagation();toast("先让我把这段语音听完，再换对话")}
  },true);

  const sidebarBottom=document.querySelector(".sidebar-bottom");
  let voiceNav=sidebarBottom?.querySelector('[data-panel="voice"]')||null;
  if(sidebarBottom&&!voiceNav){
    voiceNav=document.createElement("button");voiceNav.className="nav-btn";voiceNav.dataset.panel="voice";voiceNav.innerHTML="♬ <span>语音</span>";
    const settingsNav=sidebarBottom.querySelector('[data-panel="settings"]');sidebarBottom.insertBefore(voiceNav,settingsNav);
  }
  if(voiceNav)voiceNav.onclick=e=>{e.preventDefault();e.stopPropagation();openVoicePanel()};
  window.xyOpenVoicePanel=openVoicePanel;

  document.addEventListener("click",e=>{
    const target=e.target.closest?.('[data-panel="voice"]');if(!target)return;
    e.preventDefault();e.stopImmediatePropagation();openVoicePanel();
  },true);

  window.AevrenVoice={
    speakMessage(index,targetChat=currentChat(),playbackAllowed=null){
      return synthesizeMessage(Number(index),true,targetChat,playbackAllowed);
    },
    speakLatest(targetChat=currentChat()){
      const index=targetChat?.messages?.findLastIndex?.(m=>m.role==="assistant")??-1;
      return index>=0?synthesizeMessage(index,true,targetChat):Promise.resolve();
    },
    isSpeaking(){
      let nativeSpeaking=false;try{nativeSpeaking=Boolean(nativeVoiceBridge()?.isTtsSpeaking?.())}catch{}
      return Boolean(activeMessage||activeAudio||nativeSpeaking||(window.speechSynthesis&&window.speechSynthesis.speaking));
    },
    isMessageSpeaking(index,targetChat=currentChat()){
      return activeMessage===messageKey(targetChat,Number(index));
    },
    transcribeBlob(blob){return transcribe(blob)},
    openMicStream(){return requestMicStream()},
    getRecorderMime(){return recorderMime()},
    hasNativeCapture(){return Boolean(nativeVoiceBridge())},
    startNativeCapture(){return startNativeCapture()},
    stopNativeCapture(){return stopNativeCapture()},
    hasNativeRecognition(){return hasNativeRecognition()},
    onRecognitionProgress(observer){recognitionObserver=typeof observer==="function"?observer:null},
    recognizeNativeOnce(options){return recognizeNativeOnce(options)},
    stopNativeRecognition(){return stopNativeRecognition()},
    startNativeRecognitionActivity(){return startNativeRecognitionActivity()},
    stop(){
      if(activeAudio){activeAudio.pause();activeAudio=null}
      try{nativeVoiceBridge()?.stopTts?.()}catch{}
      window.speechSynthesis?.cancel?.();
      activeMessage=null;decorateMessages();
    }
  };

  window.__xyNativeSttResult=text=>{
    notifyRecognition("result",text);
    clearTimeout(nativeRecognitionTimer);nativeRecognitionTimer=null;
    const resolve=nativeRecognitionResolve;
    nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
    if(resolve)resolve(String(text||""));
    refreshComposerAction();
  };
  window.__xyNativeSttError=error=>{
    notifyRecognition("error",normalizeSpeechError(error));
    clearTimeout(nativeRecognitionTimer);nativeRecognitionTimer=null;
    if(nativeRecognizing&&nativeRecognitionAllowActivityFallback&&!nativeRecognitionFallbackTried&&canStartNativeRecognitionActivity()){
      nativeRecognitionFallbackTried=true;
      const fallback=startNativeRecognitionActivity();
      if(fallback.ok){
        setMicState("recording");
        toast("内嵌识别没接上，已切到系统语音输入");
        nativeRecognitionTimer=setTimeout(()=>{
          if(!nativeRecognizing)return;
          const reject=nativeRecognitionReject;
          nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
          if(reject)reject(new Error("speech_timeout"));
        },30000);
        return;
      }
    }
    const reject=nativeRecognitionReject;
    nativeRecognizing=false;nativeRecognitionResolve=null;nativeRecognitionReject=null;
    if(reject)reject(new Error(normalizeSpeechError(error)));
    refreshComposerAction();
  };
  window.__xyNativeSttPartial=text=>{
    if(nativeRecognizing){
      notifyRecognition("partial",text);
      const button=document.querySelector("#sendBtn");if(button)button.title="你在说："+String(text||"").slice(0,18)
    }
  };
  window.__xyNativeSttState=state=>{
    if(!nativeRecognizing)return;
    notifyRecognition("state",state);
    if(state==="processing")setMicState("transcribing");
  };
  window.__xyNativeTtsEngineReady=()=>{
    refreshSystemVoiceSelect();
    const select=document.querySelector("#systemVoice");
    if(select)select.value=voiceSettings.systemVoiceURI||"";
    toast("系统语音引擎已切换");
  };
  window.__xyNativeTtsEngineError=error=>toast("系统语音引擎启动失败："+String(error||"unknown"),true);
  window.__xyNativeTtsDone=id=>{if(activeMessage===String(id)){activeMessage=null;decorateMessages()}};
  window.__xyNativeTtsError=(id,error)=>{if(activeMessage===String(id)){activeMessage=null;decorateMessages()}toast("系统语音播放失败："+String(error||"unknown"),true)};
  if(window.speechSynthesis?.addEventListener)window.speechSynthesis.addEventListener("voiceschanged",refreshSystemVoiceSelect);
  if(voiceSettings.systemEnginePackage)switchNativeEngine(voiceSettings.systemEnginePackage);
  installComposerAction();renderMessages();
})();