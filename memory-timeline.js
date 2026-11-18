(()=>{
"use strict";
// Chronological, character-scoped memory. No model requests and no retroactive
// invented timestamps: only capture a successfully completed exchange.
const KEY="xy.memory-timeline.v1", PREF="xy.memory-timeline-options.v1", LIMIT=500;
const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
// Put existing installs into manual-only mode once. Preserve all archived
// entries, and let the user explicitly opt back in from the memory panel.
const PAUSED_KEY="xy.memory-timeline-paused-20261119-v1";
try{
  if(localStorage.getItem(PAUSED_KEY)!=="1"){
    localStorage.setItem(PREF,JSON.stringify({...parse(PREF,{}),enabled:false,recall:false}));
    localStorage.setItem(PAUSED_KEY,"1");
  }
}catch{}
const options=()=>({enabled:false,recall:false,...parse(PREF,{})});
const list=()=>{const value=parse(KEY,[]);return Array.isArray(value)?value:[]};
const dateKey=stamp=>{
  const d=new Date(stamp),p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
};
const text=(value,n)=>String(value??"").trim().slice(0,n);
const privatePattern=/(?:密码|验证码|密钥|api[_ -]?key|access[_ -]?token|bearer\s+\S+|银行卡|身份证号码|家庭住址)/i;
const invalidReply=/^(?:请求失败[：:]|备用视觉分析失败[：:]|嗯，我在。(?:你刚才说的已经留在这里了。)?$)/;
function save(items){
  const counts=new Map(),kept=[];
  for(const item of items){
    const id=String(item.characterId||"");
    if((counts.get(id)||0)>=LIMIT)continue;
    counts.set(id,(counts.get(id)||0)+1);
    kept.push(item);
  }
  localStorage.setItem(KEY,JSON.stringify(kept));
}
function capture(c){
  if(!options().enabled||!c?.id||!Array.isArray(c.messages))return false;
  const msgs=c.messages,index=msgs.length-1,last=msgs[index];
  if(last?.role!=="assistant"||last.localOnly)return false;
  const assistant=text(last.text,500);
  if(!assistant||invalidReply.test(assistant)||/^\s*<(!doctype|html)/i.test(assistant))return false;
  let userIndex=index-1;
  while(userIndex>=0&&msgs[userIndex]?.role!=="user"){
    if(msgs[userIndex]?.role==="assistant")return false;
    userIndex--;
  }
  if(userIndex<0)return false;
  const user=text(msgs[userIndex].text||msgs[userIndex].transcript,500);
  if(!user||privatePattern.test(user)||privatePattern.test(assistant))return false;
  const charId=String(c.characterId||window.xyCurrentCharacter?.()?.id||"");
  if(!charId)return false;
  const sourceKey=String(c.id)+":"+index;
  const all=list();
  if(all.some(x=>x.kind==="exchange"&&x.characterId===charId&&x.sourceKey===sourceKey))return false;
  const now=Date.now();
  all.unshift({
    id:"e-"+now.toString(36)+"-"+index,
    kind:"exchange",characterId:charId,chatId:c.id,
    chatTitle:text(c.title||"旧对话",60),sourceKey,
    at:now,date:dateKey(now),user,assistant
  });
  try{save(all);return true}catch(error){console.warn("记忆时间线未能保存：",error);return false}
}
function captureSummary(charId,c,summary,title,board){
  if(!options().enabled||!c?.id)return false;
  const value=text(summary,1600);
  if(!value||privatePattern.test(value))return false;
  const id=String(charId||c.characterId||"");
  if(!id)return false;
  const all=list(),sourceKey=String(c.id)+":"+String(title||"")+":"+value.slice(0,90);
  if(all.some(x=>x.kind==="summary"&&x.characterId===id&&x.sourceKey===sourceKey))return false;
  const now=Date.now();
  all.unshift({id:"s-"+now.toString(36)+"-"+Math.random().toString(36).slice(2,7),
    kind:"summary",characterId:id,chatId:c.id,chatTitle:text(c.title||"旧对话",60),
    at:now,date:dateKey(now),sourceKey,title:text(title||"剧情整理",80),
    summary:value,board:text(board,800)});
  try{save(all);return true}catch{return false}
}
function find(characterId,{excludeChat=null,limit=250}={}){
  const id=String(characterId||"");
  return list().filter(x=>x.characterId===id&&(excludeChat===null||String(x.chatId)!==String(excludeChat))).slice(0,limit);
}
function erase(itemId,charId){
  const existing=list(),remaining=existing.filter(x=>!(x.id===itemId&&x.characterId===charId));
  if(remaining.length===existing.length)return false;
  save(remaining);return true;
}
let visible=48;
const humanDate=v=>{
  const d=new Date(v);
  return Number.isFinite(d.getTime())?d.toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}):"日期未知";
};
function renderSection(outer,onRefresh){
  if(!outer||!outer.appendChild)return;
  const charId=String(window.xyCurrentCharacter?.()?.id||"");
  const all=find(charId,{limit:LIMIT});
  const block=document.createElement("section");block.className="xy-timeline";
  const heading=document.createElement("h3");heading.textContent="时间记忆 · "+(options().enabled?"正在记录":"已暂停");block.appendChild(heading);
  const row=document.createElement("label");row.className="row";
  row.append(document.createTextNode("自动记录真实聊天（本机存储，不额外调用模型）"));
  const check=document.createElement("input");check.type="checkbox";check.checked=options().enabled;
  check.addEventListener("change",()=>{localStorage.setItem(PREF,JSON.stringify({...options(),enabled:check.checked}));onRefresh?.()});
  row.append(check);block.appendChild(row);
  const recallRow=document.createElement("label");recallRow.className="row";
  recallRow.append(document.createTextNode("换对话时参考时间记忆"));
  const recallCheck=document.createElement("input");recallCheck.type="checkbox";recallCheck.checked=options().recall;
  recallCheck.addEventListener("change",()=>{localStorage.setItem(PREF,JSON.stringify({...options(),recall:recallCheck.checked}));onRefresh?.()});
  recallRow.append(recallCheck);block.appendChild(recallRow);
  const tip=document.createElement("p");tip.className="subtle";
  tip.textContent=options().enabled
    ?"目前只会保存真实聊天片段，并不能自动判断重要事实。你可以随时关闭；手动记忆独立保存。"
    :"已经暂停自动复制聊天，也不会将旧时间记录送入新对话。以前的记录保留为可选查看的存档，不影响手动保存记忆。";
  block.appendChild(tip);
  if(!all.length){
    const p=document.createElement("p");p.className="subtle";
    p.textContent="没有旧时间记录。现在只保留你自己手动保存的记忆。";
    block.appendChild(p);
  }
  const archive=document.createElement("details");archive.className="xy-timeline-archive";
  const archiveTitle=document.createElement("summary");
  archiveTitle.textContent="查看以前保存的聊天记录摘录 · "+all.length+" 条";
  archive.appendChild(archiveTitle);
  const groups=new Map();
  for(const entry of all.slice(0,visible)){
    const day=entry.date||"日期未知";
    if(!groups.has(day))groups.set(day,[]);
    groups.get(day).push(entry);
  }
  for(const [day,entries] of groups){
    const dayBox=document.createElement("details");dayBox.className="xy-timeline-day";
    dayBox.open=groups.size===1||day===groups.keys().next().value;
    const summary=document.createElement("summary");summary.textContent=day+" · "+entries.length+" 条";dayBox.appendChild(summary);
    for(const entry of entries){
      const item=document.createElement("article");item.className="xy-timeline-entry";
      const head=document.createElement("div");head.className="xy-timeline-entry-head";
      const stamp=document.createElement("small");stamp.textContent=humanDate(entry.at)+" · "+entry.chatTitle+(entry.kind==="summary"?" · 剧情摘要":"");
      head.appendChild(stamp);item.appendChild(head);
      if(entry.kind==="summary"){
        const h=document.createElement("strong");h.textContent=entry.title;item.appendChild(h);
        const p=document.createElement("p");p.textContent=entry.summary;item.appendChild(p);
        if(entry.board){const extra=document.createElement("details");const sum=document.createElement("summary");sum.textContent="人物与场景";extra.appendChild(sum);
          const detail=document.createElement("p");detail.textContent=entry.board;extra.appendChild(detail);item.appendChild(extra)}
      }else{
        const u=document.createElement("p");u.textContent="你："+entry.user;item.appendChild(u);
        const a=document.createElement("p");a.textContent="角色："+entry.assistant;item.appendChild(a);
      }
      const remove=document.createElement("button");remove.type="button";remove.textContent="删除此条";
      remove.addEventListener("click",()=>{
        if(!window.confirm("只删除这条时间记忆？原始聊天仍会保留。"))return;
        if(erase(entry.id,charId))onRefresh?.();
      });
      item.appendChild(remove);dayBox.appendChild(item);
    }
    archive.appendChild(dayBox);
  }
  if(all.length>visible){
    const more=document.createElement("button");more.type="button";more.textContent="再看更早的记忆";
    more.addEventListener("click",()=>{visible+=48;onRefresh?.()});
    archive.appendChild(more);
  }
  if(all.length)block.appendChild(archive);
  outer.appendChild(block);
}
const style=document.createElement("style");
style.textContent=`.xy-timeline-archive>summary{cursor:pointer;opacity:.8;padding:8px 0}
.xy-timeline-day{margin-top:8px;border-top:1px solid rgba(112,139,115,.22);padding-top:9px}
.xy-timeline-day>summary{cursor:pointer;color:inherit;font-weight:600;padding:5px 0}
.xy-timeline-entry{padding:10px 0 9px;border-bottom:1px solid rgba(112,139,115,.15)}
.xy-timeline-entry-head{margin-bottom:6px;opacity:.76;font-size:11px}
.xy-timeline-entry p{white-space:pre-wrap;overflow-wrap:anywhere;margin:5px 0;line-height:1.6}
.xy-timeline-entry strong{display:block;margin:4px 0}
.xy-timeline-entry button{margin-top:5px;font-size:11px}
.xy-timeline .row{flex-wrap:wrap}.xy-timeline .row input{margin-left:auto}`;
document.head?.appendChild(style);
window.xyMemoryTimeline={capture,captureSummary,find,list,options,renderSection};
})();