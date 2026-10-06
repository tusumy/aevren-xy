(()=>{
  const DEFAULTS={
    voiceMode:"system",
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
    utter.lang="zh-CN";
    activeMessage=key;decorateMessages();
    utter.onend=()=>{if(activeMessage===key){activeMessage=null;decorateMessages()}};
    utter.onerror=()=>{if(activeMessage===key){activeMessage=null;decorateMessages()}};
    window.speechSynthesis.speak(utter);
  }