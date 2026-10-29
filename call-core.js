(()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let phase="idle",recognition=null,startedAt=0,timerId=null,processing=false,restartTimer=null;
  let callRecorder=null,callStream=null,callChunks=[],callNativeRecording=false,callNativeRecognizing=false;
  let overlay,statusEl,timeEl,transcriptEl,acceptBtn,hangupBtn,fallbackWrap,fallbackInput,pushBtn,modeBtn;
  let callCharacter=null,callUseNative=false,nativeAutoTimer=null,nativeReadyTimer=null,callGeneration=0,callChat=null,callLines=[],missedSpeech=0,nativeBusyRetries=0,nativeTimeouts=0,nativeSpeechReady=false;
  let forceRecordedStt=false;
  let ambience=null,ambienceEvents=[],recordingHearingSummary="";
  let ringtoneContext=null,ringtoneTimer=null;
  function stopRingtone(){
    if(ringtoneTimer){clearInterval(ringtoneTimer);ringtoneTimer=null}
    if(ringtoneContext){try{ringtoneContext.close?.()}catch{}ringtoneContext=null}
  }
  function startRingtone(){
    stopRingtone();
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    try{
      const ctx=new Ctx();ringtoneContext=ctx;
      ctx.resume?.().catch?.(()=>{});
      const pulse=()=>{
        if(phase!=="ringing")return stopRingtone();
        const t=ctx.currentTime;
        for(const freq of [440,480]){
          const wave=ctx.createOscillator(),gain=ctx.createGain();
          wave.type="sine";wave.frequency.value=freq;
          gain.gain.setValueAtTime(0.0001,t);
          gain.gain.exponentialRampToValueAtTime(0.017,t+0.03);
          gain.gain.setValueAtTime(0.017,t+0.68);
          gain.gain.exponentialRampToValueAtTime(0.0001,t+0.85);
          wave.connect(gain).connect(ctx.destination);
          wave.start(t);wave.stop(t+0.87);
        }
      };
      pulse();ringtoneTimer=setInterval(pulse,2300);
    }catch(e){stopRingtone();console.warn("砚屿来电铃声未启动",e)}
  }

  const nativeAcousticLimit=3;
  window.__xyNativeAcousticEvent=label=>{
    if(phase!=="connected"||!callUseNative)return;
    const cue=String(label||"").slice(0,160);
    if(!cue||ambienceEvents.includes(cue)||ambienceEvents.length>=nativeAcousticLimit)return;
    ambienceEvents.push(cue);
  };

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
      <div class="xy-call-glow" aria-hidden="true"></div>
      <div class="xy-call-topline"><span>AEVREN XY <span aria-hidden="true">·</span> VOICE</span><i aria-hidden="true"></i></div>
      <div class="xy-call-identity">
        <div class="xy-call-avatar" aria-hidden="true"><span>角</span></div>
        <div class="xy-call-name">角色</div>
        <div class="xy-call-status" role="status" aria-live="polite">语音来电</div>
        <div class="xy-call-time">00:00</div>
      </div>
      <div class="xy-call-transcript" role="log" aria-live="polite" aria-label="通话字幕"></div>
      <button type="button" class="xy-call-mode" hidden aria-label="切换语音输入方式"><span>改用按键说话</span></button>
      <button type="button" class="xy-call-push" hidden aria-label="按一下开始或结束说话">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7"></path></svg><span>说话</span>
      </button>
      <div class="xy-call-fallback" hidden><input type="text" placeholder="也可以在这里输入" aria-label="输入通话内容"><button type="button">发送</button></div>
      <div class="xy-call-actions">
        <button type="button" class="xy-call-answer" aria-label="接听">
          <span class="xy-call-button-disc" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.3 3.7c-.7-.5-1.7-.4-2.3.2l-1.2 1.3C.8 7.3 4 13 8.2 17.2s9.9 7.4 12 5.4l1.3-1.2c.6-.6.7-1.6.2-2.3l-2.7-3.5c-.6-.7-1.6-.9-2.4-.4l-2.1 1.3c-2.6-1.4-4.7-3.5-6.1-6.1l1.3-2.1c.5-.8.3-1.8-.4-2.4L6.3 3.7Z" transform="translate(1 -1) scale(.91)"></path></svg></span><span>接听</span>
        </button>
        <button type="button" class="xy-call-hangup" aria-label="挂断">
          <span class="xy-call-button-disc" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.3 3.7c-.7-.5-1.7-.4-2.3.2l-1.2 1.3C.8 7.3 4 13 8.2 17.2s9.9 7.4 12 5.4l1.3-1.2c.6-.6.7-1.6.2-2.3l-2.7-3.5c-.6-.7-1.6-.9-2.4-.4l-2.1 1.3c-2.6-1.4-4.7-3.5-6.1-6.1l1.3-2.1c.5-.8.3-1.8-.4-2.4L6.3 3.7Z" transform="translate(1 -1) scale(.91)"></path></svg></span><span>挂断</span>
        </button>
      </div>
      <div class="xy-call-ending-label">ONLY OURS · 只属于我们的声音</div>
    </div>`;
    document.body.appendChild(overlay);
    statusEl=overlay.querySelector(".xy-call-status");timeEl=overlay.querySelector(".xy-call-time");
    transcriptEl=overlay.querySelector(".xy-call-transcript");acceptBtn=overlay.querySelector(".xy-call-answer");hangupBtn=overlay.querySelector(".xy-call-hangup");
    fallbackWrap=overlay.querySelector(".xy-call-fallback");fallbackInput=fallbackWrap.querySelector("input");pushBtn=overlay.querySelector(".xy-call-push");modeBtn=overlay.querySelector(".xy-call-mode");
    acceptBtn.onclick=answer;hangupBtn.onclick=hangup;
    pushBtn.onclick=()=>callNativeRecognizing||callNativeRecording||callRecorder?.state==="recording"?stopFallbackRecording():startFallbackRecording();
    modeBtn.onclick=()=>{
      if(phase!=="connected"||processing)return;
      if(callUseNative||recognition)fallbackToManual("已切换为按键说话");
      else retryAutomaticSpeech();
    };
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
    if(phase==="connected"&&callLines.length<160)callLines.push({role,text:String(text).slice(0,1200)});
  }

  function ring(payload, options={}){
    ensureUi();
    if(phase!=="idle")return;
    const active=activeCharacter(),incoming=payload&&typeof payload==="object"?payload:{};
    callCharacter={
      id:String(incoming.id||active.id||"xuan-yan"),
      name:String(incoming.name||active.name||"玄砚")
    };
    syncCallCharacter();
    callChat=currentChat();callLines=[];ambienceEvents=[];recordingHearingSummary="";missedSpeech=0;nativeBusyRetries=0;forceRecordedStt=false;startedAt=0;
    callGeneration++;phase="ringing";processing=false;callUseNative=false;nativeSpeechReady=false;nativeTimeouts=0;overlay.hidden=false;overlay.classList.add("show","ringing");overlay.classList.remove("connected");
    transcriptEl.innerHTML="";statusEl.textContent="语音来电";timeEl.textContent="00:00";acceptBtn.hidden=false;hangupBtn.hidden=false;
    fallbackWrap.hidden=true;pushBtn.hidden=true;modeBtn.hidden=true;
    navigator.vibrate?.([180,120,180]);
    if(options.nativeAccepted!==true)startRingtone();
  }

  function clearNativeReadyTimer(){
    if(nativeReadyTimer!==null)clearTimeout(nativeReadyTimer);
    nativeReadyTimer=null;
  }
  function updateCallMode(){
    if(!modeBtn)return;
    modeBtn.hidden=phase!=="connected";
    modeBtn.querySelector("span").textContent=callUseNative?"改用按键说话":"重试自动识别";
  }
  function retryAutomaticSpeech(){
    if(phase!=="connected"||processing)return;
    if(!window.AevrenVoice?.hasNativeRecognition?.()){
      statusEl.textContent="系统自动识别不可用 · 可用说话按钮或文字输入";return;
    }
    clearNativeReadyTimer();clearTimeout(nativeAutoTimer);nativeAutoTimer=null;stopListening();
    nativeBusyRetries=0;nativeTimeouts=0;missedSpeech=0;nativeSpeechReady=false;
    callUseNative=true;callNativeRecognizing=false;forceRecordedStt=false;
    window.AevrenVoice?.cancelNativeRecognition?.();
    window.AevrenVoice?.onRecognitionProgress?.(voiceStage);
    pushBtn.hidden=true;fallbackWrap.hidden=true;
    updateCallMode();
    statusEl.textContent="正在连接麦克风…";
    scheduleNativeListening(450);
  }
  function voiceStage({stage,detail}={}){
    if(phase!=="connected"||!callUseNative||processing)return;
    if(stage==="starting")statusEl.textContent="正在启动语音识别…";
    if((stage==="state"&&["ready","speech"].includes(detail))||(stage==="partial"&&detail)){
      nativeSpeechReady=true;clearNativeReadyTimer();
    }
    if(stage==="state"&&detail==="ready")statusEl.textContent="麦克风已就绪 · 请说话";
    if(stage==="state"&&detail==="speech")statusEl.textContent="已检测到你说话 · 正在听";
    if(stage==="state"&&detail==="processing")statusEl.textContent="已收到声音 · 正在转成文字";
    if(stage==="partial"&&detail)statusEl.textContent="听到："+detail.slice(0,24);
    if(stage==="result"&&detail)statusEl.textContent="已识别："+detail.slice(0,24);
  }
  function fallbackToManual(reason){
    if(phase!=="connected")return;
    clearNativeReadyTimer();clearTimeout(nativeAutoTimer);nativeAutoTimer=null;stopListening();
    // Cancellation rejects the pending recognizer; disable auto before cancelling
    // so its handler cannot secretly resume the failed speech loop.
    callUseNative=false;callNativeRecognizing=false;nativeSpeechReady=false;nativeTimeouts=0;
    forceRecordedStt=true;
    window.AevrenVoice?.cancelNativeRecognition?.();
    window.AevrenVoice?.onRecognitionProgress?.(null);
    pushBtn.hidden=false;fallbackWrap.hidden=false;
    pushBtn.classList.remove("recording");
    pushBtn.querySelector("span").textContent="说话";
    updateCallMode();
    statusEl.textContent=reason+" · 点击说话或输入文字";
  }

  async function answer(){
    if(phase!=="ringing")return;
    stopRingtone();
    try{window.AevrenCallNative?.dismissIncomingCall?.()}catch{}
    phase="connected";startedAt=Date.now();overlay.classList.remove("ringing");overlay.classList.add("connected");acceptBtn.hidden=true;statusEl.textContent=SpeechRecognition?"正在接通…":"已接通";
    timerId=setInterval(()=>{if(phase==="connected")timeEl.textContent=fmtTime(Date.now()-startedAt)},500);
    updateCallMode();
    if(window.AevrenVoice?.hasNativeRecognition?.()){retryAutomaticSpeech();return}
    if(!SpeechRecognition){fallbackToManual("系统自动语音识别不可用");return}
    // Keep manual controls available even if WebView reports a broken recognizer.
    forceRecordedStt=false;pushBtn.hidden=false;fallbackWrap.hidden=false;
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
    const generation=callGeneration;
    callNativeRecognizing=true;nativeSpeechReady=false;statusEl.textContent="麦克风识别准备中…";
    clearNativeReadyTimer();
    nativeReadyTimer=setTimeout(()=>{
      nativeReadyTimer=null;
      if(generation!==callGeneration||phase!=="connected"||!callUseNative||!callNativeRecognizing||nativeSpeechReady)return;
      fallbackToManual("系统麦克风没有响应");
    },9000);
    try{
      const text=String(await window.AevrenVoice.recognizeNativeOnce({allowActivityFallback:false})).trim();
      clearNativeReadyTimer();callNativeRecognizing=false;
      if(phase!=="connected"||!callUseNative||generation!==callGeneration)return;
      nativeBusyRetries=0;nativeTimeouts=0;
      if(text){missedSpeech=0;await handleUserText(text)}
      else{
        missedSpeech++;
        statusEl.textContent="正在听…";
        scheduleNativeListening(missedSpeech<6?700:1800);
      }
    }catch(error){
      clearNativeReadyTimer();callNativeRecognizing=false;
      if(phase!=="connected"||!callUseNative||generation!==callGeneration)return;
      const code=String(error?.message||error);
      if(["already_listening","speech_busy","speech_error_8","speech_cancelled"].includes(code)){
        // Recover the native microphone rather than forcing a tap on "说话".
        nativeBusyRetries++;
        window.AevrenVoice?.cancelNativeRecognition?.();
        if(nativeBusyRetries<=2){
          statusEl.textContent="麦克风正在恢复…";
          return scheduleNativeListening(700+nativeBusyRetries*350);
        }
        return fallbackToManual("系统麦克风一直被占用");
      }
      if(code==="speech_timeout"){
        nativeTimeouts++;
        if(nativeTimeouts>=2)return fallbackToManual("语音识别连续超时");
        statusEl.textContent="语音识别超时，重试一次…";
        return scheduleNativeListening(700);
      }
      if(code==="speech_no_match"){
        nativeBusyRetries=0;missedSpeech++;
        statusEl.textContent="正在听…";
        return scheduleNativeListening(missedSpeech<6?750:1800);
      }
      if(code==="permission_requested"||code==="speech_permission"){
        return fallbackToManual("请允许麦克风权限");
      }
      fallbackToManual("自动语音识别失败："+code.slice(0,50));
    }
  }

  async function startFallbackRecording(){
    if(phase!=="connected"||processing||callNativeRecognizing||callNativeRecording||callRecorder?.state==="recording")return;
    if(!forceRecordedStt&&window.AevrenVoice?.hasNativeRecognition?.()){
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
        statusEl.textContent=code==="permission_requested"?"请允许麦克风权限，再点一次":"系统识别失败："+code.slice(0,60);
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
      ambience=window.xyAcousticEvents?.start?.(callStream)||null;
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
      const detected=await window.xyAcousticEvents?.analyzeBlob?.(blob).catch(()=>[])||[];
      ambienceEvents=[...new Set([...ambienceEvents,...detected])].slice(0,3);
      let heard=null;
      try{heard=await window.xyVoiceHearing?.listen?.(blob)||null}
      catch(error){console.warn("ears service unavailable",error)}
      if(heard?.blocked){processing=false;statusEl.textContent="声纹未通过，不再转写";return}
      const text=heard?.transcript||await window.AevrenVoice.transcribeBlob(blob);
      recordingHearingSummary=heard?.summary||"";
      processing=false;
      if(phase!=="connected")return;
      if(text){statusEl.textContent="录音已转写 · 正在发给角色";await handleUserText(text)}
      else statusEl.textContent="语音转写没有返回文字 · 请检查转写模型";
    }catch(error){
      processing=false;
      if(phase==="connected")statusEl.textContent="录音转写失败："+String(error?.message||error).slice(0,85);
    }
  }

  async function finishFallbackRecording(){
    const type=callRecorder?.mimeType||callChunks[0]?.type||"audio/webm";
    const blob=new Blob(callChunks,{type});
    if(ambience){ambienceEvents=ambience.stop()||[];ambience=null}
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
    processing=true;stopListening();addLine("user",text);statusEl.textContent="已识别文字 · 正在发给"+currentCallName();
    const detected=ambienceEvents.splice(0,3);
    const heard=recordingHearingSummary;recordingHearingSummary="";
    const extras=[];
    if(detected.length)extras.push("[麦克风声学线索（来源未确认）："+detected.join("；")+"]");
    if(heard)extras.push("[本次录音的耳朵分析（仅供参考）："+heard.slice(0,650)+"]");
    const reported=extras.length?text+"\n"+extras.join("\n"):text;
    const c=currentChat(),before=c?.messages?.length||0;
    if(!c){statusEl.textContent="当前对话不可用";processing=false;return}
    const generation=callGeneration;
    let voiceProblem=false;
    try{
      // Call turns go straight to the chat model without touching a typed draft or the 10s chat queue.
      if(!window.AevrenApiCompat?.send)throw new Error("聊天接口未就绪");
      await window.AevrenApiCompat.send({__xyCall:true,text:reported});
      if(phase!=="connected"||generation!==callGeneration)return;
      statusEl.textContent="已发给角色 · 正在等待回复";
      const idx=c.messages.findLastIndex((m,i)=>i>=before&&m.role==="assistant");
      if(idx>=0){
        const reply=String(c.messages[idx].text||"").trim();
        if(reply&&!/^请求失败[:：]/.test(reply)){
          addLine("assistant",reply);
          statusEl.textContent=currentCallName()+"正在说…";
          if(!window.AevrenVoice?.isSpeaking?.())await window.AevrenVoice?.speakMessage?.(idx,c,()=>phase==="connected"&&generation===callGeneration);
          if(phase!=="connected"||generation!==callGeneration)return;
          voiceProblem=!window.AevrenVoice?.isSpeaking?.();
          if(!voiceProblem)await waitForVoice();
        }else if(reply){addLine("assistant",reply)}
      }
    }catch(error){if(phase==="connected"&&generation===callGeneration)addLine("assistant","通话发送失败："+(error?.message||error))}
    finally{
      if(generation===callGeneration){
        processing=false;
        if(phase==="connected"){
          statusEl.textContent=voiceProblem?"回复已收到 · 声音播放失败，请检查语音设置":"正在听…";
          if(callUseNative)scheduleNativeListening();
          else if(!forceRecordedStt&&SpeechRecognition)startListening();
          else{pushBtn.hidden=false;fallbackWrap.hidden=false}
        }
      }
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
    // The current saved character name is authoritative, even if a scheduled
    // incoming-call payload still contains the former display name.
    let savedCharacter;
    try{
      const all=JSON.parse(localStorage.getItem("xy.characters")||"[]");
      savedCharacter=Array.isArray(all)?all.find(ch=>String(ch?.id)===id):null;
    }catch{}
    const name=String(savedCharacter?.name||(id===String(active.id)?active.name:"")||incoming.name||"角色");
    try{
      const saved=JSON.parse(localStorage.getItem("xy.avatars")||"{}");
      bridge.setCharacterAvatar?.(id,String(saved?.characters?.[id]||""));
    }catch{}
    return parseNativeCallResult(bridge.showIncomingCall(id,name));
  }

  async function acceptNativeCall(payload){
    if(phase!=="idle")hangup();
    const callerId=String(payload?.id||"");
    // A planned call may belong to a different character than the chat
    // currently on screen. Switch before opening the call dialogue.
    if(callerId&&callerId!==String(activeCharacter()?.id||"")&&typeof chats!=="undefined"){
      let chosen=chats.find(c=>String(c.characterId||"")===callerId);
      if(!chosen){
        chosen={id:Date.now(),title:String(payload?.name||"角色")+"来电",characterId:callerId,messages:[]};
        chats.unshift(chosen);
      }
      current=chosen.id;
      save();renderChats();renderMessages();
    }
    // Android already played its own ringtone and presented the native
    // incoming call screen; do not replay the web double-tone on answer.
    ring(payload,{nativeAccepted:true});
    await answer();
  }

  function hangup(){
    stopRingtone();
    try{window.AevrenCallNative?.dismissIncomingCall?.()}catch{}
    if(phase==="idle")return;
    const wasConnected=phase==="connected";
    const duration=startedAt?fmtTime(Date.now()-startedAt):"00:00";
    const recordChat=callChat,recordCharacter={...currentCallCharacter()},recordStartedAt=startedAt,recordEndedAt=Date.now();
    const transcript=callLines.slice();
    callGeneration++;phase="idle";processing=false;callUseNative=false;forceRecordedStt=false;clearNativeReadyTimer();nativeTimeouts=0;modeBtn.hidden=true;
    if(ambience){ambience.stop();ambience=null}ambienceEvents=[];recordingHearingSummary="";
    window.AevrenVoice?.onRecognitionProgress?.(null);clearTimeout(nativeAutoTimer);nativeAutoTimer=null;stopListening();try{window.AevrenVoice?.cancelNativeRecognition?.()}catch{}callNativeRecognizing=false;if(callNativeRecording){try{window.AevrenVoice?.stopNativeCapture?.()}catch{}callNativeRecording=false}if(callRecorder?.state==="recording"){try{callRecorder.onstop=null;callRecorder.stop()}catch{}}callStream?.getTracks().forEach(track=>track.stop());callStream=null;callRecorder=null;callChunks=[];clearInterval(timerId);timerId=null;window.AevrenVoice?.stop?.();
    if(wasConnected&&recordChat?.messages){
      recordChat.messages.push({role:"system",kind:"call",text:"☎ 与"+String(recordCharacter.name||"角色")+"通话 · "+duration,
        characterName:String(recordCharacter.name||"角色"),characterId:String(recordCharacter.id||""),
        duration,startedAt:recordStartedAt,endedAt:recordEndedAt,transcript,createdAt:recordEndedAt});
      try{save();renderChats();renderMessages()}catch(error){console.warn("call_history_save_failed",error)}
    }
    statusEl.textContent="通话结束 · "+duration;overlay.classList.remove("ringing","connected");overlay.classList.add("ended");
    const finishedGeneration=callGeneration;
    setTimeout(()=>{if(phase==="idle"&&finishedGeneration===callGeneration){overlay.hidden=true;overlay.classList.remove("show","ended");callCharacter=null;callChat=null;callLines=[]}},650);
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
