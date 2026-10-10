(()=>{
  const KEY="xy.contextMessageLimit",DEFAULT=40,MAX=2000;
  const readLimit=()=>{
    const raw=localStorage.getItem(KEY);
    if(raw===null||raw==="")return DEFAULT;
    const n=Number(raw);
    return Number.isSafeInteger(n)&&n>=0&&n<=MAX?n:DEFAULT;
  };
  const label=n=>n===0?"全部消息":"最近 "+n+" 条";
  function updateStats(){
    const sheet=document.querySelector("#xyHeaderMessageStats .xy-header-stats-sheet");
    const field=sheet?.querySelector(".is-highlight b");
    if(field)field.textContent=label(readLimit());
  }
  function inject(){
    const body=document.querySelector("#panelBody");
    if(!body||body.querySelector("#xyContextMessageLimit"))return;
    const card=document.createElement("section");
    card.className="setting-card xy-context-limit-setting";
    card.innerHTML='<div class="xy-context-limit-title">给模型看多少条消息</div>'+
      '<p class="xy-context-limit-hint">每次回复带上最近的聊天消息（包括你和 AI 的消息）。填 0 表示全部；长期记忆、角色提示词仍单独发送。</p>'+
      '<div class="xy-context-limit-row"><label for="xyContextMessageLimit">消息条数</label><input id="xyContextMessageLimit" type="number" inputmode="numeric" min="0" max="2000" step="1"><button type="button" id="xySaveContextLimit">保存</button></div>'+
      '<div id="xyContextLimitStatus" class="xy-context-limit-status" aria-live="polite"></div>';
    const list=body.querySelector("#endpointList");
    if(list)list.before(card);else body.prepend(card);
    const field=card.querySelector("#xyContextMessageLimit"),status=card.querySelector("#xyContextLimitStatus");
    field.value=String(readLimit());
    const persist=()=>{
      const value=field.value.trim();
      const n=Number(value);
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(n)||n<0||n>MAX){
        status.textContent="请输入 0～2000 的整数";return;
      }
      localStorage.setItem(KEY,String(n));
      status.textContent="已保存："+label(n)+"（下次请求生效）";
      updateStats();
    };
    card.querySelector("#xySaveContextLimit").addEventListener("click",persist);
    field.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();persist()}});
  }
  const priorOpenPanel=openPanel;
  openPanel=function(type){
    const result=priorOpenPanel(type);
    if(type==="settings")inject();
    return result;
  };
  window.xyContextWindow={readLimit,label};
})();