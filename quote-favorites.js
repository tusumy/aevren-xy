/* 砚屿 · 单句收藏。与长期记忆/工具收藏分离，localStorage 备份兼容。 */
(()=>{
 "use strict";
 const KEY="xy.quoteFavorites.v1";
 const panel=document.querySelector("#panel"),body=document.querySelector("#panelBody");
 if(!panel||!body)return;
 const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const read=()=>{
   try{const list=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(list)?list.filter(x=>x&&typeof x.text==="string"):[]}
   catch{return []}
 };
 const write=items=>localStorage.setItem(KEY,JSON.stringify(items));
 function collect(text,source={}){
   const clean=String(text||"").trim().slice(0,1600);
   if(!clean)throw Error("没有可以收藏的句子");
   const saved=read();
   const chatId=String(source.chatId??""),messageId=String(source.messageId??"");
   if(saved.some(x=>x.text===clean&&String(x.chatId||"")===chatId&&String(x.messageId||"")===messageId)){
     return {added:false,count:saved.length};
   }
   const item={id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,8),text:clean,
     chatId,messageId,messageIndex:Number.isInteger(source.messageIndex)?source.messageIndex:null,
     role:source.role==="user"?"user":"assistant",
     characterId:String(source.characterId||""),
     characterName:String(source.characterName||""),
     title:String(source.title||""),
     at:Date.now()};
   saved.unshift(item);write(saved);
   window.dispatchEvent(new CustomEvent("xy-quote-favorites-change",{detail:{count:saved.length}}));
   return {added:true,count:saved.length,item};
 }
 function count(){return read().length}
 function render(){
   const list=read();
   const bodyHtml=list.map(x=>
     '<article class="xy-q-item" data-xy-q-item="'+escapeHtml(x.id)+'">'+
       '<p>'+escapeHtml(x.text)+'</p>'+
       '<small>'+escapeHtml(x.characterName||x.title||"对话收藏")+
         (x.title&&x.characterName?' · '+escapeHtml(x.title):"")+
         ' · '+escapeHtml(new Date(x.at).toLocaleDateString())+'</small>'+
       '<div class="xy-q-actions">'+
        '<button type="button" data-q-action="copy" data-q-id="'+escapeHtml(x.id)+'">复制</button>'+
        '<button type="button" data-q-action="jump" data-q-id="'+escapeHtml(x.id)+'" '+(!x.chatId||x.chatId.startsWith("group:")?'disabled title="群聊收藏暂不支持定位"':"")+'>原对话</button>'+
        '<button type="button" class="xy-q-remove" data-q-action="remove" data-q-id="'+escapeHtml(x.id)+'">移除收藏</button>'+
       '</div></article>').join("");
   body.innerHTML='<div class="xy-q-library">'+
    '<div class="xy-q-heading"><span>KEEP THESE WORDS</span><h2>收藏的句子</h2><p>把喜欢的一句话留下来，不会写进角色记忆，也不会发给模型。</p></div>'+
    '<div class="xy-q-toolbar"><input type="search" id="xyQuoteSearch" placeholder="搜索收藏的句子…" aria-label="搜索收藏语句">'+
    '<button type="button" data-q-action="tool-favs">工具收藏</button></div>'+
    '<p class="xy-q-count">'+list.length+' 句已收藏</p>'+
    '<div class="xy-q-list">'+(list.length?bodyHtml:'<div class="xy-q-empty">还没有收藏。长按聊天消息，选择「收藏一句」。</div>')+'</div></div>';
 }
 function show(){
   panel.classList.remove("xy-creative-panel");
   panel.classList.add("xy-quote-panel","open");
   document.querySelector("#sidebar")?.classList.remove("open");
   document.querySelector("#scrim")?.classList.add("show");
   const eyebrow=document.querySelector("#panelEyebrow"),title=document.querySelector("#panelTitle");
   if(eyebrow)eyebrow.textContent="FAVORITES";
   if(title)title.textContent="句子收藏";
   window.xyEnsureOverlayHistory?.();
   render();
 }
 const previousOpen=openPanel;
 openPanel=function(type){
   if(type==="quotes")return show();
   panel.classList.remove("xy-quote-panel");
   return previousOpen(type);
 };
 function copy(text){
   const fallback=()=>{
     const el=document.createElement("textarea");
     el.value=text;el.style.position="fixed";el.style.opacity="0";
     document.body.append(el);el.select();
     const ok=document.execCommand("copy");el.remove();
     if(!ok)throw Error("复制失败");
   };
   if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text).catch(fallback);
   try{fallback();return Promise.resolve()}catch(err){return Promise.reject(err)}
 }
 function jump(item){
   const target=typeof chats!=="undefined"?chats.find(x=>String(x.id)===String(item.chatId)):null;
   if(!target){alert("原对话已不在本机，收藏的句子还保留着。");return}
   current=target.id;save();renderChats();renderMessages();
   panel.classList.remove("open","xy-quote-panel");
   document.querySelector("#scrim")?.classList.remove("show");
   window.xyIslandHome?.enterChatFromDestination?.();
   const idx=item.messageId?target.messages.findIndex(m=>String(m.id??"")===String(item.messageId)):-1;
   const old=Number.isInteger(item.messageIndex)?target.messages[item.messageIndex]:null;
   const matching=old&&String(old.text||"").includes(item.text);
   const byText=target.messages.findIndex(m=>String(m.text||"").includes(item.text));
   const targetIndex=idx>=0?idx:matching?item.messageIndex:byText>=0?byText:null;
   requestAnimationFrame(()=>{
     const row=Number.isInteger(targetIndex)?
       document.querySelector('#messages .message[data-message="'+targetIndex+'"]'):null;
     row?.scrollIntoView?.({behavior:"smooth",block:"center"});
   });
 }
 body.addEventListener("input",e=>{
   if(e.target?.id!=="xyQuoteSearch")return;
   const search=String(e.target.value||"").trim().toLocaleLowerCase();
   body.querySelectorAll(".xy-q-item").forEach(el=>{
     el.hidden=!!search&&!el.textContent.toLocaleLowerCase().includes(search);
   });
 });
 body.addEventListener("click",async e=>{
   const btn=e.target.closest?.("#panelBody [data-q-action]");
   if(!btn||!body.contains(btn))return;
   const task=btn.dataset.qAction;
   if(task==="tool-favs"){
     openPanel("toolhub");
     document.querySelector('#xyToolHub [data-hub-filter="favorite"]')?.click();
     return;
   }
   const item=read().find(x=>x.id===btn.dataset.qId);
   if(!item)return;
   if(task==="copy"){
     try{await copy(item.text);btn.textContent="已复制"}catch{btn.textContent="复制失败"}
   }else if(task==="jump")jump(item);
   else if(task==="remove"){
     if(!confirm("移除这一句收藏？原聊天不会删除。"))return;
     write(read().filter(x=>x.id!==item.id));
     window.dispatchEvent(new CustomEvent("xy-quote-favorites-change",{detail:{count:count()}}));
     render();
   }
 });
 window.xyQuoteFavorites={open:show,collect,count,all:read};
})();