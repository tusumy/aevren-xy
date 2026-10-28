/* 砚屿：本地字体导入 (ttf/otf/woff/woff2).
   Binaries are stored on-device in IndexedDB, never in GitHub, API calls or localStorage. */
(()=>{
 "use strict";
 const DB_NAME="xy.user.fonts.v1", STORE="fonts", PICK_KEY="xy.user.font.selection.v1";
 const LIMIT=25*1024*1024, MAX_ITEMS=12;
 const TYPES=/\.(ttf|otf|woff|woff2)$/i;
 const root=document.documentElement, body=document.getElementById("panelBody");
 if(!body)return;
 const loaded=new Map();
 let saved={id:"",scope:"chat"},records=[],ready=false,loading=null;
 try{
   const v=JSON.parse(localStorage.getItem(PICK_KEY)||"null");
   if(v&&typeof v.id==="string"&&["all","chat","title"].includes(v.scope))saved={id:v.id,scope:v.scope};
 }catch{}
 function openDb(){
   return new Promise((resolve,reject)=>{
     if(!window.indexedDB){reject(new Error("当前设备无法保存本地字体"));return}
     const req=window.indexedDB.open(DB_NAME,1);
     req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"})};
     req.onsuccess=()=>resolve(req.result);
     req.onerror=()=>reject(req.error||new Error("字体数据库无法打开"));
     req.onblocked=()=>reject(new Error("字体存储正被其他页面占用"));
   });
 }
 function operation(mode,run){
   return openDb().then(db=>new Promise((resolve,reject)=>{
     let result;
     const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
     try{
       const req=run(store);
       req.onsuccess=()=>{result=req.result};
       req.onerror=()=>reject(req.error||new Error("字体读写失败"));
     }catch(e){reject(e);return}
     tx.oncomplete=()=>{db.close();resolve(result)};
     tx.onerror=()=>{db.close();reject(tx.error||new Error("字体存储失败"))};
     tx.onabort=()=>{db.close();reject(tx.error||new Error("字体存储已取消"))};
   }));
 }
 const all=()=>operation("readonly",s=>s.getAll());
 const put=rec=>operation("readwrite",s=>s.put(rec));
 const remove=id=>operation("readwrite",s=>s.delete(id));
 const persist=()=>{
   try{localStorage.setItem(PICK_KEY,JSON.stringify(saved))}catch{}
 };
 const scoped=scope=>["all","chat","title"].includes(scope)?scope:"chat";
 function clearStyle(){
   delete root.dataset.xyImportFontScope;
   root.style.removeProperty("--xy-import-font-family");
 }
 function clearActive(){
   saved.id="";persist();clearStyle();render();
 }
 async function loadedFont(rec){
   if(loaded.has(rec.id))return loaded.get(rec.id).family;
   if(typeof FontFace!=="function"||!document.fonts)throw new Error("此浏览器暂不支持字体加载");
   const url=URL.createObjectURL(rec.blob);
   const family="XYImportedFont_"+rec.id.replace(/[^a-zA-Z0-9_]/g,"");
   try{
     const face=new FontFace(family,'url('+JSON.stringify(url)+')');
     await face.load();
     document.fonts.add(face);
     loaded.set(rec.id,{family,url,face});
     return family;
   }catch(e){URL.revokeObjectURL(url);throw new Error("字体文件无法解析，请换一个 TTF / OTF / WOFF 文件")}
 }
 async function apply(id,scope,save=true){
   if(!id){clearStyle();if(save){saved={id:"",scope:scoped(scope)};persist()}render();return}
   const rec=records.find(r=>r.id===id);
   if(!rec)throw new Error("找不到已导入的字体");
   const family=await loadedFont(rec);
   root.style.setProperty("--xy-import-font-family",'"'+family+'"');
   root.dataset.xyImportFontScope=scoped(scope);
   if(save){saved={id,scope:scoped(scope)};persist()}
   render();
 }
 const status=(msg,bad=false)=>{
   const el=body.querySelector("#xyFontImportStatus");
   if(el){el.textContent=msg;el.dataset.error=String(bad)}
 };
 function render(){
   const card=body.querySelector(".xy-font-import-card");
   if(!card)return;
   const select=card.querySelector("#xyFontImportSelect");
   const scope=card.querySelector("#xyFontImportScope");
   if(!select||!scope)return;
   const choice=select.value||saved.id;
   select.replaceChildren();
   const none=document.createElement("option");none.value="";none.textContent="系统默认";select.append(none);
   records.forEach(rec=>{
     const option=document.createElement("option");
     option.value=rec.id;option.textContent=rec.name;select.append(option);
   });
   select.value=records.some(x=>x.id===choice)?choice:(records.some(x=>x.id===saved.id)?saved.id:"");
   scope.value=saved.scope;
   const active=records.find(x=>x.id===saved.id);
   const summary=card.querySelector("#xyFontImportCurrent");
   if(summary)summary.textContent=active?"当前： "+active.name+" · "+({all:"全局",chat:"聊天",title:"标题"}[saved.scope]):"当前使用原有字体";
   const preview=card.querySelector("#xyFontImportPreview");
   if(preview){
     const value=select.value,entry=loaded.get(value);
     preview.style.fontFamily=entry?'"'+entry.family+'",system-ui,sans-serif':"";
   }
   const del=card.querySelector("#xyFontDelete");
   if(del)del.disabled=!select.value;
 }
 function decorate(){
   if(!body.querySelector("#themeBubbleGlass")||body.querySelector(".xy-font-import-card"))return;
   const card=document.createElement("section");
   card.className="theme-setting-card xy-font-import-card";
   card.setAttribute("aria-label","字体导入与设置");
   card.innerHTML=
     '<p class="xy-font-heading">字体导入</p>'+
     '<p class="xy-font-help">从手机选择字体文件，保存在本机。支持 TTF、OTF、WOFF、WOFF2，最大 25 MB。</p>'+
     '<label class="xy-font-upload">＋ 从文件导入字体<input id="xyFontImportFile" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden></label>'+
     '<label class="xy-font-field"><span>选择字体</span><select id="xyFontImportSelect" aria-label="已导入字体"></select></label>'+
     '<label class="xy-font-field"><span>应用范围</span><select id="xyFontImportScope" aria-label="字体应用范围"><option value="all">整个应用</option><option value="chat">只用于聊天</option><option value="title">只用于标题</option></select></label>'+
     '<div class="xy-font-preview" id="xyFontImportPreview">砚屿 · 好久不见，今天想聊些什么？ ABC 123</div>'+
     '<div class="xy-font-actions"><button type="button" id="xyFontUse">应用字体</button><button type="button" id="xyFontDefault">恢复默认</button><button type="button" id="xyFontDelete">删除字体</button></div>'+
     '<p class="xy-font-current" id="xyFontImportCurrent"></p>'+
     '<p class="xy-font-status" id="xyFontImportStatus" role="status" aria-live="polite"></p>';
   const save=body.querySelector("#saveTheme");
   if(save)save.before(card);else body.append(card);
   render();
 }
 async function importFile(file){
   if(!file)return;
   if(!TYPES.test(file.name||""))throw new Error("请选择 TTF、OTF、WOFF 或 WOFF2 字体");
   if(!file.size||file.size>LIMIT)throw new Error("字体大小需要在 25 MB 以内");
   if(!ready)throw new Error("字体存储尚未就绪");
   if(records.length>=MAX_ITEMS)throw new Error("最多保存 12 款字体，请先删除不用的");
   const id="f"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
   const rec={id,name:file.name,blob:file,addedAt:Date.now()};
   // Verify the file is really a usable font before storing it.
   await loadedFont(rec);
   try{await put(rec)}catch(e){
     const current=loaded.get(rec.id);
     if(current){document.fonts.delete(current.face);URL.revokeObjectURL(current.url);loaded.delete(rec.id)}
     throw new Error("本机字体保存失败，请检查存储空间");
   }
   records.push(rec);
   saved={id,scope:scoped(body.querySelector("#xyFontImportScope")?.value||saved.scope)};
   await apply(id,saved.scope);
 }
 async function deleteSelected(id){
   if(!id)return;
   await remove(id);
   records=records.filter(x=>x.id!==id);
   const resource=loaded.get(id);
   if(resource){document.fonts.delete(resource.face);URL.revokeObjectURL(resource.url);loaded.delete(id)}
   if(saved.id===id){saved.id="";persist();clearStyle()}
   render();
 }
 function bind(){
   body.addEventListener("change",async event=>{
     const t=event.target;
     if(t.id==="xyFontImportFile"){
       const file=t.files?.[0];t.value="";
       if(!file)return;
       status("正在导入并检查字体…");
       try{await importFile(file);status("已导入并应用："+file.name)}
       catch(e){status(e.message||"字体导入失败",true)}
     }else if(t.id==="xyFontImportSelect"){
       const found=loaded.get(t.value);
       const preview=body.querySelector("#xyFontImportPreview");
       if(preview)preview.style.fontFamily=found?'"'+found.family+'",system-ui,sans-serif':"";
       if(t.value&&!found){
         const rec=records.find(r=>r.id===t.value);
         if(rec)try{
           const family=await loadedFont(rec);
           if(t.value===body.querySelector("#xyFontImportSelect")?.value&&preview)preview.style.fontFamily='"'+family+'",system-ui,sans-serif';
         }catch(e){status(e.message,true)}
       }
       body.querySelector("#xyFontDelete")?.toggleAttribute("disabled",!t.value);
     }
   });
   body.addEventListener("click",async event=>{
     const button=event.target.closest?.("#xyFontUse,#xyFontDefault,#xyFontDelete");
     if(!button||!body.contains(button))return;
     const id=body.querySelector("#xyFontImportSelect")?.value||"";
     const scope=scoped(body.querySelector("#xyFontImportScope")?.value);
     try{
       if(button.id==="xyFontDefault"){clearActive();status("已恢复默认字体");return}
       if(button.id==="xyFontUse"){
         if(!id){await apply("",scope);status("已恢复默认字体");return}
         await apply(id,scope);status("已应用字体");return;
       }
       if(button.id==="xyFontDelete"){
         if(!id)return;
         await deleteSelected(id);status("已删除选中的字体");
       }
     }catch(e){status(e.message||"字体设置失败",true)}
   });
 }
 async function initialize(){
   try{
     records=await all();
     ready=true;
     if(saved.id){
       if(records.some(r=>r.id===saved.id)){
         try{await apply(saved.id,saved.scope,false)}catch(e){clearStyle();saved.id="";persist()}
       }else{saved.id="";persist();clearStyle()}
     }
     decorate();
   }catch(e){ready=false;decorate();status("此设备暂时无法保存字体文件",true)}
 }
 const observer=new MutationObserver(()=>{
   if(body.querySelector("#themeBubbleGlass")&&!body.querySelector(".xy-font-import-card")){
     decorate();
   }
 });
 observer.observe(body,{childList:true});
 bind();initialize();
})();