(()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let phase="idle",recognition=null,startedAt=0,timerId=null,processing=false,restartTimer=null;
  let callRecorder=null,callStream=null,callChunks=[],callNativeRecording=false;
  let overlay,statusEl,timeEl,transcriptEl,acceptBtn,hangupBtn,fallbackWrap,fallbackInput,pushBtn;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const currentChat=()=>{try{return chat()}catch{return null}};
  const fmtTime=ms=>{const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);return String(m).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};

  function ensureUi(){
    if(overlay)return;
    overlay=document.createElement("div");overlay.className="xy-call";overlay.hidden=true;
    overlay.innerHTML=`<div class="xy-call-card" role="dialog" aria-modal="true" aria-label="玄砚语音通话">
      <div class="xy-call-glow"></div>
      <div class="xy-call-avatar" aria-hidden="true"><span>砚</span></div>
      <div class="xy-call-name">玄砚</div>
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
    pushBtn.onclick=()=>callRecorder?.state==="recording"?stopFallbackRecording():startFallbackRecording();
    fallbackWrap.querySelector("button").onclick=()=>submitFallback();
    fallbackInput.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitFallback()}};
  }

  function installEntry(){
    if(document.querySelector("#xyCallBtn"))return;
    const header=document.querySelector(".main > header");if(!header)return;
    const btn=document.createElement("button");btn.className="icon-btn xy-call-entry";btn.id="xyCallBtn";btn.type="button";btn.title="语音通话";btn.setAttribute("aria-label","语音通话");
    btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9Z"/></svg>';
    const settings=document.querySelector("#memoryBtn");if(settings)settings.insertAdjacentElement("afterend",btn);else header.appendChild(btn);btn.onclick=()=>ring({source:"manual"});
  }

  function addLine(role,text){
    if(!text)return;
    const row=document.createElement("div");row.className="xy-call-line "+role;
    const who=document.createElement("b");who.textContent=role==="user"?"你":"玄砚";
    const body=document.createElement("span");body.textContent=text;
    row.append(who,body);transcriptEl.appendChild(row);transcriptEl.scrollTop=transcriptEl.scrollHeight;
  }

  function ring(){
    ensureUi();
    if(phase!=="idle")return;
    phase="ringing";processing=false;overlay.hidden=false;overlay.classList.add("show","ringing");overlay.classList.remove("connected");
    transcriptEl.innerHTML="";statusEl.textContent="语音来电";timeEl.textContent="00:00";acceptBtn.hidden=false;hangupBtn.hidden=false;
    fallbackWrap.hidden=true;pushBtn.hidden=true;
    navigator.vibrate?.([180,120,180]);
  }

  async function answer(){
    if(phase!=="ringing")return;
    phase="connected";startedAt=Date.now();overlay.classList.remove("ringing");overlay.classList.add("connected");acceptBtn.hidden=true;statusEl.textContent=SpeechRecognition?"正在接通…":"已接通";
    timerId=setInterval(()=>{if(phase==="connected")timeEl.textContent=fmtTime(Date.now()-startedAt)},500);
    if(!SpeechRecognition){fallbackWrap.hidden=false;pushBtn.hidden=false;statusEl.textContent="已接通 · 点麦克风说话";return}
    await startListening();
  }

  async function startFallbackRecording(){
    if(phase!=="connected"||processing||callNativeRecording||callRecorder?.state==="recording")return;
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
    processing=true;stopListening();addLine("user",text);statusEl.textContent="玄砚在听…";
    const c=currentChat(),before=c?.messages?.length||0,input=document.querySelector("#input");
    if(!c||!input){statusEl.textContent="当前对话不可用";processing=false;return}
    input.value=text;input.dispatchEvent(new Event("input",{bubbles:true}));
    try{
      await send();
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
      if(phase==="connected"){if(SpeechRecognition){statusEl.textContent="正在听…";startListening()}else{statusEl.textContent="点麦克风说话";pushBtn.hidden=false;fallbackWrap.hidden=false}}
    }
  }

  function submitFallback(){
    const text=fallbackInput.value.trim();if(!text)return;fallbackInput.value="";handleUserText(text);
  }

  function hangup(){
    if(phase==="idle")return;
    const duration=startedAt?fmtTime(Date.now()-startedAt):"00:00";
    phase="idle";processing=false;stopListening();if(callNativeRecording){try{window.AevrenVoice?.stopNativeCapture?.()}catch{}callNativeRecording=false}if(callRecorder?.state==="recording"){try{callRecorder.onstop=null;callRecorder.stop()}catch{}}callStream?.getTracks().forEach(track=>track.stop());callStream=null;callRecorder=null;callChunks=[];clearInterval(timerId);timerId=null;window.AevrenVoice?.stop?.();
    statusEl.textContent="通话结束 · "+duration;overlay.classList.remove("ringing","connected");overlay.classList.add("ended");
    setTimeout(()=>{overlay.hidden=true;overlay.classList.remove("show","ended")},650);
  }

  ensureUi();installEntry();
  window.AevrenCall={ring,answer,hangup,getState:()=>({phase,startedAt})};
})();
