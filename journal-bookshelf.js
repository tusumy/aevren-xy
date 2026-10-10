(()=>{
 const KEY="xy.journals.v1";
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch{return []}};
 const write=x=>localStorage.setItem(KEY,JSON.stringify(x));
 const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const ch=()=>window.xyCurrentCharacter?.()||{id:"default",name:"角色"};
 const list=()=>read().filter(x=>(x.characterId||"default")===ch().id).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(b.createdAt||0)-(a.createdAt||0));
 const title=x=>String(x.title||x.text?.split(/\n/).find(Boolean)||"未命名日记").trim().slice(0,40);
 const day=ts=>new Date(ts||Date.now()).toLocaleDateString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"});
 const month=ts=>new Date(ts||Date.now()).toLocaleDateString("zh-CN",{year:"numeric",month:"long"});
 const excerpt=x=>String(x.text||"").replace(/\s+/g," ").slice(0,72);
 const update=(id,patch)=>{const all=read(),i=all.findIndex(x=>x.id===id);if(i>=0){all[i]={...all[i],...patch,updatedAt:Date.now()};write(all)}};
 function decorate(mode,openId){
   const body=document.querySelector("#panelBody"),original=body?.querySelector("#xyJournalList");
   if(!original||body.querySelector("#xyJournalLibrary"))return;
   const shell=document.createElement("section");shell.id="xyJournalLibrary";shell.className="xy-journal-library";
   original.replaceWith(shell);
   const originalEditor=body.querySelector("#xyJournalEditor");
   const heading=document.createElement("div");heading.className="xy-journal-shelf-head";heading.textContent="DIARY SHELF · "+list().length+" 篇";
   const search=document.createElement("input");search.type="search";search.className="xy-journal-search";search.placeholder="搜索日期、标题或正文…";
   const shelf=document.createElement("div");shelf.className="xy-journal-shelf";
   const reader=document.createElement("div");reader.className="xy-journal-reader";reader.hidden=true;
   shell.append(heading,search,shelf,reader);
   function render(q=""){
     const found=list().filter(x=>!q||[title(x),x.text,day(x.createdAt)].some(v=>String(v||"").toLowerCase().includes(q.toLowerCase())));
     if(!found.length){shelf.innerHTML="<p class='setting-note'>"+(q?"没有搜索结果":"书架还空着，写下第一篇吧。")+"</p>";return}
     const groups=new Map();
     found.forEach(x=>{const m=month(x.createdAt);if(!groups.has(m))groups.set(m,[]);groups.get(m).push(x)});
     shelf.innerHTML=[...groups].map(([m,entries])=>"<section class='xy-journal-month'><h3>"+safe(m)+"</h3><div class='xy-journal-books'>"+entries.map(x=>"<button type='button' class='xy-journal-book' data-book='"+safe(x.id)+"'><span class='xy-journal-spine'></span><span class='xy-journal-book-main'><small>"+safe(day(x.createdAt))+(x.pinned?" · 置顶":"")+"</small><strong>"+safe(title(x))+"</strong><span>"+safe(excerpt(x))+"</span></span><span class='xy-journal-chevron'>›</span></button>").join("")+"</div></section>").join("");
   }
   function readBook(id){
     const entry=list().find(x=>x.id===id);if(!entry)return;
     shelf.hidden=true;search.hidden=true;heading.hidden=true;reader.hidden=false;
     reader.innerHTML="<button type='button' class='xy-journal-back' data-book-back>‹ 返回书架</button><article class='xy-journal-page'><div class='xy-journal-date'>"+safe(day(entry.createdAt))+" · "+safe(entry.characterName||ch().name)+"</div><h3>"+safe(title(entry))+"</h3><div class='xy-journal-content'>"+safe(entry.text)+"</div></article><div class='xy-journal-reader-actions'><button data-book-edit='"+safe(id)+"'>编辑</button><button data-book-rename='"+safe(id)+"'>重命名</button><button data-book-pin='"+safe(id)+"'>"+(entry.pinned?"取消置顶":"置顶")+"</button><button data-book-delete='"+safe(id)+"'>删除</button></div>";
   }
   function showShelf(){
     reader.hidden=true;shelf.hidden=false;search.hidden=false;heading.hidden=false;
     if(originalEditor)originalEditor.hidden=true;
     render(search.value);
   }
   search.oninput=()=>render(search.value);
   shell.onclick=e=>{
     const b=e.target.closest("button");if(!b)return;
     if(b.hasAttribute("data-book-back"))return showShelf();
     const id=b.dataset.book;if(id)return readBook(id);
     if(b.dataset.bookEdit)return window.xyJournal.open(b.dataset.bookEdit);
     if(b.dataset.bookRename){
       const current=list().find(x=>x.id===b.dataset.bookRename),name=prompt("日记标题",current?.title||title(current||{}));
       if(name!==null){update(b.dataset.bookRename,{title:name.trim().slice(0,80)});readBook(b.dataset.bookRename)}
     }
     if(b.dataset.bookPin){const x=list().find(x=>x.id===b.dataset.bookPin);update(b.dataset.bookPin,{pinned:!x?.pinned});render(search.value);readBook(b.dataset.bookPin)}
     if(b.dataset.bookDelete&&confirm("删除这篇日记？删除后无法恢复。")){
       write(read().filter(x=>x.id!==b.dataset.bookDelete));showShelf();
     }
   };
   if(mode==="edit"){
     shell.hidden=true;
     const back=document.createElement("button");back.type="button";back.className="xy-journal-back";back.textContent="‹ 返回书架";
     originalEditor?.prepend(back);
     back.onclick=()=>window.xyJournal.open("");
   }else{
     render("");
     if(openId)readBook(openId);
   }
   const oldManual=body.querySelector("#xyManualJournal");
   if(oldManual)oldManual.addEventListener("click",()=>{shell.hidden=true;originalEditor?.querySelector("textarea")?.focus()});
   const ai=body.querySelector("#xyAiJournal");
   if(originalEditor){new MutationObserver(()=>{if(!originalEditor.hidden)shell.hidden=true}).observe(originalEditor,{attributes:true,attributeFilter:["hidden"]})}
 }
 window.xyJournalBookshelfDecorate=decorate;
 const oldOpen=window.xyJournal?.open;
 if(typeof oldOpen!=="function")return;
 window.xyJournal.open=function(id){oldOpen(id||"");decorate(id?"edit":"shelf")};
 const prev=openPanel;
 openPanel=function(type){
   const ret=prev(type);
   if(type==="journal")decorate("shelf");
   return ret;
 };
})();