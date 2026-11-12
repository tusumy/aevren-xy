/* 砚屿 · 对话泡泡：原文快照、前情、双人留言。 */
(()=>{
"use strict";
const KEY="xy.keepsake.bubbles.v1",SET="xy.keepsake.settings.v1";
const el=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const load=(key,f)=>{try{return JSON.parse(localStorage.getItem(key))??f}catch{return f}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const date=n=>new Date(n||Date.now()).toLocaleDateString("zh-CN",{month:"2-digit",day:"2-digit"});
const who=c=>window.xyCharacterForChat?.(c)?.name||window.xyCurrentCharacter?.()?.name||"玄砚";
const active=()=>typeof chat==="function"?chat():null;
const historyChats=()=>typeof chats==="undefined"?[]:chats;
const textOf=m=>{if(!m)return "";const v=m.variants?.[Math.max(0,Math.min(m.variants.length-1,Number(m.activeVariant)||0))];return String(v?.text??m.text??"")};
const norm=t=>String(t||"").replace(/⟪(?:封存|泡|前情):[^⟫]*⟫/g,"").trim().slice(0,2200);
const preview=(t,n=90)=>String(t||"").replace(/\s+/g," ").slice(0,n);
const parts=m=>{const t=norm(textOf(m));if(!t)return [];if(t.includes("\x60\x60\x60")||/<(?:html|div|style|table|svg)\b/i.test(t))return [t];return t.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,24)};
let bubbles=null;
function ready(){
 if(bubbles!==null)return;
 const saved=load(KEY,[]);
 bubbles=(Array.isArray(saved)?saved:[]).filter(x=>x&&x.id&&Array.isArray(x.lines));
}
let opts={aiMaySave:true,...load(SET,{})},query="",detailId="",picker=null;
const byId=id=>{ready();return bubbles.find(x=>x.id===id)};
const all=()=>{ready();return bubbles.slice()};
const count=()=>{ready();return bubbles.length};
const isExpandedQuote=id=>{ready();return bubbles.some(x=>x.sourceQuoteId&&String(x.sourceQuoteId)===String(id))};
function persist(){ready();localStorage.setItem(KEY,JSON.stringify(bubbles));window.dispatchEvent(new CustomEvent("xy-keepsake-change",{detail:{count:count()}}))}
function fog(x){return Math.max(0,Math.min(1,((Date.now()-(x.touchedAt||x.createdAt))/86400000-3)/80))}
function clip(c,index,t,ctx=""){const m=c.messages[index];return {w:m.role==="assistant"?"me":"her",t:norm(t),index,mid:m.id??null,ctx}}
function create(c,selected,config={}){
 ready();
 if(!c||!selected.length)throw Error("至少选一段对话");
 const clips=selected.filter(x=>c.messages[x.index]&&["user","assistant"].includes(c.messages[x.index].role)&&norm(x.t)).sort((a,b)=>a.index-b.index||a.part-b.part).slice(0,30);
 if(!clips.length)throw Error("没有可收藏的文字");
 const first=clips[0].index,last=clips[clips.length-1].index;
 const key=(config.who==="ai"?"ai":"user")+"|"+String(c.id)+"|"+first+"|"+last+"|"+clips.map(x=>norm(x.t)).join("").slice(0,240);
 const old=bubbles.find(x=>x.signature===key&&Date.now()-x.createdAt<600000);
 if(old){
  if(config.sourceQuoteId&&!old.sourceQuoteId){old.sourceQuoteId=config.sourceQuoteId;try{persist()}catch(e){old.sourceQuoteId=null;throw e}}
  return {bubble:old,created:false};
 }
 const context=[];
 if(first>0&&["user","assistant"].includes(c.messages[first-1]?.role))context.push(clip(c,first-1,textOf(c.messages[first-1]),"before"));
 if(last<c.messages.length-1&&["user","assistant"].includes(c.messages[last+1]?.role))context.push(clip(c,last+1,textOf(c.messages[last+1]),"after"));
 const title=String(config.title||"").trim().slice(0,70)||preview(clips.reduce((a,b)=>a.t.length>b.t.length?a:b).t,16);
 const now=Date.now(),author=config.who==="ai"?"ai":"user";
 const item={id:"k"+uid(),signature:key,chatId:c.id,chatTitle:c.title||"对话",characterId:c.characterId||"",characterName:who(c),
 title,who:author,createdAt:now,touchedAt:now,visitedAt:0,lines:clips.map(x=>clip(c,x.index,x.t)),context,
 prefaceUser:author==="user"?String(config.note||"").trim().slice(0,1200):"",
 prefaceAI:author==="ai"?String(config.note||"").trim().slice(0,1200):"",
 comments:[],sourceQuoteId:config.sourceQuoteId||null,sendToAI:author==="user"&&!!config.sendToAI,
 pending:author==="user"&&config.sendToAI?{type:"new",at:now}:null};
 bubbles.unshift(item);try{persist()}catch(e){bubbles.shift();throw e}
 return {bubble:item,created:true};
}
function comment(item,value,author="user",parentId=null,sent=false){
 const text=String(value||"").trim().slice(0,2000);if(!text)throw Error("请先写一句");
 const c={id:"c"+uid(),author,text,parentId:parentId||null,sent:author==="ai"||!!sent,at:Date.now()};
 const previous={touchedAt:item.touchedAt,sendToAI:item.sendToAI,pending:item.pending};
 item.comments.push(c);item.touchedAt=c.at;
 if(author==="user"&&sent){item.sendToAI=true;item.pending={type:"comment",commentId:c.id,at:c.at}}
 if(author==="ai")item.pending=null;
 try{persist()}catch(error){item.comments.pop();Object.assign(item,previous);throw error}
 return c;
}
function ping(text,error){const n=document.createElement("div");n.className="xy-k-toast"+(error?" is-error":"");n.textContent=text;document.body.append(n);setTimeout(()=>n.remove(),2800)}
function goChat(item){
 const c=historyChats().find(x=>String(x.id)===String(item.chatId));
 if(!c){alert("原聊天已不在本机，泡泡快照仍然保留。");return}
 current=c.id;save();
 if(window.xyIslandHome?.navigate)window.xyIslandHome.navigate("chat");
 else{el("#panel")?.classList.remove("open");el("#scrim")?.classList.remove("show")}
 renderChats();renderMessages();
 const first=item.lines[0],match=first.mid!=null?c.messages.findIndex(m=>String(m.id??"")===String(first.mid)):-1;
 const index=match>=0?match:first.index;
 requestAnimationFrame(()=>el('#messages .message[data-message="'+index+'"]')?.scrollIntoView?.({behavior:"smooth",block:"center"}));
}
function pool(list){
 const recent=list.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);
 return recent.concat(list.filter(x=>!recent.includes(x)).sort((a,b)=>fog(b)-fog(a)).slice(0,3));
}
function render(){
 ready();
 const body=el("#panelBody");if(!body)return;
 const filtered=bubbles.filter(x=>(x.title+" "+x.lines.map(l=>l.t).join(" ")).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const layout=pool(filtered);
 body.innerHTML='<div class="xy-k-page"><div class="xy-k-heading"><span>KEEPSAKE · 砚屿</span><h2>把一段话，留成一颗泡。</h2><p>原话和前后文一起保存。原聊天以后编辑或删除，泡里的快照也不会变。</p></div>'+
 '<div class="xy-k-toolbar"><input id="xyKSearch" type="search" placeholder="搜索泡泡…" aria-label="搜索泡泡" value="'+esc(query)+'"><button type="button" data-k-act="quotes">单句收藏</button></div>'+
 '<div class="xy-k-pool">'+(layout.length?layout.map((x,i)=>'<button class="xy-k-orb xy-k-orb-'+i+'" type="button" data-k-open="'+esc(x.id)+'" style="--xy-k-fog:'+fog(x).toFixed(2)+'" aria-label="打开 '+esc(x.title)+'"><span class="xy-k-glint"></span><b>'+esc(preview(x.title,19))+'</b><small>'+(x.who==="ai"?"玄砚封存":"你保存的")+'</small></button>').join(""):'<p class="xy-k-empty">还没有泡泡。到聊天里长按消息，选择「存成泡泡」。</p>')+'</div>'+
 '<div class="xy-k-list-head">所有泡泡 <small>'+filtered.length+' 颗</small></div><div class="xy-k-list">'+filtered.map(x=>'<button type="button" class="xy-k-record" data-k-open="'+esc(x.id)+'"><span class="xy-k-dot"></span><span><strong>'+esc(x.title)+'</strong><small>'+esc(preview(x.lines.map(l=>l.t).join(" "),95))+'</small></span><time>'+esc(date(x.createdAt))+'</time></button>').join("")+'</div>'+
 '<label class="xy-k-option"><input id="xyKMaySave" type="checkbox" '+(opts.aiMaySave?"checked":"")+'><span>允许玄砚主动封存它想留下的对话（不定时催促）</span></label></div>';
}
function detail(item){
 detailId=item.id;item.visitedAt=Date.now();item.touchedAt=item.visitedAt;try{persist()}catch(e){ping("访问记录没有保存："+e.message,true)}
 const body=el("#panelBody");if(!body)return;
 const contextsBefore=item.context.filter(x=>x.ctx==="before"),contextsAfter=item.context.filter(x=>x.ctx==="after");
 const rows=[...contextsBefore,...item.lines,...contextsAfter];
 const notes=(item.prefaceUser||item.prefaceAI)?'<div class="xy-k-notes">'+
 (item.prefaceUser?'<section><b>你记得</b><p>'+esc(item.prefaceUser)+'</p></section>':'')+
 (item.prefaceAI?'<section><b>'+esc(item.characterName)+'记得</b><p>'+esc(item.prefaceAI)+'</p></section>':'')+'</div>':'';
 body.innerHTML='<div class="xy-k-page xy-k-detail"><button type="button" data-k-act="back" class="xy-k-back">‹ 泡泡池</button>'+
 '<div class="xy-k-heading"><span>'+(item.who==="ai"?"AI SAVED":"YOU SAVED")+' · '+esc(date(item.createdAt))+'</span><h2>'+esc(item.title)+'</h2></div>'+notes+
 '<div class="xy-k-dialogue">'+rows.map(l=>'<div class="xy-k-line'+(l.ctx?' is-context':'')+'"><b>'+esc(l.w==="me"?item.characterName:"你")+(l.ctx?" · 前后文":"")+'</b><p>'+esc(l.t)+'</p></div>').join("")+'</div>'+
 '<div class="xy-k-actions"><button type="button" data-k-act="jump">原对话</button><button type="button" data-k-act="note">写我的前情</button>'+
 (!item.prefaceAI?'<button type="button" data-k-act="ask">叫玄砚写经过</button>':'')+'<button type="button" class="xy-k-danger" data-k-act="delete">删除泡泡</button></div>'+
 '<div class="xy-k-comments"><h3>接着说</h3>'+
 (item.comments.length?item.comments.map(c=>'<article class="xy-k-comment'+(c.parentId?' is-reply':'')+'"><b>'+(c.author==="ai"?esc(item.characterName):"你")+'</b><time>'+esc(date(c.at))+'</time><p>'+esc(c.text)+'</p><button type="button" data-k-reply="'+esc(c.id)+'">回复</button></article>').join(""):'<p class="xy-k-empty">还没有留言。</p>')+
 '<form id="xyKCommentForm"><label id="xyKReplying" hidden>正在回复 <button type="button" data-k-act="cancel-reply">取消</button></label><textarea id="xyKCommentText" rows="3" maxlength="2000" placeholder="留一句…"></textarea>'+
 '<label class="xy-k-option"><input id="xyKSend" type="checkbox" checked>发给玄砚（下一次聊天可见）</label><button type="submit" class="xy-k-save">保存留言</button></form></div></div>';
}
function show(){
 const panel=el("#panel"),body=el("#panelBody");if(!panel||!body)return;
 panel.classList.remove("xy-quote-panel");panel.classList.add("xy-keepsake-panel","open");
 el("#sidebar")?.classList.remove("open");el("#scrim")?.classList.add("show");
 if(el("#panelEyebrow"))el("#panelEyebrow").textContent="KEEPSAKE";
 if(el("#panelTitle"))el("#panelTitle").textContent="对话泡泡";
 detailId="";render();
}
function open(id){
 if(window.xyIslandHome?.navigate&&window.xyIslandHome.activeRoute?.()!=="keepsake"){window.xyIslandHome.navigate("keepsake");if(id&&byId(id))detail(byId(id));return}
 show();if(id&&byId(id))detail(byId(id));
}
function choose(index,quote=null){
 const c=active();if(!c?.messages?.[index])return ping("找不到原消息",true);
 picker?.remove();
 let lo=Math.max(0,index-5),hi=Math.min(c.messages.length-1,index+5);
 const selected=new Set(),segments=parts(c.messages[index]);
 const segment=Math.max(0,segments.findIndex(p=>quote?.text&&p.includes(quote.text)));
 selected.add(index+":"+segment);
 const wrap=document.createElement("div");wrap.className="xy-k-picker";wrap.setAttribute("role","dialog");wrap.setAttribute("aria-modal","true");
 picker=wrap;document.body.append(wrap);
 let draft={title:"",note:"",send:true};
 function capture(){const form=wrap.querySelector("form");if(form)draft={title:form.elements.title.value,note:form.elements.note.value,send:form.elements.send.checked}}
 function draw(){
  let list="";
  for(let i=lo;i<=hi;i++){
   const m=c.messages[i];if(!["user","assistant"].includes(m?.role))continue;
   parts(m).forEach((t,j)=>{const key=i+":"+j;
    list+='<label class="xy-k-choice"><input data-k-part="'+key+'" type="checkbox" '+(selected.has(key)?"checked":"")+'><span><b>'+esc(m.role==="assistant"?who(c):"你")+'</b><small>'+esc(preview(t,420))+'</small></span></label>';
   });
  }
  wrap.innerHTML='<div class="xy-k-picker-card"><header><strong>存成对话泡泡</strong><button type="button" data-k-pick="close">×</button></header>'+
  '<p>勾选想留下的句子。最多 30 段；前后各一条会作为淡色上下文保存。暂时只保存文字，不自动复制附件。</p>'+
  '<div class="xy-k-options">'+list+'</div><div class="xy-k-more"><button type="button" data-k-pick="older" '+(lo===0?"disabled":"")+'>更早</button><span>已选 '+selected.size+' 段</span><button type="button" data-k-pick="newer" '+(hi===c.messages.length-1?"disabled":"")+'>更晚</button></div>'+
  '<form id="xyKCreate"><label>泡泡名字<input name="title" maxlength="70" placeholder="留空自动取原话" value="'+esc(draft.title)+'"></label>'+
  '<label>当时怎么回事<textarea name="note" rows="2" maxlength="1200" placeholder="可留空">'+esc(draft.note)+'</textarea></label>'+
  '<label class="xy-k-option"><input name="send" type="checkbox" '+(draft.send?"checked":"")+'>告诉玄砚这颗泡（下一次聊天可见）</label>'+
  '<footer><button type="button" data-k-pick="close">取消</button><button type="submit" class="xy-k-save">保存泡泡</button></footer></form></div>';
 }
 draw();
 wrap.addEventListener("change",e=>{const key=e.target?.dataset?.kPart;if(!key)return;
  if(e.target.checked){if(selected.size===30){e.target.checked=false;return ping("最多 30 段",true)}selected.add(key)}else selected.delete(key);capture();draw();
 });
 wrap.addEventListener("click",e=>{if(e.target===wrap||e.target.closest('[data-k-pick="close"]')){wrap.remove();picker=null;return}
  const command=e.target.closest("[data-k-pick]")?.dataset.kPick;if(!command)return;capture();
  if(command==="older")lo=Math.max(0,lo-6);
  if(command==="newer")hi=Math.min(c.messages.length-1,hi+6);
  draw();
 });
 wrap.addEventListener("submit",e=>{if(e.target?.id!=="xyKCreate")return;e.preventDefault();capture();
  const clips=[...selected].map(key=>{const [i,j]=key.split(":").map(Number);return {index:i,part:j,t:parts(c.messages[i])[j]||""}});
  try{const result=create(c,clips,{title:draft.title,note:draft.note,sendToAI:draft.send,sourceQuoteId:quote?.id});
   wrap.remove();picker=null;ping(result.created?"保存好了，原文快照已留下":"这段已经存过了");open(result.bubble.id);
  }catch(err){ping("保存失败："+String(err.message||err),true)}
 });
}
function expandQuote(q){
 const c=historyChats().find(x=>String(x.id)===String(q.chatId));if(!c)return ping("原对话不在本机，单句仍保留",true);
 current=c.id;const i=q.messageId?c.messages.findIndex(m=>String(m.id??"")===String(q.messageId)):-1;
 const index=i>=0?i:Number.isInteger(q.messageIndex)?q.messageIndex:-1;
 if(index<0||!c.messages[index])return ping("找不到原消息，无法扩成泡泡",true);
 choose(index,q);
}
const body=el("#panelBody");
body?.addEventListener("click",e=>{
 const openTarget=e.target.closest("[data-k-open]");if(openTarget){const item=byId(openTarget.dataset.kOpen);if(item)detail(item);return}
 const reply=e.target.closest("[data-k-reply]");if(reply){const label=body.querySelector("#xyKReplying");label.hidden=false;label.dataset.parent=reply.dataset.kReply;body.querySelector("#xyKCommentText")?.focus();return}
 const action=e.target.closest("[data-k-act]")?.dataset.kAct;if(!action)return;
 if(action==="back"){detailId="";render();return}
 if(action==="quotes"){if(window.xyIslandHome?.navigate)window.xyIslandHome.navigate("quotes");else openPanel("quotes");return}
 if(action==="cancel-reply"){const label=body.querySelector("#xyKReplying");label.hidden=true;delete label.dataset.parent;return}
 const item=byId(detailId);if(!item)return;
 if(action==="jump"){goChat(item);return}
 if(action==="note"){const value=prompt("写下你记得的经过",item.prefaceUser||"");if(value===null)return;const before=item.prefaceUser;item.prefaceUser=value.trim().slice(0,1200);try{persist();detail(item)}catch(err){item.prefaceUser=before;ping("没存上："+err.message,true)}return}
 if(action==="ask"){item.sendToAI=true;item.pending={type:"backstory",at:Date.now()};try{persist();ping("已记录，下次聊天玄砚会看到");detail(item)}catch(err){ping("没存上："+err.message,true)}return}
 if(action==="delete"){if(!confirm("删除这颗泡泡？原聊天不会删除。"))return;const i=bubbles.indexOf(item);bubbles.splice(i,1);try{persist();detailId="";render()}catch(err){bubbles.splice(i,0,item);ping("删除失败："+err.message,true)}}
});
body?.addEventListener("input",e=>{if(e.target?.id!=="xyKSearch")return;query=e.target.value;render();const input=body.querySelector("#xyKSearch");input?.focus();input?.setSelectionRange(query.length,query.length)});
body?.addEventListener("change",e=>{if(e.target?.id==="xyKMaySave"){opts.aiMaySave=e.target.checked;localStorage.setItem(SET,JSON.stringify(opts))}});
body?.addEventListener("submit",e=>{if(e.target?.id!=="xyKCommentForm")return;e.preventDefault();const item=byId(detailId);if(!item)return;
 const text=body.querySelector("#xyKCommentText")?.value,reply=body.querySelector("#xyKReplying")?.dataset.parent,send=body.querySelector("#xyKSend")?.checked;
 try{comment(item,text,"user",reply,send);detail(item);ping(send?"留言已保存，下次聊天玄砚会看到":"只保存在这里")}catch(err){ping("没存上："+err.message,true)}
});
el("#messages")?.addEventListener("click",e=>{const button=e.target.closest("[data-xy-keepsake-card]");if(button){e.preventDefault();open(button.dataset.xyKeepsakeCard)}});
const previousOpen=openPanel;
openPanel=function(type){if(type==="keepsake")return show();el("#panel")?.classList.remove("xy-keepsake-panel");return previousOpen.apply(this,arguments)};
window.xyKeepsake={open,choose,expandQuote,create,comment,all,count,isExpandedQuote,find:byId,options:opts,persist};
})();