(()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let phase="idle",recognition=null,startedAt=0,timerId=null,processing=false,restartTimer=null;
  let callRecorder=null,callStream=null,callChunks=[],callNativeRecording=false,callNativeRecognizing=false;
  let overlay,statusEl,timeEl,transcriptEl,acceptBtn,hangupBtn,fallbackWrap,fallbackInput,pushBtn;
  let callCharacter=null,callUseNative=false,nativeAutoTimer=null;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const currentChat=()=>{try{return chat()}catch{return null}};
  const activeCharacter=()=>{try{return window.xyCurrentCharacter?.()||{id:"xuan-yan",name:document.querySelector(".presence strong")?.textContent?.trim()||"玄砚"}}catch{return {id:"xuan-yan",name:"玄砚"}}};
  const currentCallCharacter=()=>callCharacter||activeCharacter();
  const currentCallName=()=>String(currentCallCharacter()?.name||"角色");
  const currentCallAvatar=()=>{try{const saved=JSON.parse(localStorage.getItem("xy.avatars")||"{}");return saved?.characters?.[currentCallCharacter()?.id]||""}catch{return ""}};
  const fmtTime=ms=>{const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);return String(m).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};

  function ensureUi(){
    if(overlay)return;
    overlay=document.createElement("div");overlay.className="xy-call";overlay.hidden=true;
    overlay.innerHTML=`<div class="xy-call-card" role="dialog" aria-modal="true" aria-label="语音通话">
      <div class="xy-call-glow"></div>
      <div class="xy-call-avatar" aria-hidden="true"><span>角</span></div>
      <div class="xy-call-name">角色</div>
      <div class="xy-call-status">语音来电</div>
      <div class="xy-call-time">00:00</div>
      <div class="xy-call-transcript" aria-live="polite"></div>
      <button type="button" class="xy-call-push" hidden aria-label="按一下开始或结束说话"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7"></path></svg><span>说话</span></button>
      <div class="xy-call-fallback" hidden><input type="text" placeholder="也可以在这里输入"><button type="button">发送</button></div>
      <div class="xy-call-actions">
        <button type="button" class="xy-call-answer" aria-label="接听"><span>接听</span></button>
        <button type="button" class="xy-call-hangup" aria-label="挂断"><span>挂断</span></button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    statusEl=overlay.querySelector(".xy-call-status");timeEl=overlay.querySelector(".xy-call-time");
    transcriptEl=overlay.querySelector(".xy-call-transcript");acceptBtn=overlay.querySelector(".xy-call-answer");hangupBtn=overlay.querySelector(".xy-call-hangup");
    fallbackWrap=overlay.querySelector(".xy-call-fallback");fallbackInput=fallbackWrap.querySelector("input");pushBtn=overlay.querySelector(".xy-call-push");
    acceptBtn.onclick=answer;hangupBtn.onclick=hangup;
    pushBtn.onclick=()=>callNativeRecognizing||callNativeRecording||callRecorder?.state==="recording"?stopFallbackRecording():startFallbackRecording();
    fallbackWrap.querySelector("button").onclick=()=>submitFallback();
    fallbackInput.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitFallback()}};
    syncCallCharacter();
  }

  function syncCallCharacter(){
    if(!overlay)return;
    const ch=currentCallCharacter(),name=String(ch?.name||"角色"),avatar=currentCallAvatar();
    const card=overlay.querySelector(".xy-call-card"),nameEl=overlay.querySelector(".xy-call-name"),avatarEl=overlay.querySelector(".xy-call-avatar");
    if(card)card.setAttribute("aria-label",name+"语音通话");
    if(nameEl)nameEl.textContent=name;
    if(avatarEl){
      avatarEl.classList.toggle("has-image",Boolean(avatar));
      avatarEl.style.backgroundImage=avatar?`url("${String(avatar).replace(/"/g,"%22")}")`:"";
      const span=avatarEl.querySelector("span");if(span)span.textContent=avatar?"":name.slice(0,1);
    }
  }

  function installEntry(){
    document.querySelector("#xyCallBtn")?.remove();
  }

  function addLine(role,text){
    if(!text)return;
    const row=document.createElement("div");row.className="xy-call-line "+role;
    const who=document.createElement("b");who.textContent=role==="user"?"你":currentCallName();
    const body=document.createElement("span");body.textContent=text;
    row.append(who,body);transcriptEl.appendChild(row);transcriptEl.scrollTop=transcriptEl.scrollHeight;
  }

  function ring(payload){
    ensureUi();
    if(phase!=="idle")return;
    const active=activeCharacter(),incoming=payload&&typeof payload==="object"?payload:{};
    callCharacter={
      id:String(incoming.id||active.id||"xuan-yan"),
      name:String(incoming.name||active.name||"玄砚")
    };
    syncCallCharacter();
    phase="ringing";processing=false;overlay.hidden=false;overlay.classList.add("show","ringing");overlay.classList.remove("connected");
    transcriptEl.innerHTML="";statusEl.textContent="语音来电";timeEl.textContent="00:00";acceptBtn.hidden=false;hangupBtn.hidden=false;
    fallbackWrap.hidden=true;pushBtn.hidden=true;
    navigator.vibrate?.([180,120,180]);
  }

  async function answer(){
    if(phase!=="ringing")return;
    phase="connected";startedAt=Date.now();overlay.classList.remove("ringing");overlay.classList.add("connected");acceptBtn.hidden=true;statusEl.textContent=SpeechRecognition?"正在接通…":"已接通";
    timerId=setInterval(()=>{if(phase==="connected")timeEl.textContent=fmtTime(Date.now()-startedAt)},500);
    if(window.AevrenVoice?.hasNativeRecognition?.()){
      callUseNative=true;statusEl.textContent="已接通 · 正在听…";startNativeListening();return;
    }
    if(!SpeechRecognition){fallbackWrap.hidden=false;pushBtn.hidden=false;statusEl.textContent="已接通 · 点麦克风说话";return}
    await startListening();
  }

  function scheduleNativeListening(delay=350){
    clearTimeout(nativeAutoTimer);nativeAutoTimer=null;
    if(phase!=="connected"||!callUseNative||processing)return;
    nativeAutoTimer=setTimeout(startNativeListening,delay);
  }

  async function startNativeListening(){
    if(phase!=="connected"||!callUseNative||processing||callNativeRecognizing)return;
    if(window.AevrenVoice?.isSpeaking?.())return scheduleNativeListening(350);
    callNativeRecognizing=true;statusEl.textContent="正在听…";
    try{
      const text=String(await window.AevrenVoice.recognizeNativeOnce()).trim();
      callNativeRecognizing=false;
      if(phase!=="connected"||!callUseNative)return;
      if(text)await handleUserText(text);
      else scheduleNativeListening(500);
    }catch(error){
      callNativeRecognizing=false;
      if(phase!=="connected"||!callUseNative)return;
      if(String(error?.message||error)==="speech_no_match")return scheduleNativeListening(500);
      callUseNative=false;pushBtn.hidden=false;fallbackWrap.hidden=false;
      statusEl.textContent="免提识别失败 · 点麦克风说话";
    }
  }

  async function startFallbackRecording(){
    if(phase!=="connected"||processing||callNativeRecognizing||callNativeRecording||callRecorder?.state==="recording")return;
    if(window.AevrenVoice?.hasNativeRecognition?.()){
      callNativeRecognizing=true;
      pushBtn.classList.add("recording");pushBtn.querySelector("span").textContent="结束";
      statusEl.textContent="正在听你说…";
      try{
        const text=String(await window.AevrenVoice.recognizeNativeOnce()).trim();
        callNativeRecognizing=false;
        pushBtn.classList.remove("recording");pushBtn.querySelector("span").textContent="说话";
        if(text)await handleUserText(text);else statusEl.textContent="没听清 · 再说一次";
      }catch(error){
        callNativeRecognizing=false;
        pushBtn.classList.remove("recording");pushBtn.querySelector("span").textContent="说话";
        const code=String(error?.message||error);
        statusEl.textContent=code==="permission_requested"?"请允许麦克风权限，再点一次":"没听懂 · 再说一次";
        fallbackWrap.hidden=false;
      }
      return;
    }
    if(window.AevrenVoice?.hasNativeCapture?.()){
      try{
        const result=window.AevrenVoice.startNativeCapture();
        if(!result?.ok){
          if(result?.error==="permission_requested")statusEl.textContent="请允许麦克风权限，再点一次";
          else statusEl.textContent="麦克风启动失败 · 可用文字输入";
          fallbackWrap.hidden=false;return;
        }
        callNativeRecording=true;
        pushBtn.classList.add("recording");pushBtn.querySelector("span").textContent="结束";
        statusEl.textContent="正在听你说…";
      }catch{
        statusEl.textContent="麦克风启动失败 · 可用文字输入";fallbackWrap.hidden=false;
      }
      return;
    }
    if(!window.MediaRecorder||!window.AevrenVoice?.openMicStream||!window.AevrenVoice?.transcribeBlob){
      statusEl.textContent="当前环境不能录音 · 可用文字输入";fallbackWrap.hidden=false;return;
    }
    try{
      callStream=await window.AevrenVoice.openMicStream();
      callChunks=[];
      const mime=window.AevrenVoice.getRecorderMime?.()||"";
      callRecorder=new MediaRecorder(callStream,mime?{mimeType:mime}:undefined);
      callRecorder.ondataavailable=e=>{if(e.data?.size)callChunks.push(e.data)};
      callRecorder.onstop=finishFallbackRecording;
      callRecorder.start(250);
      pushBtn.classList.add("recording");pushBtn.querySelector("span").textContent="结束";
      statusEl.textContent="正在听你说…";
    }catch(error){
      callStream?.getTracks().forEach(track=>track.stop());callStream=null;callRecorder=null;
      statusEl.textContent="麦克风启动失败 · 可用文字输入";fallbackWrap.hidden=false;
    }
  }

  async function stopFallbackRecording(){
    if(callNativeRecognizing){window.AevrenVoice?.stopNativeRecognition?.();return}
    if(callNativeRecording){
      callNativeRecording=false;
      pushBtn.classList.remove("recording");pushBtn.querySelector("span").textContent="说话";
      try{
        const result=window.AevrenVoice.stopNativeCapture();
        if(!result?.ok||!result.blob)throw new Error(result?.error||"native_record_stop_failed");
        await processCallBlob(result.blob);
      }catch{
        statusEl.textContent="录音失败 · 再说一次";
      }
      return;
    }
    if(callRecorder?.state==="recording")callRecorder.stop();
  }

  async function processCallBlob(blob){
    if(blob.size<700){statusEl.textContent="这段太短了 · 再说一次";return}
    try{
      processing=true;statusEl.textContent="正在听懂…";
      const text=await window.AevrenVoice.transcribeBlob(blob);
      processing=false;
      if(text)await handleUserText(text);
    }catch(error){
      processing=false;statusEl.textContent="没听懂 · 再说一次";
    }
  }

  async function finishFallbackRecording(){
    const type=callRecorder?.mimeType||callChunks[0]?.type||"audio/webm";
    const blob=new Blob(callChunks,{type});
    callStream?.getTracks().forEach(track=>track.stop());callStream=null;callRecorder=null;callChunks=[];
    pushBtn.classList.remove("recording");pushBtn.querySelector("span").textContent="说话";
    await processCallBlob(blob);
  }

  function buildRecognition(){
    const rec=new SpeechRecognition();rec.lang="zh-CN";rec.continuous=true;rec.interimResults=true;
    rec.onstart=()=>{if(phase==="connected"&&!processing)statusEl.textContent="正在听…"};
    rec.onresult=e=>{
      if(phase!=="connected"||processing)return;
      let finalText="",interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0]?.transcript||"";
        if(e.results[i].isFinal)finalText+=t;else interim+=t;
      }
      if(interim)statusEl.textContent="你在说："+interim.slice(0,22);
      if(finalText.trim())handleUserText(finalText.trim());
    };
    rec.onerror=e=>{
      if(e.error==="not-allowed"||e.error==="service-not-allowed"){
        statusEl.textContent="麦克风未授权 · 可用文字输入";fallbackWrap.hidden=false;pushBtn.hidden=false;
      }
    };
    rec.onend=()=>{
      recognition=null;
      if(phase==="connected"&&!processing&&!window.AevrenVoice?.isSpeaking?.()) scheduleRestart();
    };
    return rec;
  }

  async function startListening(){
    if(phase!=="connected"||processing||recognition)return;
    if(window.AevrenVoice?.isSpeaking?.())return scheduleRestart();
    try{recognition=buildRecognition();recognition.start()}
    catch{recognition=null;scheduleRestart()}
  }

  function stopListening(){
    clearTimeout(restartTimer);restartTimer=null;
    if(recognition){try{recognition.onend=null;recognition.stop()}catch{} recognition=null}
  }

  function scheduleRestart(){
    clearTimeout(restartTimer);restartTimer=setTimeout(()=>startListening(),350);
  }

  async function waitForVoice(){
    const until=Date.now()+90000;
    while(phase==="connected"&&Date.now()<until&&window.AevrenVoice?.isSpeaking?.())await sleep(150);
  }

  async function handleUserText(text){
    if(!text||phase!=="connected"||processing)return;
    processing=true;stopListening();addLine("user",text);statusEl.textContent=currentCallName()+"在听…";
    const c=currentChat(),before=c?.messages?.length||0,input=document.querySelector("#input");
    if(!c||!input){statusEl.textContent="当前对话不可用";processing=false;return}
    input.value=text;input.dispatchEvent(new Event("input",{bubbles:true}));
    try{
      // Skip the regular chat composer's 10-second message batching in a call.
      await (window.AevrenApiCompat?.send?window.AevrenApiCompat.send():send());
      const idx=c.messages.findLastIndex((m,i)=>i>=before&&m.role==="assistant");
      if(idx>=0){
        const reply=String(c.messages[idx].text||"").trim();addLine("assistant",reply);
        if(reply&&!/^请求失败[:：]/.test(reply)){
          if(!window.AevrenVoice?.isSpeaking?.())await window.AevrenVoice?.speakMessage?.(idx,c);
          await waitForVoice();
        }
      }
    }catch(error){addLine("assistant","通话发送失败："+(error?.message||error))}
    finally{
      processing=false;
      if(phase==="connected"){if(callUseNative){statusEl.textContent="正在听…";scheduleNativeListening()}else if(SpeechRecognition){statusEl.textContent="正在听…";startListening()}else{statusEl.textContent="点麦克风说话";pushBtn.hidden=false;fallbackWrap.hidden=false}}
    }
  }

  function submitFallback(){
    const text=fallbackInput.value.trim();if(!text)return;fallbackInput.value="";handleUserText(text);
  }

  function parseNativeCallResult(raw){
    try{return typeof raw==="string"?JSON.parse(raw):raw||{}}catch{return {ok:false,error:String(raw||"native_call_error")}}
  }

  function nativeIncomingCall(payload){
    const bridge=window.AevrenCallNative;
    if(!bridge?.showIncomingCall)return {ok:false,error:"native_call_unavailable"};
    const active=activeCharacter(),incoming=payload&&typeof payload==="object"?payload:{};
    const id=String(incoming.id||active.id||"xuan-yan");
    const name=String(incoming.name||active.name||"玄砚");
    return parseNativeCallResult(bridge.showIncomingCall(id,name));
  }

  async function acceptNativeCall(payload){
    if(phase!=="idle")hangup();
    ring(payload);
    await answer();
  }

  function hangup(){
    if(phase==="idle")return;
    const duration=startedAt?fmtTime(Date.now()-startedAt):"00:00";
    phase="idle";processing=false;callUseNative=false;clearTimeout(nativeAutoTimer);nativeAutoTimer=null;stopListening();if(callNativeRecognizing){try{window.AevrenVoice?.stopNativeRecognition?.()}catch{}callNativeRecognizing=false}if(callNativeRecording){try{window.AevrenVoice?.stopNativeCapture?.()}catch{}callNativeRecording=false}if(callRecorder?.state==="recording"){try{callRecorder.onstop=null;callRecorder.stop()}catch{}}callStream?.getTracks().forEach(track=>track.stop());callStream=null;callRecorder=null;callChunks=[];clearInterval(timerId);timerId=null;window.AevrenVoice?.stop?.();
    statusEl.textContent="通话结束 · "+duration;overlay.classList.remove("ringing","connected");overlay.classList.add("ended");
    setTimeout(()=>{overlay.hidden=true;overlay.classList.remove("show","ended");callCharacter=null},650);
  }

  ensureUi();installEntry();
  window.AevrenCall={
    ring,
    answer,
    hangup,
    nativeIncomingCall,
    acceptNativeCall,
    getState:()=>({phase,startedAt,character:currentCallCharacter()})
  };
})();
