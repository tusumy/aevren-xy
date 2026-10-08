(()=>{
  const DEFAULTS={
    voiceMode:"system",
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
  let recorder=null,recordStream=null,recordChunks=[],recordTimer=null,recordStarting=false,voiceBusy=false;
  let activeAudio=null,activeMessage=null;
  const busyMessages=new Set();

  const persist=()=>store.set("xy.voice",voiceSettings);
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0]||{};
  const voiceServers=()=>mcps.filter(server=>server.enabled&&server.tools?.some(tool=>tool.name==="text_to_speech"));
  const resolveVoiceServer=()=>voiceSettings.voiceMcpId?voiceServers().find(x=>x.id===voiceSettings.voiceMcpId)||null:null;
  const currentChat=()=>{try{return chat()}catch{return null}};
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

  function speechText(value){
    const text=String(value||"").trim();
    return /^\[[^\]\n]{1,32}\]/.test(text)?text:`[softly] ${text}`;
  }

  function plainSpeechText(value){
    return String(value||"").replace(/\[[^\]\n]{1,32}\]\s*/g,"").trim();
  }

  function speakWithSystem(text,key){
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){toast("当前设备没有可用的系统语音",true);return}
    if(activeAudio){activeAudio.pause();activeAudio=null}
    if(activeMessage===key){window.speechSynthesis.cancel();activeMessage=null;decorateMessages();return}
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

  async function synthesizeMessage(index,autoplay=true,targetChat=currentChat()){
    const c=targetChat,message=c?.messages?.[index];
    if(!message||message.role!=="assistant")return;
    const text=currentText(message);
    if(!text)return;
    const key=messageKey(c,index);
    if(voiceSettings.voiceMode==="system"){
      if(autoplay)speakWithSystem(text,key);
      return;
    }
    if(message.voiceUrl&&message.voiceText===text){
      if(autoplay)playAudio(message.voiceUrl,key,message);
      return;
    }
    const server=resolveVoiceServer();
    if(!server){toast("先选择一个支持 text_to_speech 的 MCP 语音服务",true);return}
    if(busyMessages.has(key))return;
    busyMessages.add(key);decorateMessages();
    try{
      const args={text:speechText(text),title:titleFromText(text)};
      if(voiceSettings.voiceId.trim())args.voice_id=voiceSettings.voiceId.trim();
      if(voiceSettings.voiceModel.trim())args.model_id=voiceSettings.voiceModel.trim();
      const result=await callMcpTool(server,"text_to_speech",args);
      const audio=parseVoiceResult(result);
      message.voiceUrl=audio.url;message.voiceTitle=audio.title||args.title;message.voiceText=text;
      save();decorateMessages();
      if(autoplay)playAudio(message.voiceUrl,key,message);
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

  function systemVoiceOptions(){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    const options=['<option value="">系统默认</option>'];
    for(const item of voices){
      const uri=String(item.voiceURI||item.name||"");
      const label=(item.name||"未命名语音")+" · "+(item.lang||"未知语言");
      options.push('<option value="'+esc(uri)+'" '+(uri===voiceSettings.systemVoiceURI?'selected':'')+'>'+esc(label)+'</option>');
    }
    return options.join("");
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
        <div class="voice-setting-card"><label>语音方式</label><select id="voiceMode"><option value="system" ${voiceSettings.voiceMode==="system"?"selected":""}>系统语音（无需 MCP）</option><option value="mcp" ${voiceSettings.voiceMode==="mcp"?"selected":""}>MCP 语音服务</option></select><label>系统音色</label><select id="systemVoice">${systemVoiceOptions()}</select><label>text_to_speech 服务</label><select id="voiceMcp"><option value="">请选择服务</option>${servers.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?"selected":""}>${esc(x.name)}</option>`).join("")}</select><label>Voice ID（可选）</label><input id="voiceId" value="${esc(voiceSettings.voiceId)}" placeholder="由语音服务提供"><label>Model（可选）</label><input id="voiceModel" value="${esc(voiceSettings.voiceModel)}" placeholder="由语音服务提供"><label class="voice-check"><input id="voiceAutoSpeak" type="checkbox" ${voiceSettings.autoSpeak?"checked":""}>每次新回复自动念出来</label></div>
        <div class="voice-setting-card"><label>语音转写 Base URL（留空跟随当前聊天接口）</label><input id="voiceSttBase" value="${esc(voiceSettings.sttBase)}" placeholder="https://api.example.com/v1"><label>转写 Key（Base 留空时才跟随当前接口）</label><input id="voiceSttKey" type="password" value="${esc(voiceSettings.sttKey)}" placeholder="仅保存在本机"><label>转写模型</label><input id="voiceSttModel" value="${esc(voiceSettings.sttModel)}" placeholder="whisper-1"><label>语言</label><input id="voiceSttLanguage" value="${esc(voiceSettings.sttLanguage)}" placeholder="zh / en"><label class="voice-check"><input id="voiceAutoSend" type="checkbox" ${voiceSettings.sendAfterTranscript?"checked":""}>转写完成后直接发送</label></div>
      </div>
      <div class="voice-test-row"><button class="panel-action" id="voiceOpenMcp">MCP 设置</button><button class="panel-action" id="voiceTest">试听</button></div>
      <button class="panel-action" id="voiceSave" style="margin-top:8px">保存语音设置</button>`;
    document.querySelector("#panel")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show");
  }

  function collectVoiceSettings(){
    voiceSettings={...voiceSettings,
      voiceMode:document.querySelector("#voiceMode")?.value||"system",
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
    const base=(customBase||ep.base||"").trim().replace(/\/$/,"");
    const key=voiceSettings.sttKey||(!customBase?ep.key:"")||"";
    if(!base)throw new Error("先在语音设置或接口设置里填写转写 Base URL");
    const ext=blob.type.includes("mp4")?"m4a":"webm",form=new FormData();
    form.append("file",blob,`amao-${Date.now()}.${ext}`);form.append("model",voiceSettings.sttModel||"whisper-1");
    if(voiceSettings.sttLanguage)form.append("language",voiceSettings.sttLanguage);
    const headers={Accept:"application/json"};if(key)headers.Authorization="Bearer "+key;
    const response=await fetch(base+"/audio/transcriptions",{method:"POST",headers,body:form});
    if(!response.ok){const detail=await response.text().catch(()=>"");throw new Error("HTTP "+response.status+(detail?" · "+detail.slice(0,120):""))}
    const data=await response.json(),text=String(data.text||data.transcript||"").trim();
    if(!text)throw new Error("转写接口没有返回文字");return text;
  }

  function setMicState(state){
    const button=document.querySelector("#voiceMic");if(!button)return;
    button.classList.toggle("recording",state==="recording");button.classList.toggle("transcribing",state==="transcribing"||state==="requesting");button.disabled=state==="transcribing"||state==="requesting";
    button.title=state==="recording"?"点击结束录音":state==="transcribing"?"正在听懂…":state==="requesting"?"正在请求麦克风…":"发送语音";
  }

  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast("这个浏览器暂不支持录音",true);return}
    if(recordStarting||recorder||voiceBusy)return;
    recordStarting=true;voiceBusy=true;setMicState("requesting");
    try{
      recordStream=await requestMicStream();
      recordChunks=[];const mime=recorderMime();recorder=new MediaRecorder(recordStream,mime?{mimeType:mime}:undefined);
      recorder.ondataavailable=e=>{if(e.data?.size)recordChunks.push(e.data)};
      recorder.onstop=finishRecording;recorder.start(250);setMicState("recording");toast("正在听，点一下麦克风就发送");
      const liveRecorder=recorder;recordTimer=setTimeout(()=>{if(liveRecorder.state==="recording")liveRecorder.stop()},120000);
    }catch(error){recordStream?.getTracks().forEach(track=>track.stop());recordStream=null;recorder=null;voiceBusy=false;setMicState("idle");const sourceFail=error?.name==="NotReadableError"||error?.name==="AbortError"||/audio source|could not start/i.test(String(error?.message||""));toast(error?.name==="NotAllowedError"?"没有拿到麦克风权限":sourceFail?"麦克风启动失败：已重试普通录音模式；请检查砚屿的麦克风权限或是否有别的应用正在占用麦克风":"录音失败："+(error?.message||error),true)}
    finally{recordStarting=false}
  }

  function stopRecording(){if(recorder?.state==="recording")recorder.stop()}

  async function finishRecording(){
    clearTimeout(recordTimer);recordStream?.getTracks().forEach(track=>track.stop());recordStream=null;
    const type=recorder?.mimeType||recordChunks[0]?.type||"audio/webm",blob=new Blob(recordChunks,{type});recorder=null;recordChunks=[];
    if(blob.size<700){voiceBusy=false;setMicState("idle");toast("这段太短了，我没听清",true);return}
    setMicState("transcribing");
    try{
      const text=await transcribe(blob),input=document.querySelector("#input");
      if(!input)return;input.value=text;try{resize()}catch{}
      if(voiceSettings.sendAfterTranscript)await send();else{input.focus();toast("听清了，已经放进输入框")}
    }catch(error){toast("没听懂："+error.message,true)}
    finally{voiceBusy=false;setMicState("idle")}
  }

  function installMic(){
    const composer=document.querySelector(".composer"),input=document.querySelector("#input");
    if(!composer||!input||document.querySelector("#voiceMic"))return;
    const button=document.createElement("button");button.type="button";button.id="voiceMic";button.className="voice-mic";button.title="发送语音";button.setAttribute("aria-label","发送语音");
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7"></path></svg>';
    input.insertAdjacentElement("beforebegin",button);button.addEventListener("click",()=>recorder?.state==="recording"?stopRecording():startRecording());
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
  const sendButton=document.querySelector("#sendBtn");if(sendButton)sendButton.onclick=send;

  document.querySelector("#messages")?.addEventListener("click",e=>{
    const button=e.target.closest?.("[data-voice-message]");if(!button)return;
    e.preventDefault();e.stopPropagation();synthesizeMessage(Number(button.dataset.voiceMessage),true);
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
    speakMessage(index,targetChat=currentChat()){
      return synthesizeMessage(Number(index),true,targetChat);
    },
    speakLatest(targetChat=currentChat()){
      const index=targetChat?.messages?.findLastIndex?.(m=>m.role==="assistant")??-1;
      return index>=0?synthesizeMessage(index,true,targetChat):Promise.resolve();
    },
    isSpeaking(){
      return Boolean(activeMessage||activeAudio||(window.speechSynthesis&&window.speechSynthesis.speaking));
    },
    isMessageSpeaking(index,targetChat=currentChat()){
      return activeMessage===messageKey(targetChat,Number(index));
    },
    stop(){
      if(activeAudio){activeAudio.pause();activeAudio=null}
      window.speechSynthesis?.cancel?.();
      activeMessage=null;decorateMessages();
    }
  };

  if(window.speechSynthesis?.addEventListener)window.speechSynthesis.addEventListener("voiceschanged",refreshSystemVoiceSelect);
  installMic();renderMessages();
})();