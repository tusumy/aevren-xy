(()=>{
"use strict";
// Immediate, opt-in calls decided inside an ordinary model reply.
// No delayed AI-call bookings and no separate LLM request per reply.
const KEY="xy.proactive.planner.v1",MIGRATION="xy.proactive.instant.v1";
const bridge=()=>window.AevrenCallNative;
const character=()=>{try{return window.xyCurrentCharacter?.()||{}}catch{return {}}};
const safe=(s,n)=>String(s??"").trim().slice(0,n);
const parseNative=raw=>{try{return typeof raw==="string"?JSON.parse(raw):raw||{}}catch(e){return {ok:false,error:String(e)}}};
const state=()=>{try{return bridge()?.getProactiveState?parseNative(bridge().getProactiveState()):{native:false,enabled:false}}catch{return {native:false,enabled:false}}};
const enabled=()=>state().enabled===true;
let pendingMigration=false;
function stopOldReservations(){
  const b=bridge(),st=state();
  if(!b||!st.enabled||!st.scheduledAt||pendingMigration)return;
  try{if(localStorage.getItem(MIGRATION)==="1")return}catch{}
  pendingMigration=true;
  try{
    const off=parseNative(b.setProactiveEnabled(false));
    const on=parseNative(b.setProactiveEnabled(true));
    if(off.ok&&on.ok)localStorage.setItem(MIGRATION,"1");
  }catch(error){console.warn("[砚屿] 取消旧预约失败",error)}
  finally{pendingMigration=false}
}
function instruction(){
  if(!enabled())return "";
  return [
    "砚屿即时通话：你可以主动给对方打电话。仅当你根据此刻真实对话，确实想立刻改为语音交流时，自行做出决定并在正常回复的最后单独附上这个标记：",
    '⟦call{"action":"ring"}⟧',
    "客户端看见有效标记就会马上响起来电，由对方决定接听或拒绝；不要请求对方先拨，不预约未来时间，不需要先问她能否拨号。",
    "这个标记完全可选，不能为了完成任务每轮都拨。只在你自己确实想现在打电话时才使用。每次最多一条，不解释标记。",
    "如果另有心音 ⟦heart...⟧ 或快捷选项 ⟦opts...⟧，把来电标记放在它们之后。"
  ].join("\n");
}
function extract(raw){
  let call=false;
  const text=String(raw??"").replace(/⟦call\s*(\{[^⟧]*\})\s*⟧/g,(original,json)=>{
    try{const payload=JSON.parse(json);if(payload?.action==="ring")call=true}catch{}
    return "";
  }).replace(/⟦call[\s\S]*?⟧/g,"").replace(/\n{3,}/g,"\n\n").trim();
  return {text,call};
}
function ringNow(c){
  if(!enabled()||!c||typeof chat!=="function"||chat()!==c||window.xyRegenerating===true)return false;
  const api=window.AevrenCall;
  if(!api?.ring||api?.getState?.()?.phase!=="idle")return false;
  const ch=character();
  const id=String(c.characterId||ch.id||"xuan-yan");
  const name=safe(ch.name||"角色",80);
  const payload={id,name};
  // Keep a single call surface. Foreground: in-app ringing screen.
  // If the user backgrounded the app while the reply was loading, prefer
  // Android's existing native incoming-call notification instead.
  if(document.visibilityState==="hidden"&&api.nativeIncomingCall){
    try{if(api.nativeIncomingCall(payload)?.ok)return true}
    catch(error){console.warn("[砚屿] 后台来电通知不可用：",error)}
  }
  api.ring(payload);
  return true;
}
function showSettings(){
  const body=document.querySelector("#panelBody");
  if(!body||body.querySelector("#xyProactiveSettings"))return;
  const section=document.createElement("section");
  section.className="setting-card xy-proactive-settings";
  section.id="xyProactiveSettings";
  section.innerHTML='<label class="xy-proactive-label"><span><strong>聊天中 AI 主动来电</strong><small>角色聊着聊着想打电话，就能立即拨过来。不必等预约时间，也不限制每天通数。</small></span><input type="checkbox" id="xyProactiveEnabled"></label>'+
    '<p class="xy-proactive-state" id="xyProactiveStatus"></p>'+
    '<p class="xy-proactive-info">需开启后才允许角色主动拨号。关闭时不触发来电。模型只在普通聊天回复时做决定，不额外请求模型判断。锁屏或完全退出后自主发起的新来电，仍需后续接入后台推送。</p>';
  body.appendChild(section);
  const input=section.querySelector("#xyProactiveEnabled");
  const status=section.querySelector("#xyProactiveStatus");
  function refresh(message){
    const st=state();input.checked=!!st.enabled;
    input.disabled=st.native!==true;
    status.textContent=message||(st.native!==true?"请在砚屿 Android APK 中使用这个功能。":
      !st.notificationsAllowed?"需要允许通知权限（聊天时仍会显示应用内界面）。":
      st.enabled?"已开启。角色可以在聊天过程中自行立即拨号。":"当前关闭");
  }
  input.addEventListener("change",()=>{
    const st=state();
    const b=bridge();
    if(!b?.setProactiveEnabled){refresh();return}
    const v=!!input.checked;
    const result=parseNative(b.setProactiveEnabled(v));
    if(!result.ok){
      refresh(result.error==="notification_permission_requested"?"请先允许通知权限，再开启主动来电。":"设置失败："+safe(result.error,100));
      return;
    }
    // Disable/enable also clears previously scheduled calls in old versions.
    if(v)localStorage.setItem(MIGRATION,"1");
    refresh();
  });
  refresh();
}
const css=document.createElement("style");
css.textContent=".xy-proactive-settings{display:grid;gap:12px}.xy-proactive-label{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.xy-proactive-label span{display:grid;gap:6px}.xy-proactive-label small,.xy-proactive-info{font-size:11px;line-height:1.6;color:var(--muted,#829187)}.xy-proactive-label input{width:18px;height:18px;flex:none;accent-color:#365b49}.xy-proactive-state{font-size:12px;color:var(--ink,#53665b);background:#eaf1e9;border-radius:9px;padding:9px;margin:0}";
document.head.appendChild(css);
const oldPanel=openPanel;
openPanel=function(type){const r=oldPanel(type);if(type==="settings")requestAnimationFrame(showSettings);return r};
window.xyProactiveCalls={enabled,state,instruction,extract,ringNow,afterReply:()=>{}};
stopOldReservations();
})();