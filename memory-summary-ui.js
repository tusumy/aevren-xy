(()=>{
  const KEY="xy.memory-summary.v1",PREF="xy.memory-options.v1";
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||"{}")||{}}catch{return {}}};
  const character=()=>window.xyCurrentCharacter?.()?.id||chat()?.characterId||"xuan-yan";
  const scoped=()=>memories.filter(m=>!m.characterId||m.characterId===character());
  const opts=()=>({auto:true,history:true,...read(PREF)});
  const normalized=s=>String(s||"").trim().replace(/[\s。！!，,]/g,"");
  const privateData=/密码|密钥|api.?key|验证码|银行卡|身份证|病历|诊断|宗教|政治|家庭住址/i;
  const summary=id=>{
    const manual=String(read(KEY)[id]||"").trim();
    if(manual)return manual.slice(0,1800);
    return memories.filter(m=>!m.characterId||m.characterId===id).slice(0,12).map(m=>m.text).filter(Boolean).join("\n").slice(0,1400);
  };
  window.xyMemorySummaryFor=summary;
  function remember(input){
    if(!opts().auto)return;
    const raw=String(input||"").trim();
    if(raw.length<5||raw.length>180||privateData.test(raw))return;
    const match=raw.match(/^(?:(?:请|帮我|你要|以后|务必)\s*)?(?:记住|记一下|以后记得)[：:\s，]*(.{4,160})$/);
    const value=match?.[1]||(/^(?:我喜欢|我不喜欢|以后(?:别|不要|请)|我偏好)/.test(raw)?raw:"");
    if(!value||privateData.test(value)||scoped().some(m=>normalized(m.text)===normalized(value)))return;
    memories.unshift({text:value,tag:"偏好",characterId:character(),createdAt:Date.now(),source:"明确表达"});
    save();renderChats();
  }
  document.addEventListener("click",e=>{if(e.target.closest?.("#sendBtn"))remember(document.querySelector("#input")?.value)},true);
  document.addEventListener("keydown",e=>{if(e.target?.id==="input"&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing)remember(e.target.value)},true);
  const originalRecall=window.xySelectMemories;
  window.xySelectMemories=(ch,q)=>{
    if(!opts().history)return scoped().slice(0,7);
    return typeof originalRecall==="function"?originalRecall(ch,q):scoped().slice(0,7);
  };
  const originalOpen=openPanel;
  const style=document.createElement("style");
  style.textContent=".xy-mem-pane{font-size:13px;color:#526055;display:grid;gap:12px}.xy-mem-pane section{border:1px solid rgba(80,98,85,.15);border-radius:15px;padding:13px;background:#ffffff7d}.xy-mem-pane h3{font-size:14px;margin:0 0 10px}.xy-mem-pane textarea{width:100%;min-height:105px;box-sizing:border-box;padding:10px;border:1px solid #bbc9bd;border-radius:9px;background:#fff;font:inherit;resize:vertical}.xy-mem-pane button{border:1px solid #bdcbbf;border-radius:9px;padding:8px 10px;background:#f9fbf9;color:#435346;cursor:pointer}.xy-mem-pane .row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0}.xy-mem-pane .item{border-top:1px solid #aebaae55;padding:9px 0;overflow-wrap:anywhere}.xy-mem-pane .subtle{font-size:11px;color:#879187}";
  document.head.appendChild(style);
  function panel(){
    originalOpen("memory");
    const host=document.querySelector("#panelBody");if(!host)return;
    host.innerHTML="";
    const outer=document.createElement("div");outer.className="xy-mem-pane";host.appendChild(outer);
    const section=title=>{const s=document.createElement("section");outer.appendChild(s);const h=document.createElement("h3");h.textContent=title;s.appendChild(h);return s};
    const button=(parent,label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;parent.appendChild(b);b.onclick=fn;return b};
    const sum=section("记忆摘要"),area=document.createElement("textarea");area.value=summary(character());sum.appendChild(area);
    const help=document.createElement("p");help.className="subtle";help.textContent="可编辑；空白保存会恢复按当前角色已存记忆生成的摘要。";sum.appendChild(help);
    button(sum,"保存摘要",()=>{const values=read(KEY);if(area.value.trim())values[character()]=area.value.trim().slice(0,1800);else delete values[character()];localStorage.setItem(KEY,JSON.stringify(values));panel()});
    const prefs=section("记忆设置");
    for(const [label,key] of [["自动记录明确要求记住的偏好","auto"],["参考旧聊天","history"]]){
      const row=document.createElement("label");row.className="row";row.textContent=label;const input=document.createElement("input");input.type="checkbox";input.checked=!!opts()[key];row.appendChild(input);
      input.onchange=()=>localStorage.setItem(PREF,JSON.stringify({...opts(),[key]:input.checked}));prefs.appendChild(row);
    }
    const all=section("已保存的记忆 · "+scoped().length);
    button(all,"＋ 添加",()=>{const value=prompt("要保存的记忆");if(!value?.trim())return;memories.unshift({text:value.trim(),tag:"手动",characterId:character()});save();renderChats();panel()});
    for(const item of scoped()){
      const block=document.createElement("div");block.className="item";all.appendChild(block);
      const p=document.createElement("div");p.textContent=item.text;block.appendChild(p);
      const row=document.createElement("div");row.className="row";block.appendChild(row);
      button(row,"编辑",()=>{const value=prompt("修改记忆",item.text);if(value===null)return;item.text=value.trim();save();panel()});
      button(row,"删除",()=>{const i=memories.indexOf(item);if(i>=0){memories.splice(i,1);save();renderChats();panel()}});
    }
  }
  openPanel=type=>type==="memory"?panel():originalOpen(type);
})();
