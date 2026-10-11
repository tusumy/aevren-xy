/* 砚屿 · 表情包小抽屉 (independent browser implementation)
 * Assets live in IndexedDB, never in localStorage/chat payloads.
 * Model sees labels for user stickers, stable IDs for its own.
 */
(()=>{
"use strict";
const DB_NAME="xy.sticker-shelf.v1", LIMIT=300, MAX_SIZE=5*1024*1024;
const MARKER=/\[sticker:(u-[a-f0-9]{10})\]/g;
const WRITTEN=/[【\[（(]\s*表情包\s*[：:]\s*([^】\]）)\n]{1,40}?)\s*[】\]）)]/g;
const cache=new Map(), urls=new Map();
let db=null, overlay=null, grid=null, query="", permissionFilter="all";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const activeId=()=>String(chat()?.characterId||window.xyCurrentCharacter?.()?.id||"default");
const activeName=()=>String(window.xyCurrentCharacter?.()?.name||document.querySelector(".presence strong")?.textContent||"当前角色");
const validId=s=>/^u-[a-f0-9]{10}$/.test(s);
const short=s=>String(s||"").trim().replace(/\s+/g," ").slice(0,40);
const scopeOk=(x,id)=>x.scope!=="character"||x.characterId===String(id||activeId());
const allowed=(x,id)=>x.aiEnabled!==false&&scopeOk(x,id);
function tx(store,mode,fn){
  return new Promise((resolve,reject)=>{
    if(!db)return reject(new Error("本机表情包存储不可用"));
    const tr=db.transaction(store,mode),obj=tr.objectStore(store);
    let result;
    try{result=fn(obj)}catch(e){tr.abort();return reject(e)}
    tr.oncomplete=()=>resolve(result);
    tr.onerror=()=>reject(tr.error||new Error("存储失败"));
    tr.onabort=()=>reject(tr.error||new Error("存储中断"));
  });
}
const ready=new Promise(resolve=>{
  if(!window.indexedDB){resolve(false);return}
  let request;
  try{request=indexedDB.open(DB_NAME,1)}catch{resolve(false);return}
  request.onupgradeneeded=()=>{
    const d=request.result;
    if(!d.objectStoreNames.contains("items"))d.createObjectStore("items",{keyPath:"id"});
    if(!d.objectStoreNames.contains("images"))d.createObjectStore("images");
  };
  request.onsuccess=async()=>{
    db=request.result;
    db.onversionchange=()=>{db.close();db=null};
    try{
      const tr=db.transaction("items","readonly"),req=tr.objectStore("items").getAll();
      req.onsuccess=()=>{for(const item of req.result||[])cache.set(item.id,item);resolve(true)};
      req.onerror=()=>resolve(false);
    }catch{resolve(false)}
  };
  request.onerror=()=>resolve(false);
  request.onblocked=()=>resolve(false);
});
function id(){const b=new Uint8Array(5);crypto.getRandomValues(b);return "u-"+Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")}
async function sniff(f){
  const bytes=new Uint8Array(await f.slice(0,12).arrayBuffer());
  const eq=(a)=>a.every((n,i)=>bytes[i]===n);
  if(eq([137,80,78,71,13,10,26,10]))return "image/png";
  if(eq([255,216,255]))return "image/jpeg";
  if(eq([71,73,70,56,55,97])||eq([71,73,70,56,57,97]))return "image/gif";
  if(eq([82,73,70,70])&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80)return "image/webp";
  return "";
}
function toast(t){if(window.xyAttachments?.toast)window.xyAttachments.toast(t);else if(window.xyAttachmentToast)window.xyAttachmentToast(t);else alert(t)}
async function addFiles(files){
  if(!await ready)return toast("当前浏览器无法保存本地表情包");
  let count=0;
  for(const file of Array.from(files||[])){
    if(cache.size>=LIMIT){toast("最多收藏 "+LIMIT+" 张表情包");break}
    if(!file.size||file.size>MAX_SIZE){toast(file.name+" 超过 5 MB 或内容为空");continue}
    const mime=await sniff(file);
    if(!mime){toast(file.name+" 不是支持的图片格式");continue}
    const label=short(file.name.replace(/\.[^.]+$/,"").replace(/[_-]/g," "))||"未命名表情";
    const item={id:id(),label,aiEnabled:true,scope:"all",characterId:activeId(),favorite:false,lastUsed:0,createdAt:Date.now(),mime};
    try{
      // One transaction across both stores: never leave an orphan image.
      await new Promise((resolve,reject)=>{
        const tr=db.transaction(["items","images"],"readwrite");
        tr.objectStore("items").add(item);tr.objectStore("images").add(file,item.id);
        tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error);tr.onabort=()=>reject(tr.error);
      });
      cache.set(item.id,item);count++;
    }catch(e){toast("保存失败："+(e?.message||e))}
  }
  if(count)toast("已收藏 "+count+" 张表情包");
  renderGrid();
}
async function addImageUrl(raw,{quiet=false}={}){
  const notify=msg=>{if(!quiet)toast(msg)};
  if(!await ready){notify("当前浏览器无法保存表情包");return false}
  if(cache.size>=LIMIT){notify("最多收藏 "+LIMIT+" 张表情包");return false}
  let parsed;
  try{parsed=new URL(String(raw||"").trim())}catch{notify("请粘贴完整的 https 图片链接");return false}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.href.length>2048){
    notify("请使用有效的 https 图床图片直链");return false
  }
  parsed.hash="";
  const url=parsed.toString();
  if(Array.from(cache.values()).some(x=>x.remoteUrl===url)){notify("这张表情包已经收藏过了");return false}
  try{
    await new Promise((resolve,reject)=>{
      const probe=new Image();
      const timer=setTimeout(()=>{probe.onload=probe.onerror=null;reject(new Error("图片加载超时"))},12000);
      probe.onload=()=>{clearTimeout(timer);resolve()};
      probe.onerror=()=>{clearTimeout(timer);reject(new Error("无法打开图片，请使用图片直链"))};
      probe.src=url;
    });
  }catch(e){notify(e.message||"图床图片不可用");return false}
  let rawName="";
  try{rawName=decodeURIComponent(parsed.pathname.split("/").pop()||"")}catch{rawName=parsed.pathname.split("/").pop()||""}
  const label=short(rawName.replace(/\.(png|jpe?g|gif|webp)$/i,"").replace(/[_-]+/g," "))||"图床表情";
  const item={id:id(),label,aiEnabled:true,scope:"all",characterId:activeId(),favorite:false,lastUsed:0,createdAt:Date.now(),mime:"image/remote",remoteUrl:url};
  try{
    await tx("items","readwrite",o=>o.add(item));
    cache.set(item.id,item);renderGrid();notify("图床表情已添加");return true
  }catch(e){notify("链接保存失败："+(e?.message||e));return false}
}
async function importImageUrls(raw){
  const field=overlay?.querySelector("#xyStickerUrl");
  const button=overlay?.querySelector('[data-action="import-url"]');
  const status=overlay?.querySelector("#xyStickerImportStatus");
  const matches=String(raw||"").match(/https:\/\/[^\s,，;；<>\\"'“”‘’]+/g)||[];
  const unique=[...new Set(matches.map(x=>x.replace(/[），。\])}]+$/g,"")))];
  if(!unique.length){toast("请粘贴一个或多个 https 图片直链，每行一条");return}
  if(unique.length>100){toast("单次最多导入 100 条图片链接");return}
  if(!await ready){toast("此设备本地存储不可用");return}
  let completed=0,added=0;
  const failures=[];
  if(button)button.disabled=true;
  if(field)field.disabled=true;
  const update=()=>{if(status)status.textContent="正在导入 "+completed+"/"+unique.length+"，成功 "+added+" 张"};
  update();
  try{
    const capacity=Math.max(0,LIMIT-cache.size);
    const selected=unique.slice(0,capacity);
    if(!selected.length){toast("表情包已达到 300 张上限");return}
    // Deliberately sequential so the capacity check remains correct.
    for(const url of selected){
      const ok=await addImageUrl(url,{quiet:true});
      if(ok)added++;else failures.push(url);
      completed++;update();
    }
    if(unique.length>selected.length)failures.push(...unique.slice(selected.length));
    const msg="批量导入结束：成功 "+added+" 张，未导入 "+failures.length+" 张";
    if(status)status.textContent=msg;
    toast(msg);
    if(field&&failures.length===0)field.value="";
    else if(field)field.value=failures.join("\n");
  }finally{
    if(button)button.disabled=false;
    if(field)field.disabled=false;
  }
}
async function edit(id,patch){
  const old=cache.get(id);if(!old)return;
  const item={...old,...patch};
  try{await tx("items","readwrite",o=>o.put(item));cache.set(id,item);renderGrid()}
  catch(e){toast("保存失败："+(e?.message||e))}
}
async function remove(id){
  if(!cache.has(id))return;
  try{
    await new Promise((resolve,reject)=>{
      const tr=db.transaction(["items","images"],"readwrite");
      tr.objectStore("items").delete(id);tr.objectStore("images").delete(id);
      tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error);tr.onabort=()=>reject(tr.error);
    });
    cache.delete(id);if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}
    renderGrid();renderMessages();
  }catch(e){toast("删除失败："+(e?.message||e))}
}
async function imageUrl(id){
  if(urls.has(id))return urls.get(id);
  const item=cache.get(id);
  if(item?.remoteUrl){
    try{const u=new URL(item.remoteUrl);return u.protocol==="https:"?u.href:""}catch{return ""}
  }
  if(!item||!db)return "";
  const blob=await new Promise(resolve=>{
    const tr=db.transaction("images","readonly"),req=tr.objectStore("images").get(id);
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
  });
  if(!blob)return "";
  const url=URL.createObjectURL(blob);
  if(!cache.has(id)){URL.revokeObjectURL(url);return ""}
  if(urls.has(id)){URL.revokeObjectURL(url);return urls.get(id)}
  urls.set(id,url);return url;
}
function sortItems(a,b){return Number(b.favorite)-Number(a.favorite)||(b.lastUsed||0)-(a.lastUsed||0)||(b.createdAt||0)-(a.createdAt||0)}
function context(characterId){
  const entries=Array.from(cache.values()).filter(x=>allowed(x,characterId)).sort(sortItems).slice(0,50);
  if(!entries.length)return "";
  return "可在适合情绪的时候偶尔使用一个表情包，格式独立成段：[sticker:编号]。每条回复最多一个，不编造编号，不解释标记，不必每次都发。用户发来的【表情包：名字】是对方的情绪表达。只可选择以下编号：\n"+entries.map(x=>x.id+"＝"+x.label).join("；");
}
function expandHistory(history){
  const names=new Map(Array.from(cache.values(),x=>[x.id,x.label]));
  for(const m of history||[]){
    const change=t=>String(t||"").replace(MARKER,(_,id)=>{
      const name=names.get(id);
      if(!name)return "【一张已删除的表情包】";
      return m.role==="user"?"【表情包："+name+"】":"[sticker:"+id+"]";
    });
    if(typeof m.content==="string")m.content=change(m.content);
    else if(Array.isArray(m.content))for(const part of m.content)if(part?.type==="text")part.text=change(part.text);
  }
}
function normalizeReply(text,characterId){
  let result=String(text||"");
  const permitted=Array.from(cache.values()).filter(x=>allowed(x,characterId));
  const byName=new Map(permitted.map(x=>[x.label,x.id]));
  result=result.replace(WRITTEN,(whole,name)=>byName.has(name.trim())?"[sticker:"+byName.get(name.trim())+"]":whole);
  result=result.replace(/\[sticker:(u-[a-f0-9]{10})\]\s*[（(]([^）)\n]{1,40})[）)]/g,(all,id,name)=>cache.get(id)?.label===name.trim()?"[sticker:"+id+"]":all);
  return result.replace(MARKER,(all,id)=>cache.has(id)&&allowed(cache.get(id),characterId)?all:"【不可用的表情包】");
}
function renderText(text){
  let out="",start=0,m;const raw=String(text??"");
  MARKER.lastIndex=0;
  while((m=MARKER.exec(raw))){
    out+=escape(raw.slice(start,m.index));
    const id=m[1];
    out+=cache.has(id)?'<img class="xy-sticker-inline" data-xy-sticker="'+id+'" alt="'+escape(cache.get(id).label)+'" loading="lazy">':escape("【一张已删除的表情包】");
    start=MARKER.lastIndex;
  }
  return out+escape(raw.slice(start));
}
async function hydrateRendered(root){
  for(const img of root?.querySelectorAll?.("img[data-xy-sticker]")||[]){
    if(img.dataset.xyLoaded)continue;
    img.dataset.xyLoaded="1";
    const src=await imageUrl(img.dataset.xySticker);
    if(img.isConnected){if(src)img.src=src;else img.replaceWith(document.createTextNode("【一张已删除的表情包】"))}
  }
}
function renderGrid(){
  if(!grid||!overlay||overlay.hidden)return;
  const all=Array.from(cache.values()).sort(sortItems).filter(x=>(permissionFilter!=="mine"||scopeOk(x))&&(!query||(x.label+" "+x.id).toLowerCase().includes(query)));
  grid.replaceChildren();
  if(!all.length){const empty=document.createElement("p");empty.className="xy-sticker-empty";empty.textContent="这里还没有符合条件的表情包";grid.appendChild(empty)}
  for(const s of all){
    const card=document.createElement("div");card.className="xy-sticker-card";
    card.innerHTML='<button class="xy-sticker-pick" type="button" data-action="send" data-id="'+s.id+'" title="发送 '+escape(s.label)+'"><img data-xy-sticker="'+s.id+'" alt="'+escape(s.label)+'"><span>'+escape(s.label)+'</span></button>'+
      '<div class="xy-sticker-actions"><button type="button" data-action="favorite" data-id="'+s.id+'" title="收藏">'+(s.favorite?"♥":"♡")+'</button>'+
      '<button type="button" data-action="ai" data-id="'+s.id+'" title="允许AI发送">'+(s.aiEnabled?"AI ✓":"AI ×")+'</button>'+
      '<button type="button" data-action="scope" data-id="'+s.id+'" title="切换角色范围">'+(s.scope==="character"?"仅此角色":"共享")+'</button>'+
      '<button type="button" data-action="more" data-id="'+s.id+'" aria-label="重命名或删除">⋯</button></div>';
    grid.appendChild(card);
  }
  hydrateRendered(grid);
}
function close(){if(overlay)overlay.hidden=true}
function open(){if(!overlay)return;overlay.hidden=false;overlay.querySelector("#xyStickerSearch").value="";query="";renderGrid()}
async function sendSticker(id){
  const x=cache.get(id);if(!x)return;
  const input=document.querySelector("#input");if(!input)return;
  close();
  const mark="[sticker:"+id+"]";
  if(input.value.trim()){
    input.value+=(input.value.endsWith("\n")?"":"\n")+mark;
    input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();
  }else{
    input.value=mark;input.dispatchEvent(new Event("input",{bubbles:true}));
    try{
      if(window.xySendQueued){
        await window.xySendQueued();
        document.querySelector("#xyReplyNow")?.click();
      }else document.querySelector("#sendBtn")?.click();
    }catch(e){toast("发送失败："+(e?.message||e))}
  }
  edit(id,{lastUsed:Date.now()});
}
let editingId="", editingDelete=false;
function editorNodes(){
  const mask=overlay?.querySelector(".xy-sticker-edit-dialog");
  return {mask,input:mask?.querySelector("#xyStickerEditName"),heading:mask?.querySelector("#xyStickerEditHeading"),help:mask?.querySelector("#xyStickerEditHelp"),field:mask?.querySelector(".xy-sticker-edit-field"),danger:mask?.querySelector('[data-action="rename-delete"]'),save:mask?.querySelector('[data-action="rename-save"]')};
}
function setEditorMode(confirmDelete){
  const {heading,help,field,danger,save}=editorNodes();
  editingDelete=!!confirmDelete;
  if(heading)heading.textContent=editingDelete?"确认删除表情包？":"修改表情包名称";
  if(help)help.textContent=editingDelete?"删除后，历史聊天中的这张表情包也将无法显示。":"名称会帮助 AI 理解这张表情包的意思。";
  if(field)field.style.display=editingDelete?"none":"flex";
  if(danger)danger.textContent=editingDelete?"确认删除":"删除";
  if(save)save.textContent=editingDelete?"返回":"保存";
}
function more(id){
  const item=cache.get(id);if(!item||!overlay)return;
  editingId=id;
  const {mask,input}=editorNodes();
  if(!mask||!input)return;
  input.value=item.label;
  setEditorMode(false);
  if(!mask.open)mask.showModal();
  requestAnimationFrame(()=>{input.focus();input.select()});
}
function closeEditor(){
  const {mask}=editorNodes();
  if(mask?.open)mask.close();
  editingId="";
  editingDelete=false;
}
async function editorAction(action){
  if(action==="rename-cancel"){closeEditor();return}
  if(action==="rename-delete"){
    if(!editingId)return;
    if(!editingDelete){setEditorMode(true);return}
    const id=editingId;closeEditor();await remove(id);return;
  }
  if(action==="rename-save"){
    if(editingDelete){setEditorMode(false);editorNodes().input?.focus();return}
    const label=short(editorNodes().input?.value);
    if(!label){toast("请输入表情包名称");editorNodes().input?.focus();return}
    const id=editingId;closeEditor();await edit(id,{label});return;
  }
}
function installUI(){
  const menu=document.querySelector("#xyAttachMenu");
  if(menu&&!menu.querySelector('[data-attach="sticker"]')){
    const b=document.createElement("button");b.type="button";b.dataset.attach="sticker";
    b.innerHTML="<span>▧</span><b>表情包</b><small>收藏 / 搜索 / AI 发图</small>";
    menu.appendChild(b);
    menu.addEventListener("click",e=>{
      if(!e.target.closest('[data-attach="sticker"]'))return;
      e.preventDefault();e.stopImmediatePropagation();menu.hidden=true;open();
    },true);
  }
  overlay=document.createElement("div");overlay.id="xyStickerShelf";overlay.className="xy-sticker-backdrop";overlay.hidden=true;
  overlay.innerHTML='<section class="xy-sticker-panel" role="dialog" aria-label="表情包小抽屉" aria-modal="true"><header><strong>表情包小抽屉</strong><button type="button" data-action="close" aria-label="关闭">×</button></header>'+
    '<div class="xy-sticker-toolbar"><input id="xyStickerSearch" type="search" placeholder="搜索表情包名称" autocomplete="off"><button type="button" data-action="upload">＋ 上传</button><button type="button" data-action="url">图床 URL</button></div>'+
    '<div class="xy-sticker-urlbar" hidden><textarea id="xyStickerUrl" rows="4" placeholder="粘贴图片直链，每行一条；支持批量导入（最多 100 条）" spellcheck="false"></textarea><button type="button" data-action="import-url">批量导入</button></div><div id="xyStickerImportStatus" class="xy-sticker-import-status" role="status" aria-live="polite"></div>'+
    '<div class="xy-sticker-filter"><button type="button" data-action="filter" aria-pressed="false">只看当前角色</button><small>图片保存在本机；AI 通过名称理解表情</small></div>'+
    '<div class="xy-sticker-grid"></div><input id="xyStickerFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></section>';
  document.body.appendChild(overlay);
  const editor=document.createElement("dialog");
  editor.className="xy-sticker-edit-dialog";
  editor.setAttribute("aria-labelledby","xyStickerEditHeading");
  editor.style.cssText="width:min(360px,90vw);max-width:90vw;border:0;border-radius:18px;padding:8px;background:#faf9f5;color:#344739;box-shadow:0 16px 50px rgba(20,30,24,.2)";
  editor.innerHTML='<section class="xy-sticker-edit-card">'+
    '<header><strong>砚屿</strong><button type="button" data-action="rename-cancel" aria-label="关闭修改窗口">×</button></header>'+
    '<h3 id="xyStickerEditHeading">修改表情包名称</h3>'+
    '<label class="xy-sticker-edit-field" for="xyStickerEditName"><span>表情包名称</span><input id="xyStickerEditName" maxlength="40" autocomplete="off" placeholder="例如：委屈巴巴"></label>'+
    '<p id="xyStickerEditHelp">名称会帮助 AI 理解这张表情包的意思。</p>'+
    '<div class="xy-sticker-edit-actions"><button type="button" class="xy-sticker-edit-danger" data-action="rename-delete">删除</button><button type="button" data-action="rename-cancel">取消</button><button type="button" class="xy-sticker-edit-primary" data-action="rename-save">保存</button></div></section>';
  overlay.appendChild(editor);
  const head=editor.querySelector("header");
  head.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px";
  head.querySelector("strong").style.cssText="font-size:13px;color:#466d55;letter-spacing:1px";
  const closeBtn=head.querySelector("button");
  closeBtn.style.cssText="border:0;background:transparent;font-size:23px;color:#718478";
  editor.querySelector("h3").style.cssText="font-size:17px;margin:0 0 14px";
  const field=editor.querySelector(".xy-sticker-edit-field");
  field.style.cssText="display:flex;flex-direction:column;gap:8px;font-size:12px;color:#5c6f63";
  editor.querySelector("#xyStickerEditName").style.cssText="width:100%;border:1px solid #ccd6cb;border-radius:10px;background:white;padding:10px;font-size:15px;color:#344739";
  editor.querySelector("#xyStickerEditHelp").style.cssText="font-size:12px;color:#7a8b7d;line-height:1.6;margin:12px 0";
  editor.querySelector(".xy-sticker-edit-actions").style.cssText="display:flex;gap:8px;align-items:center";
  editor.querySelectorAll(".xy-sticker-edit-actions button").forEach(btn=>{
    btn.style.cssText="border:1px solid #d7e0d7;border-radius:10px;padding:9px 12px;background:#fff;color:#35503b;font-size:13px";
  });
  editor.querySelector(".xy-sticker-edit-danger").style.cssText+=";margin-right:auto;color:#ab5252";
  editor.querySelector(".xy-sticker-edit-primary").style.cssText+=";background:#385d4b;color:white";
  editor.addEventListener("close",()=>{editingId="";editingDelete=false});
  grid=overlay.querySelector(".xy-sticker-grid");
  overlay.addEventListener("click",async e=>{
    if(e.target===overlay)return close();
    if(e.target===editor){closeEditor();return}
    const button=e.target.closest("button[data-action]");if(!button)return;
    const {action,id}=button.dataset;
    if(action.startsWith("rename-")){await editorAction(action);return}
    if(action==="close")close();
    if(action==="upload")overlay.querySelector("#xyStickerFile").click();
    if(action==="url"){
      const bar=overlay.querySelector(".xy-sticker-urlbar");
      bar.hidden=!bar.hidden;
      if(!bar.hidden)bar.querySelector("textarea")?.focus();
    }
    if(action==="import-url"){
      if(button.disabled)return;
      await importImageUrls(overlay.querySelector("#xyStickerUrl").value);
    }
    if(action==="send")sendSticker(id);
    if(action==="favorite")edit(id,{favorite:!cache.get(id).favorite});
    if(action==="ai")edit(id,{aiEnabled:!cache.get(id).aiEnabled});
    if(action==="scope")edit(id,{scope:cache.get(id).scope==="all"?"character":"all",characterId:activeId()});
    if(action==="more")more(id);
    if(action==="filter"){permissionFilter=permissionFilter==="all"?"mine":"all";button.setAttribute("aria-pressed",String(permissionFilter==="mine"));renderGrid()}
  });
  overlay.querySelector("#xyStickerSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();renderGrid()});
  // Enter inserts a new URL line. Use the import button when ready.
  overlay.querySelector("#xyStickerFile").addEventListener("change",async e=>{await addFiles(e.target.files);e.target.value=""});
  grid.addEventListener("contextmenu",e=>{const card=e.target.closest("[data-id]");if(card){e.preventDefault();more(card.dataset.id)}});
  editor.querySelector("#xyStickerEditName").addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();editorAction("rename-save")}
  });
  document.addEventListener("keydown",e=>{if(e.key!=="Escape"||overlay.hidden)return;e.preventDefault();if(editor.open)closeEditor();else close()});
}
window.xyStickerShelf={ready:()=>ready,context,expandHistory,normalizeReply,renderText,hydrateRendered,open,close};
installUI();
ready.then(()=>{if(typeof renderMessages==="function")renderMessages()});
})();