(()=>{
  "use strict";
  const TRASH_KEY="xy.mcpTrash.v1";
  const DB_NAME="xy-data-safety-v1";
  const DB_BUCKET="snapshots";
  const MAX_TRASH=30;
  let modal=null, recoveryGeneration=0;

  const getTrash=()=>{
    try{
      const list=JSON.parse(localStorage.getItem(TRASH_KEY)||"[]");
      return Array.isArray(list)?list.filter(x=>x&&x.item&&typeof x.item==="object"):[];
    }catch{return []}
  };
  const clone=x=>JSON.parse(JSON.stringify(x));
  const label=x=>String(x?.name||"未命名 MCP");
  const same=(a,b)=>
    (String(a?.id||"")&&String(a.id)===String(b?.id||"")) ||
    (String(a?.url||"").trim()&&String(a.url).trim()===String(b?.url||"").trim());

  function closeModal(){
    if(!modal)return;
    const focusBack=modal._previousFocus;
    modal.remove();modal=null;
    try{focusBack?.focus?.({preventScroll:true})}catch{}
  }

  function confirmDelete(index){
    if(!Number.isSafeInteger(index)||index<0||index>=mcps.length)return;
    const selected=mcps[index];
    if(!selected)return;
    closeModal();
    const overlay=document.createElement("div");
    overlay.className="xy-mcp-backdrop";
    overlay.id="xyMcpDeleteConfirm";
    overlay._previousFocus=document.activeElement;
    overlay.innerHTML=
      '<div class="xy-mcp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="xyMcpDeleteTitle" aria-describedby="xyMcpDeleteHint">'+
      '<div class="xy-mcp-warning-icon" aria-hidden="true">!</div>'+
      '<h3 id="xyMcpDeleteTitle">删除这个 MCP？</h3>'+
      '<p class="xy-mcp-target" id="xyMcpDeleteName"></p>'+
      '<p id="xyMcpDeleteHint">删除后会移入本机回收站，可以找回连接配置和密钥。不会删除其他 MCP。</p>'+
      '<div class="xy-mcp-dialog-actions"><button type="button" data-action="cancel" class="xy-mcp-cancel">取消</button>'+
      '<button type="button" data-action="delete" class="xy-mcp-danger">移入回收站</button></div>'+
      '<div class="xy-mcp-dialog-error" role="alert" hidden></div></div>';
    overlay.querySelector("#xyMcpDeleteName").textContent=label(selected);
    const error=overlay.querySelector(".xy-mcp-dialog-error");
    overlay.addEventListener("click",e=>{
      if(e.target===overlay||e.target.closest('[data-action="cancel"]')){closeModal();return}
      if(!e.target.closest('[data-action="delete"]'))return;
      const i=mcps.findIndex(x=>x===selected||(selected.id&&String(x.id)===String(selected.id)));
      if(i<0){error.textContent="这个 MCP 已经不存在，已取消删除。";error.hidden=false;return}
      // Preserve the entire record first (including token and discovered tools).
      // If the trash write fails, don't delete the live MCP.
      const previous=localStorage.getItem(TRASH_KEY);
      let recovered;
      try{
        recovered={item:clone(mcps[i]),at:Date.now()};
        localStorage.setItem(TRASH_KEY,JSON.stringify([recovered,...getTrash()].slice(0,MAX_TRASH)));
      }catch(err){
        error.textContent="无法保存回收站，删除已取消："+String(err?.message||err);
        error.hidden=false;return;
      }
      const removed=mcps.splice(i,1)[0];
      try{save()}catch(err){
        mcps.splice(i,0,removed);
        try{previous===null?localStorage.removeItem(TRASH_KEY):localStorage.setItem(TRASH_KEY,previous)}catch{}
        error.textContent="删除失败，原配置已保留："+String(err?.message||err);
        error.hidden=false;return;
      }
      closeModal();openPanel("mcp");
    });
    overlay.addEventListener("keydown",e=>{
      if(e.key==="Escape"){e.preventDefault();closeModal()}
      // Simple focus trap: no focus escapes behind this dialog.
      if(e.key==="Tab"){
        const buttons=[...overlay.querySelectorAll("button:not([disabled])")];
        const first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    });
    document.body.appendChild(overlay);modal=overlay;
    overlay.querySelector('[data-action="cancel"]')?.focus();
  }

  function toastInPanel(message,isError=false){
    const host=document.querySelector("#xyMcpRecoveryStatus");
    if(!host)return;
    host.textContent=message;
    host.dataset.error=isError?"1":"0";
  }

  // Additive restoration only. Never replace other MCPs, chat history, models or settings.
  function restoreOne(server,source){
    if(!server||typeof server!=="object"){toastInPanel("恢复数据无效",true);return}
    if(mcps.some(x=>same(x,server))){
      toastInPanel("这个 MCP 已经存在，无需重复恢复。");return;
    }
    let copy;
    try{copy=clone(server)}catch{toastInPanel("MCP 备份数据损坏",true);return}
    if(!copy.id||mcps.some(x=>String(x.id)===String(copy.id)))copy.id="mcp-restored-"+Date.now();
    copy.status="已恢复 · 请重新连接检查";
    // For security, do not make network calls automatically when restoring.
    copy.session="";
    const oldMcps=mcps.slice();
    mcps.push(copy);
    try{save()}catch(e){
      mcps.splice(0,mcps.length,...oldMcps);
      toastInPanel("无法写入恢复数据："+String(e?.message||e),true);return;
    }
    if(source?.kind==="trash"){
      try{
        const all=getTrash();
        const index=all.findIndex(x=>x.at===source.at&&same(x.item,server));
        if(index>=0){all.splice(index,1);localStorage.setItem(TRASH_KEY,JSON.stringify(all))}
      }catch{}
    }
    openPanel("mcp");
    toastInPanel("已找回「"+label(copy)+"」，连接密钥也随本机记录恢复。请点连接验证。");
  }

  function candidatesFromSnapshots(snapshots){
    const unique=[];
    for(const snap of snapshots){
      const raw=snap?.values?.["xy.mcps"];
      if(!raw)continue;
      let records;
      try{records=JSON.parse(raw)}catch{continue}
      if(!Array.isArray(records))continue;
      for(const server of records){
        if(!server||typeof server!=="object")continue;
        if(mcps.some(x=>same(x,server)))continue;
        if(unique.some(x=>same(x.item,server)))continue;
        unique.push({item:server,at:snap.at,reason:snap.reason||"本机快照"});
        if(unique.length>=35)return unique;
      }
    }
    return unique;
  }

  async function fetchLocalCandidates(){
    if(!window.indexedDB)throw new Error("本机不支持历史快照");
    const db=await new Promise((resolve,reject)=>{
      // Read the same IndexedDB collection used by Data Management.
      const req=indexedDB.open(DB_NAME,1);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("打不开快照数据库"));
      req.onupgradeneeded=()=>{/* Missing database means no snapshots yet. */}
    });
    try{
      if(!db.objectStoreNames.contains(DB_BUCKET))return [];
      const records=await new Promise((resolve,reject)=>{
        const req=db.transaction(DB_BUCKET,"readonly").objectStore(DB_BUCKET).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error||new Error("无法读取本机快照"));
      });
      return candidatesFromSnapshots(records.sort((a,b)=>(b.id||0)-(a.id||0)));
    }finally{db.close()}
  }

  function renderEntries(host,entries,kind){
    host.replaceChildren();
    for(const entry of entries){
      const row=document.createElement("div");
      row.className="xy-mcp-recovery-row";
      const info=document.createElement("div");
      const name=document.createElement("strong");name.textContent=label(entry.item);
      const when=document.createElement("small");
      const time=Number(entry.at)||Date.parse(entry.at)||Date.now();
      when.textContent=new Date(time).toLocaleString("zh-CN",{hour12:false});
      info.append(name,when);
      const button=document.createElement("button");
      button.type="button";button.textContent="找回";
      button.addEventListener("click",()=>{
        // One server at a time, so a mistaken action is easy to identify.
        restoreOne(entry.item,{kind,at:entry.at});
      });
      row.append(info,button);host.appendChild(row);
    }
  }

  function renderRecovery(){
    const body=document.querySelector("#panelBody"),list=body?.querySelector("#mcpList");
    if(!list)return;
    let panel=body.querySelector("#xyMcpRecovery");
    if(!panel){
      panel=document.createElement("section");
      panel.className="xy-mcp-recovery";
      panel.id="xyMcpRecovery";
      panel.innerHTML=
        '<details class="xy-mcp-recovery-details" id="xyMcpRecoveryDetails">'+
        '<summary><span class="xy-mcp-recovery-icon" aria-hidden="true">↶</span><span class="xy-mcp-recovery-summary"><strong>找回已删除的 MCP</strong><small>回收站 · 本机历史快照</small></span><span class="xy-mcp-recovery-chevron" aria-hidden="true">⌄</span></summary>'+
        '<div class="xy-mcp-recovery-body">'+
        '<p>只恢复缺失的 MCP 连接，不覆盖你的聊天、模型或其他数据。</p>'+
        '<div id="xyMcpTrashItems"></div>'+
        '<button type="button" id="xyMcpScanSnapshots">查找本机历史快照</button>'+
        '<div id="xyMcpSnapshotItems"></div>'+
        '<div class="xy-mcp-recovery-import"><label for="xyMcpBackupFile">从旧备份文件找回 MCP</label>'+
        '<input type="file" id="xyMcpBackupFile" accept=".json,application/json">'+
        '<small>旧备份需包含 MCP 连接配置。只读取本地文件，不上传。</small>'+
        '<div id="xyMcpBackupItems"></div></div>'+
        '<div id="xyMcpRecoveryStatus" role="status" aria-live="polite"></div></div></details>';
      list.after(panel);
    }
    renderEntries(panel.querySelector("#xyMcpTrashItems"),getTrash().filter(x=>!mcps.some(y=>same(y,x.item))),"trash");
    const historyBtn=panel.querySelector("#xyMcpScanSnapshots");
    historyBtn.onclick=async()=>{
      const token=++recoveryGeneration,host=panel.querySelector("#xyMcpSnapshotItems");
      historyBtn.disabled=true;historyBtn.textContent="正在查找…";
      try{
        const list=await fetchLocalCandidates();
        if(token!==recoveryGeneration||!panel.isConnected)return;
        if(!list.length){host.textContent="没有找到包含已删除 MCP 的本机快照。";return}
        renderEntries(host,list,"snapshot");
        toastInPanel("在历史快照中找到 "+list.length+" 条可找回的连接。");
      }catch(err){
        if(panel.isConnected)toastInPanel("快照读取失败："+String(err?.message||err),true);
      }finally{
        if(panel.isConnected){historyBtn.disabled=false;historyBtn.textContent="查找本机历史快照"}
      }
    };
    panel.querySelector("#xyMcpBackupFile").onchange=async e=>{
      const host=panel.querySelector("#xyMcpBackupItems");host.replaceChildren();
      const file=e.target.files?.[0];
      if(!file)return;
      if(file.size>25*1024*1024){toastInPanel("文件超过 25MB",true);return}
      try{
        const obj=JSON.parse(await file.text());
        const raw=obj?.format==="AevrenXYBackup"?obj?.values?.["xy.mcps"]:null;
        const list=typeof raw==="string"?JSON.parse(raw):null;
        if(!Array.isArray(list))throw new Error("这份备份没有包含 MCP 连接数据");
        const possible=list.filter(x=>x&&typeof x==="object"&&!mcps.some(y=>same(y,x)));
        if(!possible.length){toastInPanel("备份中的 MCP 已存在或没有可恢复项");return}
        renderEntries(host,possible.map(item=>({item,at:obj.exportedAt||Date.now()})),"file");
        toastInPanel("备份里找到 "+possible.length+" 条连接，可以逐个找回。");
      }catch(err){toastInPanel(String(err?.message||err),true)}
    };
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){
    const result=previousOpenPanel.apply(this,arguments);
    if(type==="mcp")renderRecovery();
    return result;
  };
  window.xyMcpSafety={askDelete:confirmDelete};
})();
