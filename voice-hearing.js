(()=>{
"use strict";
// Optional integration; only finished recordings are submitted.
const KEY="xy.voice.hearing.v1";
const defaults={ears:false,seven:false,earsUrl:"",sevenUrl:"",accessKey:""};
const config=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...defaults}}};
const limit=(x,n=400)=>String(x??"").trim().slice(0,n);
function valid(raw){
  const url=new URL(String(raw||"").trim(),location.href);
  if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw Error("请使用 HTTPS 声音服务地址");
  if(url.username||url.password||url.search||url.hash)throw Error("声音服务地址不能包含账号或查询参数");
  return url.href.replace(/\/+$/,"");
}
const suffix=b=>b.type.includes("mp4")?"m4a":b.type.includes("wav")?"wav":b.type.includes("ogg")?"ogg":"webm";
async function upload(base,path,field,blob,extra={}){
  if(!blob||blob.size<700||blob.size>18*1024*1024)throw Error("录音过短或过大");
  const data=new FormData();
  data.append(field,blob,"voice."+suffix(blob));
  Object.entries(extra).forEach(([k,v])=>data.append(k,v));
  const signal=AbortSignal.timeout(90000);
  const response=await fetch(valid(base)+path,{method:"POST",body:data,signal,credentials:"omit"});
  const json=await response.json().catch(()=>null);
  if(!response.ok||!json||json.ok===false)throw Error(limit(json?.error||"HTTP "+response.status,160));
  return json;
}
async function listen(blob){
  const c=config();
  if(!c.ears||!c.earsUrl)return null;
  const r=await upload(c.earsUrl,"/api/listen","file",blob);
  if(r.speaker&&!r.text&&!r.baseline_progress)return {blocked:true,transcript:"",summary:"声纹校验未通过，不转写"};
  const parts=[];
  if(r.baseline_progress)parts.push("基线 "+limit(r.baseline_progress,18));
  if(r.relative&&typeof r.relative==="object")parts.push("和平时比："+Object.entries(r.relative).slice(0,5).map(([k,v])=>limit(k,12)+" "+limit(v,25)).join("、"));
  if(r.emotion)parts.push("推测语气："+limit(r.emotion,32));
  if(r.hint)parts.push(limit(r.hint,120));
  if(Array.isArray(r.env_sounds))parts.push("环境声线索："+r.env_sounds.slice(0,4).map(x=>limit(typeof x==="string"?x:x?.label||x?.name,40)).filter(Boolean).join("、"));
  return {transcript:limit(r.text,8000),blocked:false,summary:parts.length?"ears 声音线索（未经确认）："+parts.join("；"):""};
}
async function deepen(blob,transcript){
  const c=config();
  if(!c.seven||!c.sevenUrl)return null;
  const text=limit(transcript,8000);
  const r=await upload(c.sevenUrl,"/analyze","audio",blob,{transcript:text,transcript_source:text?"yanyu":"none",stt:text?"none":"whisper",whisper_model:"small"});
  return {summary:r.card?"Seven Ears 声学分析（非情绪判断）："+limit(r.card,1100):"",transcript:text||limit(typeof r.data?.transcript==="string"?r.data.transcript:r.data?.transcript?.text||"",8000)};
}
const combined=(a,b)=>[a?.summary,b?.summary].filter(Boolean).join("\n").slice(0,1600);
window.xyVoiceHearing={config,listen,deepen,combined};
})();