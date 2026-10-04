(()=>{
  let activeTrace=null;
  let pendingStatus='正在想…';

  const escLocal=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pushTrace=(type,text)=>{
    if(!activeTrace)return;
    activeTrace.push({type,text:String(text||''),at:Date.now()});
  };
  const setStatus=text=>{
    pendingStatus=String(text||'正在想…');
    const el=document.querySelector('#typing .xy-status-text');
    if(el)el.textContent=pendingStatus;
  };

  const baseSelect=window.xySelectMemories;
  if(typeof baseSelect==='function'){
    window.xySelectMemories=function(ch,query){
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

  showTyping=function(){
    const box=document.querySelector('#messages');
    if(!box)return;
    document.querySelector('#typing')?.remove();
    box.insertAdjacentHTML('beforeend',`<div class="message assistant xy-status-message" id="typing"><div class="bubble xy-status-bubble"><span class="xy-status-text">${escLocal(pendingStatus)}</span><span class="xy-status-dots"><i></i><i></i><i></i></span></div></div>`);
    box.scrollTop=box.scrollHeight;
  };

  hideTyping=function(){document.querySelector('#typing')?.remove()};

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
  renderMessages=function(){baseRender();decorateProcesses()};

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.xy-process-toggle');
    if(!btn)return;
    const details=btn.nextElementSibling;if(!details)return;
    details.hidden=!details.hidden;
    btn.setAttribute('aria-expanded',details.hidden?'false':'true');
  });

  const baseSend=send;
  send=async function(){
    const c=chat?.();
    const before=c?.messages?.length||0;
    activeTrace=[];
    pendingStatus='正在想…';
    try{return await baseSend()}
    finally{
      if(c&&activeTrace.length){
        for(let i=c.messages.length-1;i>=before;i--){
          if(c.messages[i]?.role==='assistant'){
            c.messages[i].xyTrace=activeTrace.map(x=>({...x}));
            break;
          }
        }
        try{save()}catch{}
      }
      activeTrace=null;
      pendingStatus='正在想…';
      try{renderMessages()}catch{}
    }
  };

  const btn=document.querySelector('#sendBtn');
  if(btn)btn.onclick=e=>{e.preventDefault();e.stopPropagation();send()};
  decorateProcesses();
})();
