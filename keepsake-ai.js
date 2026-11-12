/* Keepsake model bridge: on-reply markers, durable success cards, visible failures. */
(()=>{
"use strict";
const api=()=>window.xyKeepsake;
const active=()=>typeof chat==="function"?chat():null;
const textOf=m=>String(m?.variants?.[Math.max(0,Math.min(m.variants.length-1,Number(m.activeVariant)||0))]?.text??m?.text??"");
const clean=s=>String(s||"").trim();
const snippet=(s,n=120)=>String(s||"").replace(/\s+/g," ").slice(0,n);
function instruction(c){
 const keep=api();if(!keep||!c)return "";
 const todo=keep.all().filter(x=>String(x.chatId)===String(c.id)&&x.pending&&x.sendToAI)
  .sort((a,b)=>(b.pending?.at||0)-(a.pending?.at||0)).slice(0,2).map(x=>{
   let event=x.pending.type==="backstory"?"对方想听你写当时的经过":x.pending.type==="new"?"对方刚保存了这段对话":"";
   if(x.pending.type==="comment"){const cm=x.comments.find(v=>v.id===x.pending.commentId);event="对方写了留言："+snippet(cm?.text,130)}
   return x.id+"《"+snippet(x.title,32)+"》 "+event+"；原文："+snippet(x.lines.map(v=>v.t).join(" "),175);
  });
 const ability=keep.options.aiMaySave?
  "你也能自主选择这一轮确实想留下的原话。想封存时，只在回复末尾写一次 ⟪封存:标题|开头那条消息中连续4~8字|结尾那条消息中连续4~8字|自己记得的经过⟫。文字必须原样摘，不拼接。不要机械保存，不要口头宣称已存却不写标记。":"";
 const pending=todo.length?"待回应泡泡："+todo.join("\n")+
   "\n愿意写评论可在末尾加 ⟪泡:泡泡ID|你要留下的话⟫；补写自己的前情可用 ⟪前情:泡泡ID|经过⟫。没有实际标记就不要声称已存。":"";
 return [ability,pending].filter(Boolean).join("\n");
}
function matchRange(c,start,end){
 if(!start||!end||start.length<3||end.length<3)throw Error("请精确抄写原话开头和结尾");
 const rows=c.messages||[],first=Math.max(0,rows.length-100),pairs=[];
 for(let a=first;a<rows.length-1;a++){
  if(!["assistant","user"].includes(rows[a]?.role)||!textOf(rows[a]).includes(start))continue;
  for(let b=a;b<Math.min(a+24,rows.length-1);b++){
   if(!["assistant","user"].includes(rows[b]?.role)||!textOf(rows[b]).includes(end))continue;
   pairs.push([a,b]);break;
  }
 }
 if(!pairs.length)throw Error("找不到原话，开头和结尾必须原样抄连续几个字");
 pairs.sort((x,y)=>x[1]-y[1]||x[0]-y[0]);return pairs[0];
}
function execute(c,m){
 const before=String(m.text||"");
 if(!before.includes("⟪"))return false;
 let seen=0;
 const updated=before.replace(/⟪(封存|泡|前情):([^⟫]{1,650})⟫/g,(whole,action,content)=>{
  if(++seen>2)return whole;
  try{
   const tokens=content.split("|");
   if(action==="封存"){
    if(tokens.length<4)throw Error("缺少标题、原话或前情");
    const title=tokens[0].trim(),start=tokens[1].trim(),end=tokens[2].trim(),note=tokens.slice(3).join("|").trim();
    if(!note)throw Error("请写两句当时怎么回事");
    const [a,b]=matchRange(c,start,end),clips=[];
    for(let i=a;i<=b;i++){
     if(!["user","assistant"].includes(c.messages[i]?.role))continue;
     clips.push({index:i,part:0,t:textOf(c.messages[i])});
    }
    const saved=api().create(c,clips,{title,note,who:"ai"});
    return "⟦泡泡:"+saved.bubble.id+"⟧";
   }
   if(tokens.length<2)throw Error("没有写下内容");
   const name=tokens[0].trim().replace(/^k:/,"k").split("#")[0];
   const item=api().find(name);
   if(!item||String(item.chatId)!==String(c.id))throw Error("找不到这颗泡泡");
   const message=tokens.slice(1).join("|").trim();
   if(!message)throw Error("评论或前情是空的");
   if(action==="泡"){
    const parent=tokens[0].split("#")[1]||null;
    api().comment(item,message,"ai",parent);
   }else{
    item.prefaceAI=message.slice(0,1200);
    item.pending=null;item.touchedAt=Date.now();
    api().persist();
   }
   return "⟦泡泡:"+item.id+"⟧";
  }catch(e){return "（没封上："+String(e?.message||e).slice(0,110)+"）"}
 });
 if(updated===before)return false;
 m.text=updated;return true;
}
// One hook covers automatic replies and the direct answer button.
const priorSave=save;
save=function(){
 const c=active(),tail=c?.messages?.at(-1);
 if(tail?.role==="assistant"&&!window.xyRegenerating)execute(c,tail);
 return priorSave.apply(this,arguments);
};
api().instruction=instruction;
api().processMarker=execute;
})();