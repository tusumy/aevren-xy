(()=>{
  let activeTrace=null;
  let traceBefore=0;
  let pendingActive=false;
  let pendingStatus='正在想…';

  const escLocal=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const box=()=>document.querySelector('#messages');
  const sendBtn=()=>document.querySelector('#sendBtn');
  const pushTrace=(type,text)=>{if(activeTrace)activeTrace.push({type,text:String(text||''),at:Date.now()})};

  function statusHtml(){
    return `<div class="message assistant xy-status-message" id="typing"><div class="bubble xy-status-bubble"><span class="xy-status-text">${escLocal(pendingStatus)}</span><span class="xy-status-dots"><i></i><i></i><i></i></span></div></div>`;
  }
  function renderStatus(){
    if(!pendingActive)return;
    const host=box();if(!host)return;
    const existing=document.querySelector('#typing');
    if(existing){const text=existing.querySelector('.xy-status-text');if(text)text.textContent=pendingStatus;return}
    host.insertAdjacentHTML('beforeend',statusHtml());
    host.scrollTop=host.scrollHeight;
  }
  function removeStatus(){document.querySelector('#typing')?.remove()}
  function setStatus(text){pendingStatus=String(text||'正在想…');renderStatus()}

  function beginTrace(){
    if(activeTrace)return;
    activeTrace=[];
    traceBefore=chat?.()?.messages?.length||0;
    pendingStatus='正在想…';
    pendingActive=true;
    requestAnimationFrame(renderStatus);
  }
  function finishTrace(){
    if(!activeTrace&&!pendingActive)return;
    const c=chat?.();
    if(c&&activeTrace?.length){
      for(let i=c.messages.length-1;i>=traceBefore;i--){
        if(c.messages[i]?.role==='assistant'){
          c.messages[i].xyTrace=activeTrace.map(x=>({...x}));
          break;
        }
      }
      try{save()}catch{}
    }
    activeTrace=null;
    pendingActive=false;
    pendingStatus='正在想…';
    removeStatus();
    try{renderMessages()}catch{}
  }

  const baseSelect=window.xySelectMemories;
  if(typeof baseSelect==='function'){
    window.xySelectMemories=function(ch,query){
      if(!activeTrace)beginTrace();
      const selected=baseSelect(ch,query);
      const list=Array.isArray(selected)?selected:[];
      const recalled=list.filter(x=>!['角色','身份','规则','核心'].includes(x?.tag));
      const old=recalled.filter(x=>x?.tag==='旧聊天').length;
      if(recalled.length){
        setStatus('翻了翻以前的事…');
        pushTrace('memory',old?`召回 ${recalled.length} 条相关记忆，其中 ${old} 条来自旧聊天`:`召回 ${recalled.length} 条相关记忆`);
      }else if(list.length){
        pushTrace('memory',`带入 ${list.length} 条核心记忆`);
      }
      return selected;
    };
  }

  const baseMcp=window.callMcpTool;
  if(typeof baseMcp==='function'){
    window.callMcpTool=async function(server,tool,args){
      if(!activeTrace)beginTrace();
      const serverName=server?.name||'MCP';
      setStatus(`正在用 ${serverName}…`);
      pushTrace('tool',`调用 ${serverName} / ${tool}`);
      try{
        const result=await baseMcp(server,tool,args);
        pushTrace('tool','工具返回成功');
        setStatus('正在整理回复…');
        return result;
      }catch(err){
        pushTrace('tool',`工具调用失败：${err?.message||err}`);
        throw err;
      }
    };
  }

  function decorateProcesses(){
    const c=chat?.();if(!c)return;
    c.messages.forEach((m,index)=>{
      if(m?.role!=='assistant'||!Array.isArray(m.xyTrace)||!m.xyTrace.length)return;
      const pieces=[...document.querySelectorAll(`.message.assistant[data-message="${index}"]`)];
      const host=pieces.at(-1);if(!host||host.querySelector('.xy-process'))return;
      const details=m.xyTrace.map(x=>`<div class="xy-process-item"><span>${x.type==='memory'?'⌁':x.type==='tool'?'⌘':'·'}</span><p>${escLocal(x.text)}</p></div>`).join('');
      host.insertAdjacentHTML('beforeend',`<div class="xy-process"><button type="button" class="xy-process-toggle" aria-expanded="false">过程 · ${m.xyTrace.length}</button><div class="xy-process-details" hidden>${details}</div></div>`);
    });
  }

  const baseRender=renderMessages;
  renderMessages=function(){
    baseRender();
    decorateProcesses();
    if(pendingActive)requestAnimationFrame(renderStatus);
  };

  document.addEventListener('click',e=>{
    const toggle=e.target.closest?.('.xy-process-toggle');
    if(toggle){
      const details=toggle.nextElementSibling;if(!details)return;
      details.hidden=!details.hidden;
      toggle.setAttribute('aria-expanded',details.hidden?'false':'true');
    }
  },true);

  const btn=sendBtn();
  if(btn){
    new MutationObserver(()=>{
      if(btn.disabled){beginTrace();renderStatus()}
      else if(pendingActive)requestAnimationFrame(finishTrace);
    }).observe(btn,{attributes:true,attributeFilter:['disabled']});
  }

  decorateProcesses();
})();