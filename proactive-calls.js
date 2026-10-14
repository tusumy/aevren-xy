(()=>{
"use strict";
// Chat models decide whether to plan a future call while the app is open.
// Android subsequently delivers that call independently of the WebView.
const KEY="xy.proactive.planner.v1",PLAN_INTERVAL=4*60*60*1000;
let busy=false;
const bridge=()=>window.AevrenCallNative;
const safe=(s,n=200)=>String(s??"").trim().slice(0,n);
function local(){
  try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");return x&&typeof x==="object"?x:{}}catch{return {}}
}
const persist=x=>localStorage.setItem(KEY,JSON.stringify(x));
function nativeResult(method,...args){
  const fn=bridge()?.[method];
  if(typeof fn!=="function")return {ok:false,error:"native_unavailable"};
  try{return JSON.parse(fn.apply(bridge(),args))}catch(e){return {ok:false,error:String(e?.message||e)}}
}
function state(){return nativeResult("getProactiveState")}
function lastCharacters(c){
  const items=(c?.messages||[]).filter(x=>(x.role==="user"||x.role==="assistant")&&x.text&&!x.localOnly).slice(-12);
  return items.map(m=>({role:m.role,content:safe(m.text,500)}));
}
function endpoint(raw){
  const b=String(raw||"").trim().replace(/\/$/,"");
  if(!b)return "";
  if(b.endsWith("#"))return b.slice(0,-1);
  try{
    const u=new URL(b),p=u.pathname.replace(/\/$/,"");
    if(/\/(?:chat\/completions|responses)$/i.test(p))return b;
    if(!p||p==="/")return b+"/v1/chat/completions";
    if(/\/v1$/i.test(p))return b+"/chat/completions";
  }catch{}
  return b;
}
function responseText(data){
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==="string")return content;
  if(Array.isArray(content))return content.map(x=>x?.text||"").join("\n");
  if(typeof data?.output_text==="string")return data.output_text;
  if(Array.isArray(data?.content))return data.content.map(x=>x?.text||"").join("\n");
  if(Array.isArray(data?.output))return data.output.flatMap(x=>x?.content||[]).map(x=>x?.text||"").join("\n");
  return "";
}
function decision(raw){
  const s=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  let result;
  try{result=JSON.parse(s)}catch{
    const a=s.indexOf("{"),b=s.lastIndexOf("}");
    if(a<0||b<a)throw Error("模型没有返回来电决策 JSON");
    result=JSON.parse(s.slice(a,b+1));
  }
  if(!result||typeof result!=="object"||typeof result.call!=="boolean")throw Error("来电决策内容无效");
  return {call:result.call,afterMinutes:Math.max(90,Math.min(720,Math.round(Number(result.afterMinutes)||180)))};
}
function currentCharacter(c){
  let characters=[];
  try{characters=JSON.parse(localStorage.getItem("xy.characters")||"[]")}catch{}
  const id=String(c?.characterId||window.xyCurrentCharacter?.()?.id||"");
  return characters.find(x=>String(x.id)===id)||window.xyCurrentCharacter?.();
}
function showSettings(){
  const host=document.querySelector("#panelBody");
  if(!host||host.querySelector("#xyProactiveSettings"))return;
  const section=document.createElement("section");
  section.className="setting-card xy-proactive-settings";
  section.id="xyProactiveSettings";
  section.innerHTML='<label class="xy-proactive-label"><span><strong>AI 主动来电 · Android 实验功能</strong><small>开启后，角色会根据最近聊天判断是否安排未来来电。由安卓后台响铃，无需你先按拨号；每天最多一次，22:00–09:00 不打扰。</small></span><input type="checkbox" id="xyProactiveEnabled"></label>'+
    '<p class="xy-proactive-state" id="xyProactiveStatus"></p>'+
    '<p class="xy-proactive-info">默认关闭。开启后每隔至少四小时才会再次请求模型做决定；每次判断会发送最近最多十二条文字聊天并产生额外 API 费用。关闭后会取消未发生的来电。安卓系统可能延迟通知或限制锁屏弹窗。</p>';
  host.appendChild(section);
  const check=section.querySelector("#xyProactiveEnabled"),status=section.querySelector("#xyProactiveStatus");
  function update(message=""){
    const x=state();
    check.checked=!!x.enabled;
    check.disabled=x.error==="native_unavailable";
    const info=x.error==="native_unavailable"?"此功能需要安装新版 Android APK，网页版不能在关闭后发出来电。":
      !x.notificationsAllowed?"请先授予砚屿通知权限。":
      x.enabled?(x.scheduledAt?"已安排来电："+new Date(x.scheduledAt).toLocaleString("zh-CN",{hour12:false}):"已开启，角色将在聊天后自主判断是否需要打来。"):"当前关闭";
    status.textContent=message||info;
  }
  check.addEventListener("change",()=>{
    const val=check.checked;
    const result=nativeResult("setProactiveEnabled",val);
    if(!result.ok){
      update(result.error==="notification_permission_requested"?"已请求通知权限，请允许后重新开启开关。":"无法启用："+(result.error||"未知原因"));
      return;
    }
    const cfg=local();cfg.enabled=val;persist(cfg);
    update();
    if(val)queueAfterReply(typeof chat==="function"?chat():null,true);
  });
  update();
}
const css=document.createElement("style");
css.textContent=".xy-proactive-settings{display:grid;gap:12px}.xy-proactive-label{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.xy-proactive-label span{display:grid;gap:6px}.xy-proactive-label small,.xy-proactive-info{font-size:11px;line-height:1.6;color:var(--muted,#829187)}.xy-proactive-label input{width:18px;height:18px;flex:none;accent-color:#365b49}.xy-proactive-state{font-size:12px;color:var(--ink,#53665b);background:#eaf1e9;border-radius:9px;padding:9px;margin:0}";
document.head.appendChild(css);
async function choose(c,force=false){
  if(busy||!c?.id)return;
  const cur=state();
  if(cur.error||!cur.enabled||!cur.notificationsAllowed)return;
  if(cur.scheduledAt&&cur.scheduledAt>Date.now())return;
  if(cur.lastCallAt&&Date.now()-cur.lastCallAt<20*60*60*1000)return;
  const history=lastCharacters(c);
  if(history.length<3||!history.some(x=>x.role==="user")||!history.some(x=>x.role==="assistant"))return;
  const character=currentCharacter(c);
  if(!character?.id||String(character.id)!==String(c.characterId))return;
  const storage=local(),key=String(character.id),since=Number(storage[key]||0);
  if(!force&&Date.now()-since<PLAN_INTERVAL)return;
  if(!force)storage[key]=Date.now(); // throttle even unsuccessful attempts
  else storage[key]=Date.now();
  persist(storage);
  const ep=(typeof endpoints!=="undefined"?endpoints:[]).find(x=>x.active)||endpoints?.[0];
  if(!ep?.base||!ep.model)return;
  busy=true;
  try{
    const request={
      model:ep.model,stream:false,max_tokens:170,temperature:0.65,
      messages:[
        {role:"system",content:"你是聊天中的角色「"+safe(character.name,60)+"」。根据近期你和对方的真实交流，判断你是否真想在今天稍后主动打一次语音电话。允许拒绝打电话。你有自己的好奇、想念或想主动分享的话题时可以选择拨打，普通对话不必硬凑理由。不为提醒健康、紧急事件等假装来电，也不要泄露隐私。只能返回严格 JSON：{\"call\":true或false,\"afterMinutes\":90到720的整数}；不要其他解释。客户端会自动避开22:00到09:00，并限制来电次数。"},
        {role:"user",content:"最近聊天记录（只是参考，不要复述）：\n"+history.map(x=>(x.role==="assistant"?"你":"对方")+"："+x.content).join("\n")}
      ]};
    const headers={"Content-Type":"application/json",Accept:"application/json"};
    if(ep.key)headers.Authorization="Bearer "+ep.key;
    const response=await fetch(endpoint(ep.base),{method:"POST",headers,body:JSON.stringify(request)});
    const raw=await response.text();let data;
    try{data=JSON.parse(raw)}catch{throw Error("来电决策接口未返回 JSON")}
    if(!response.ok||data?.error)throw Error(data?.error?.message||"HTTP "+response.status);
    const outcome=decision(responseText(data));
    if(outcome.call){
      const result=nativeResult("scheduleProactiveCall",String(character.id),String(character.name),Date.now()+outcome.afterMinutes*60000);
      if(!result.ok)throw Error("安卓排程失败："+(result.error||"unknown"));
    }
    storage.lastDecision=Date.now();storage.lastDecisionCalled=outcome.call;storage.lastError="";persist(storage);
  }catch(e){const r=local();r.lastError=safe(e?.message||e,200);persist(r);console.warn("[砚屿] 主动来电排程：",r.lastError)}
  finally{busy=false}
}
function queueAfterReply(c,force=false){
  // Never hold up the visible chat reply or change any current chat data.
  Promise.resolve().then(()=>choose(c,force)).catch(()=>{});
}
const prevOpen=openPanel;
openPanel=function(type){
  const result=prevOpen(type);
  if(type==="settings")requestAnimationFrame(showSettings);
  return result;
};
window.xyProactiveCalls={afterReply:queueAfterReply,decide:choose,state};
})();