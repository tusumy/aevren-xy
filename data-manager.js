(()=>{
  "use strict";
  const FORMAT="AevrenXYBackup", VERSION=1, DB_NAME="xy-data-safety-v1", BUCKET="snapshots";
  const PRIVATE_KEYS=new Set(["xy.endpoints","xy.mcps","xy.settings"]);
  const AUTO_MS=60*60*1000, KEEP=8;
  let pendingImport=null, timer=0, snapshotBusy=false, dbPromise=null;
  const $=s=>document.querySelector(s);
  const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const date=s=>{try{return new Date(s).toLocaleString("zh-CN",{hour12:false})}catch{return String(s||"")}};

  function collect(includePrivate){
    const values={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith("xy.")&&(includePrivate||!PRIVATE_KEYS.has(key))){
        const raw=localStorage.getItem(key);
        if(raw!==null)values[key]=raw;
      }
    }
    return values;
  }
  function decode(raw,key,fallback){
    if(!Object.prototype.hasOwnProperty.call(raw,key))return fallback;
    try{return JSON.parse(raw[key])}catch{return fallback}
  }
  function stats(values){
    const cs=decode(values,"xy.chats",[]),js=decode(values,"xy.journals.v1",[]),ms=decode(values,"xy.memories",[]);
    const arr=Array.isArray(cs)?cs:[], messages=arr.flatMap(c=>Array.isArray(c?.messages)?c.messages:[]);
    const meaningful=messages.filter(m=>String(m?.text??"").trim()||(Array.isArray(m?.variants)&&m.variants.some(v=>String(v?.text??"").trim()))).length;
    return {chats:arr.length,messages:messages.length,meaningful,journals:Array.isArray(js)?js.length:0,memories:Array.isArray(ms)?ms.length:0,keys:Object.keys(values).length,bytes:new Blob([JSON.stringify(values)]).size};
  }
  function describe(s){
    return s.chats+" 个对话 · "+s.messages+" 条消息（"+s.meaningful+" 条有正文） · "+s.memories+" 条记忆 · "+s.journals+" 篇日记";
  }
  function warn(s){
    if(s.messages>0&&s.meaningful===0)return "警告：消息还在，但正文全部为空。备份能保存目前状态，不能凭空找回已被删除的文字。";
    if(s.messages>4&&s.meaningful<s.messages/3)return "注意：较多消息正文为空，请先导出备份，避免继续丢失。";
    return "聊天、记忆和日记都保存在本机。浏览器数据被清除时，自动快照也可能一起消失；请定期下载备份文件。";
  }
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error("此浏览器不支持 IndexedDB"));return}
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(BUCKET))request.result.createObjectStore(BUCKET,{keyPath:"id",autoIncrement:true})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("本机快照不可用"));
    }).catch(error=>{dbPromise=null;throw error});
    return dbPromise;
  }
  async function listSnapshots(){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(BUCKET,"readonly").objectStore(BUCKET).getAll();
      request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>b.id-a.id));
      request.onerror=()=>reject(request.error);
    });
  }
  async function saveSnapshot(entry){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(BUCKET,"readwrite");
      tx.objectStore(BUCKET).add(entry);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }
  async function deleteSnapshot(id){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(BUCKET,"readwrite");
      tx.objectStore(BUCKET).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }
  async function snapshot(reason,force=false){
    if(snapshotBusy)return false;
    snapshotBusy=true;
    try{
      const values=collect(true),s=stats(values),existing=await listSnapshots(),latest=existing[0];
      if(!force){
        if(!s.meaningful||!s.messages)return false;
        if(latest&&Date.now()-Date.parse(latest.at)<AUTO_MS)return false;
        if(latest?.stats?.meaningful>=5&&s.meaningful<latest.stats.meaningful/2&&s.messages>=latest.stats.messages/2)return false;
      }
      await saveSnapshot({at:new Date().toISOString(),reason,values,stats:s});
      const all=await listSnapshots();
      for(const old of all.slice(KEEP))await deleteSnapshot(old.id);
      return true;
    }finally{snapshotBusy=false}
  }
  function autoSnapshot(){
    clearTimeout(timer);
    timer=setTimeout(()=>snapshot("自动保护").catch(()=>{}),1500);
  }
  function validate(values){
    if(!values||Array.isArray(values)||typeof values!=="object")throw new Error("备份没有有效数据");
    const keys=Object.keys(values);
    if(!keys.length||keys.some(k=>!k.startsWith("xy.")||typeof values[k]!=="string"))throw new Error("备份字段格式不正确");
    for(const k of ["xy.chats","xy.memories","xy.journals.v1","xy.characters"]){
      if(k in values){try{JSON.parse(values[k])}catch{throw new Error("数据损坏："+k)}}
    }
    if("xy.chats" in values){
      const c=JSON.parse(values["xy.chats"]);
      if(!Array.isArray(c)||c.some(x=>!x||typeof x!=="object"||!Array.isArray(x.messages)))throw new Error("聊天数据结构不正确");
    }
    if("xy.journals.v1" in values&&!Array.isArray(JSON.parse(values["xy.journals.v1"])))throw new Error("日记格式不正确");
    return values;
  }
  function backupPackage(){
    const values=collect(!!$("#xyIncludeConnections")?.checked);
    const s=stats(values);
    return {
      content:JSON.stringify({format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),values},null,2),
      filename:"aevren-xy-backup-"+new Date().toISOString().slice(0,10)+".json",
      stats:s
    };
  }
  async function copyText(value){
    if(navigator.clipboard?.writeText){
      try{await navigator.clipboard.writeText(value);return true}catch{}
    }
    const el=document.createElement("textarea");
    el.value=value;
    el.setAttribute("readonly","");
    el.style.cssText="position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;z-index:-1";
    document.body.appendChild(el);
    el.focus();el.select();el.setSelectionRange(0,value.length);
    let ok=false;
    try{ok=!!document.execCommand("copy")}catch{}
    el.remove();
    return ok;
  }
  async function copyBackup(){
    const pkg=backupPackage();
    if(await copyText(pkg.content)){
      setStatus("备份 JSON 已复制到剪贴板（"+describe(pkg.stats)+"）。请现在粘贴到安全的笔记或文本文件并保存；剪贴板不是永久备份。");
    }else{
      const manual=$("#xyBackupManual");
      if(manual){manual.hidden=false;manual.value=pkg.content;manual.focus();manual.select()}
      setStatus("自动复制未成功。下方已显示完整备份内容，请长按全选并复制到安全的文本文件。",true);
    }
  }
  async function downloadBackup(){
    const pkg=backupPackage();
    // Android APK WebView loads the same hosted frontend, but a blob: download
    // has no DownloadListener in the existing APK. Keep this usable without APK updates.
    if(window.__XY_NATIVE_HTTP__||window.AevrenNative){
      await copyBackup();
      return;
    }
    const blob=new Blob([pkg.content],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=pkg.filename;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    setStatus("已创建下载："+describe(pkg.stats)+"。请检查文件是否保存成功。");
  }
  async function loadPasted(text){
    let obj;
    try{obj=JSON.parse(String(text||""))}catch{throw new Error("粘贴内容不是有效的 JSON")}
    if(obj?.format!==FORMAT||obj?.version!==VERSION)throw new Error("不是支持的砚屿备份版本");
    const values=validate(obj.values);
    return {values,name:"粘贴的备份",date:obj.exportedAt,stats:stats(values)};
  }
  function scoreChat(c){
    const messages=Array.isArray(c?.messages)?c.messages:[];
    return messages.reduce((n,m)=>n+String(m?.text??"").length+(Array.isArray(m?.variants)?m.variants.reduce((a,v)=>a+String(v?.text??"").length,0):0),0);
  }
  function uniqueMerge(current,incoming,keyFn){
    const output=[...current],seen=new Set(output.map(keyFn));
    for(const x of incoming){const k=keyFn(x);if(!seen.has(k)){seen.add(k);output.push(x)}}
    return output;
  }
  function mergeChat(current,incoming){
    const out=[...current],position=new Map(out.map((c,i)=>[String(c.id),i]));
    let nextId=Date.now();
    const uniqueId=()=>{while(position.has(String(nextId)))nextId++;return nextId++};
    for(const c of incoming){
      const k=String(c.id);
      if(!position.has(k)){position.set(k,out.length);out.push(c);continue}
      const i=position.get(k),old=out[i];
      if(JSON.stringify(old.messages)===JSON.stringify(c.messages))continue;
      const oldScore=scoreChat(old),newScore=scoreChat(c);
      if(!oldScore&&newScore){out[i]=c;continue}
      if(!newScore)continue;
      // A collision may be two different conversations using the same ID.
      // Keep both instead of discarding either message history.
      const copy={...c,id:uniqueId(),title:String(c.title||"导入对话")+"（导入副本）"};
      position.set(String(copy.id),out.length);
      out.push(copy);
    }
    return out;
  }
  function buildRestore(incoming,mode){
    const next={};
    for(const [key,raw] of Object.entries(incoming)){
      const original=localStorage.getItem(key);
      if(mode==="replace"||original===null){next[key]=raw;continue}
      let a,b;
      try{a=JSON.parse(original);b=JSON.parse(raw)}catch{continue}
      if(key==="xy.chats"&&Array.isArray(a)&&Array.isArray(b))next[key]=JSON.stringify(mergeChat(a,b));
      else if(key==="xy.journals.v1"&&Array.isArray(a)&&Array.isArray(b))next[key]=JSON.stringify(uniqueMerge(a,b,x=>String(x?.id||"")));
      else if(key==="xy.memories"&&Array.isArray(a)&&Array.isArray(b))next[key]=JSON.stringify(uniqueMerge(a,b,x=>String(x?.characterId||"")+"|"+String(x?.tag||"")+"|"+String(x?.text||"")));
      else if(key==="xy.characters"&&Array.isArray(a)&&Array.isArray(b))next[key]=JSON.stringify(uniqueMerge(a,b,x=>String(x?.id||"")));
    }
    return next;
  }
  function setStatus(msg,error=false){
    const el=$("#xyDataStatus");
    if(el){el.textContent=msg;el.dataset.error=error?"1":"0"}
  }
  async function restore(values,mode,label){
    validate(values);
    const changes=buildRestore(values,mode),keys=Object.keys(changes);
    if(!keys.length){setStatus("没有需要导入的新数据。");return}
    const action=mode==="replace"?"覆盖备份内对应的数据项":"合并不同记录并优先保留有正文的聊天";
    if(!window.confirm("确定要"+action+"吗？\n来源："+label+"\n执行前会尝试保留一次本机保护快照。"))return;
    try{
      const protectedCopy=await snapshot("恢复前保护",true);
      if(!protectedCopy)throw new Error("有另一项备份正在执行，请稍后重试");
    }catch(e){
      setStatus("无法建立恢复前快照，已停止导入。请先导出当前备份文件。"+e.message,true);return;
    }
    const old=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
    try{
      for(const k of keys)localStorage.setItem(k,changes[k]);
    }catch(e){
      for(const k of keys){try{old[k]===null?localStorage.removeItem(k):localStorage.setItem(k,old[k])}catch{}}
      setStatus("导入失败，已尝试还原原数据："+e.message,true);return;
    }
    window.alert("数据恢复已写入本机，即将重新载入砚屿。");
    location.reload();
  }
  async function loadFile(file){
    if(!file)return;
    if(file.size>25*1024*1024)throw new Error("备份文件超过 25 MB，暂不支持导入");
    const text=await file.text();let obj;
    try{obj=JSON.parse(text)}catch{throw new Error("文件不是有效 JSON")}
    if(obj?.format!==FORMAT||obj?.version!==VERSION)throw new Error("不是支持的砚屿备份版本");
    const values=validate(obj.values);
    return {values,name:file.name,date:obj.exportedAt,stats:stats(values)};
  }
  async function drawSnapshots(){
    const host=$("#xySnapshotList");if(!host)return;
    let list;
    try{list=await listSnapshots()}catch(e){host.textContent="本机自动快照不可用："+e.message;return}
    if(!list.length){host.textContent="尚无本地快照。";return}
    host.innerHTML="";
    for(const item of list){
      const row=document.createElement("div");row.className="xy-data-snapshot";
      const info=document.createElement("div");
      const title=document.createElement("strong");title.textContent=date(item.at)+" · "+item.reason;
      const detail=document.createElement("small");detail.textContent=describe(item.stats||stats(item.values));
      info.append(title,detail);
      const button=document.createElement("button");button.type="button";button.textContent="恢复";button.className="xy-data-restore";
      button.addEventListener("click",()=>restore(item.values,"replace","本机快照 "+date(item.at)).catch(e=>setStatus(e.message,true)));
      row.append(info,button);host.appendChild(row);
    }
  }
  function openDataPanel(){
    $("#sidebar")?.classList.remove("open");
    $("#panelEyebrow").textContent="DATA MANAGEMENT";
    $("#panelTitle").textContent="数据管理";
    const root=$("#panelBody");if(!root)return;
    const current=stats(collect(true));
    root.innerHTML=
      '<div class="xy-data-overview"><strong>本机数据</strong><p>'+html(describe(current))+'</p><small>'+html(warn(current))+'</small></div>'+
      '<div class="xy-data-section"><h3>导出备份</h3><p>备份聊天、角色、记忆、日记和外观设置。APK 可复制 JSON，粘贴保存到手机文件；浏览器可直接下载。无需重装 APK。</p>'+
      '<label class="xy-data-check"><input id="xyIncludeConnections" type="checkbox"> 同时备份接口地址、密钥和 MCP 配置（敏感）</label>'+
      '<button type="button" class="panel-action" id="xyExportData">导出备份（APK 自动复制）</button>'+
      '<button type="button" class="panel-action" id="xyCopyData">复制备份 JSON</button>'+
      '<textarea id="xyBackupManual" rows="5" hidden aria-label="手动复制备份 JSON" style="width:100%;margin-top:8px;font-size:11px;min-height:110px"></textarea></div>'+
      '<div class="xy-data-section"><h3>导入备份</h3><p>选择备份文件，或者粘贴备份 JSON。默认安全合并，不直接清空现有对话。</p>'+
      '<label class="xy-data-pick">选择 .json 备份文件<input id="xyImportFile" type="file" accept=".json,application/json" hidden></label>'+
      '<textarea id="xyImportPaste" rows="3" placeholder="也可以在这里粘贴备份 JSON" style="width:100%;min-height:75px;margin-bottom:7px;font-size:11px"></textarea>'+
      '<button type="button" class="panel-action" id="xyParsePaste">读取粘贴的备份</button>'+
      '<div id="xyImportPreview" class="xy-data-preview">尚未选择文件或粘贴备份</div>'+
      '<select id="xyImportMode"><option value="merge">安全合并（推荐）</option><option value="replace">按备份覆盖</option></select>'+
      '<button type="button" class="panel-action" id="xyApplyImport" disabled>确认导入</button></div>'+
      '<div class="xy-data-section"><h3>本机历史快照</h3><p>存储于浏览器 IndexedDB；自动最多保留 8 份，至少相隔一小时。清除网站数据也会删除这些快照。</p>'+
      '<button type="button" class="panel-action" id="xyCreateSnapshot">立即保存保护快照</button>'+
      '<div id="xySnapshotList" class="xy-data-snapshot-list">正在读取…</div></div>'+
      '<div id="xyDataStatus" role="status" class="xy-data-status"></div>';
    $("#panel").classList.add("open");$("#scrim").classList.add("show");
    $("#xyExportData").onclick=()=>downloadBackup().catch(e=>setStatus("导出失败："+e.message,true));
    $("#xyCopyData").onclick=()=>copyBackup().catch(e=>setStatus("复制失败："+e.message,true));
    $("#xyParsePaste").onclick=async()=>{
      pendingImport=null;$("#xyApplyImport").disabled=true;
      try{
        pendingImport=await loadPasted($("#xyImportPaste").value);
        $("#xyImportPreview").textContent=pendingImport.name+" · "+date(pendingImport.date)+"\n"+describe(pendingImport.stats);
        $("#xyApplyImport").disabled=false;
        setStatus("备份校验通过，可选择安全合并导入。");
      }catch(e){setStatus("无法读取备份："+e.message,true)}
    };
    $("#xyCreateSnapshot").onclick=async()=>{
      try{await snapshot("手动保存",true);setStatus("本机快照已保存。");await drawSnapshots()}
      catch(e){setStatus("快照失败："+e.message,true)}
    };
    $("#xyImportFile").onchange=async e=>{
      pendingImport=null;$("#xyApplyImport").disabled=true;
      try{
        pendingImport=await loadFile(e.target.files?.[0]);
        if(pendingImport){
          $("#xyImportPreview").textContent=pendingImport.name+" · "+date(pendingImport.date)+"\n"+describe(pendingImport.stats)+
            (Object.keys(pendingImport.values).some(k=>PRIVATE_KEYS.has(k))?"\n包含接口连接或密钥设置":"");
          $("#xyApplyImport").disabled=false;
        }
      }catch(error){$("#xyImportPreview").textContent="无法读取："+error.message;setStatus(error.message,true)}
    };
    $("#xyApplyImport").onclick=()=>{if(!pendingImport)return;restore(pendingImport.values,$("#xyImportMode").value,pendingImport.name).catch(e=>setStatus(e.message,true))};
    drawSnapshots();
  }
  const priorOpenPanel=openPanel;
  openPanel=function(type){if(type==="data")return openDataPanel();return priorOpenPanel(type)};
  const originalSave=save;
  save=function(){const result=originalSave.apply(this,arguments);autoSnapshot();return result};
  setTimeout(()=>snapshot("打开砚屿时自动保护").catch(()=>{}),1800);
  window.xyDataManager={stats:()=>stats(collect(true)),exportBackup:downloadBackup};
})();