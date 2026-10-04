(()=>{
  const box=document.querySelector('#messages');
  if(!box)return;

  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return v}};
  const currentChat=()=>{try{return chat()}catch{return null}};
  const activeVariant=m=>Array.isArray(m?.variants)&&m.variants.length?Math.min(Math.max(Number(m.activeVariant)||0,0),m.variants.length-1):0;
  const variantText=m=>Array.isArray(m?.variants)&&m.variants.length?String(m.variants[activeVariant(m)]?.text??m.text??''):String(m?.text??'');

  function syncMessage(m){
    if(m?.role!=='assistant'||!Array.isArray(m.variants)||!m.variants.length)return;
    const i=activeVariant(m),v=m.variants[i];
    m.activeVariant=i;m.text=String(v?.text??'');
    if(v?.createdAt)m.createdAt=v.createdAt;
    if(v?.editedAt)m.editedAt=v.editedAt;else delete m.editedAt;
  }
  function syncAll(){currentChat()?.messages?.forEach(syncMessage)}
  function ensureVariants(m,tail){
    if(Array.isArray(m.variants)&&m.variants.length){syncMessage(m);return}
    m.variants=[{text:String(m.text??''),createdAt:m.createdAt||Date.now(),editedAt:m.editedAt||null,tail:clone(tail||[])}];m.activeVariant=0;
  }
  function saveCurrentTail(c,index){
    const m=c.messages[index];if(!m||!Array.isArray(m.variants)||!m.variants.length)return;
    m.variants[activeVariant(m)].tail=clone(c.messages.slice(index+1));
  }

  function switchVariant(index,nextIndex){
    const c=currentChat(),m=c?.messages?.[index];if(!m||!Array.isArray(m.variants)||!m.variants.length)return;
    const next=Math.max(0,Math.min(nextIndex,m.variants.length-1));if(next===activeVariant(m))return;
    saveCurrentTail(c,index);m.activeVariant=next;syncMessage(m);
    c.messages.splice(index+1,c.messages.length-index-1,...clone(m.variants[next].tail||[]));
    save();renderMessages();
  }

  async function regenerate(index){
    const c=currentChat(),m=c?.messages?.[index];if(!c||!m||m.role!=='assistant'||sending)return;
    let userIndex=index-1;while(userIndex>=0&&c.messages[userIndex]?.role!=='user')userIndex--;
    if(userIndex<0)return showNotice('这条回复前面没有可重试的用户消息',true);

    syncAll();
    const originalMessages=c.messages,originalTitle=c.title,originalInput=document.querySelector('#input')?.value||'';
    const visibleTail=originalMessages.slice(index+1),promptText=String(originalMessages[userIndex].text??'').trim();
    const tempPrefix=clone(originalMessages.slice(0,userIndex));
    if(!promptText)return;

    const oldSave=save,oldRenderMessages=renderMessages,oldRenderChats=renderChats,oldShowTyping=showTyping,oldHideTyping=hideTyping;
    let generated='';
    try{
      c.messages=tempPrefix;
      save=()=>{};renderMessages=()=>{};renderChats=()=>{};showTyping=()=>{};hideTyping=()=>{};
      const input=document.querySelector('#input');if(input)input.value=promptText;
      await send();
      const last=[...c.messages].reverse().find(x=>x?.role==='assistant');
      generated=String(last?.text??'').trim();
    }finally{
      save=oldSave;renderMessages=oldRenderMessages;renderChats=oldRenderChats;showTyping=oldShowTyping;hideTyping=oldHideTyping;
      c.messages=originalMessages;c.title=originalTitle;
      const input=document.querySelector('#input');if(input)input.value=originalInput;
      try{resize()}catch{}
    }

    if(!generated)return showNotice('这次没有生成新的回复',true);
    if(/^请求失败[:：]/.test(generated))return showNotice(generated,true);

    const target=c.messages[index];if(!target)return;
    ensureVariants(target,visibleTail);saveCurrentTail(c,index);
    target.variants.push({text:generated,createdAt:Date.now(),editedAt:null,tail:[]});
    target.activeVariant=target.variants.length-1;syncMessage(target);
    c.messages.splice(index+1);save();renderMessages();
  }

  function closeEditor(){document.querySelector('.xy-edit-backdrop')?.remove()}
  function editAssistant(index){
    closeEditor();const c=currentChat(),m=c?.messages?.[index];if(!m||m.role!=='assistant')return;
    const wrap=document.createElement('div');wrap.className='xy-edit-backdrop';
    wrap.innerHTML='<div class="xy-edit-card" role="dialog" aria-modal="true"><div class="xy-edit-title">编辑这条回复</div><textarea rows="8"></textarea><div class="xy-edit-actions"><button type="button" data-edit-act="cancel">取消</button><button type="button" class="primary" data-edit-act="save">保存</button></div></div>';
    const area=wrap.querySelector('textarea');area.value=variantText(m);document.body.appendChild(wrap);
    requestAnimationFrame(()=>{area.focus();area.setSelectionRange(area.value.length,area.value.length)});
    wrap.addEventListener('click',e=>{
      const act=e.target?.dataset?.editAct;if(e.target===wrap||act==='cancel'){closeEditor();return}if(act!=='save')return;
      const next=area.value.trim();if(!next)return;const live=currentChat(),target=live?.messages?.[index];if(!target)return closeEditor();
      if(Array.isArray(target.variants)&&target.variants.length){const ai=activeVariant(target);target.variants[ai].text=next;target.variants[ai].editedAt=Date.now()}
      target.text=next;target.editedAt=Date.now();save();closeEditor();renderMessages();
    });
  }

  function showNotice(text,isError=false){
    document.querySelector('.xy-msg-notice')?.remove();const n=document.createElement('div');
    n.className='xy-msg-notice'+(isError?' error':'');n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),3000);
  }

  function decorate(){
    const c=currentChat();if(!c)return;
    c.messages.forEach((m,index)=>{
      if(m?.role!=='assistant')return;
      const rows=[...box.querySelectorAll(`.message.assistant[data-message="${index}"]`)];const host=rows.at(-1);
      if(!host||host.querySelector('.xy-msg-tools'))return;
      rows.forEach(row=>row.querySelector('.bubble')?.setAttribute('data-longpress-edit',String(index)));
      const tools=document.createElement('div');tools.className='xy-msg-tools';
      tools.innerHTML=`<button type="button" data-msg-retry="${index}" aria-label="重新生成" title="重新生成">↻</button>`;
      host.appendChild(tools);
      if(Array.isArray(m.variants)&&m.variants.length>1){
        const ai=activeVariant(m),pager=document.createElement('div');pager.className='xy-branch-pager';
        pager.innerHTML=`<button type="button" data-branch-prev="${index}" ${ai<=0?'disabled':''}>‹</button><span>${ai+1}/${m.variants.length}</span><button type="button" data-branch-next="${index}" ${ai>=m.variants.length-1?'disabled':''}>›</button>`;
        host.appendChild(pager);
      }
    });
  }

  const priorRender=renderMessages;
  renderMessages=function(){syncAll();const r=priorRender();requestAnimationFrame(decorate);return r};

  box.addEventListener('click',e=>{
    const retry=e.target.closest?.('[data-msg-retry]');if(retry){e.preventDefault();e.stopPropagation();regenerate(Number(retry.dataset.msgRetry));return}
    const prev=e.target.closest?.('[data-branch-prev]');if(prev){e.preventDefault();e.stopPropagation();const i=Number(prev.dataset.branchPrev),m=currentChat()?.messages?.[i];if(m)switchVariant(i,activeVariant(m)-1);return}
    const next=e.target.closest?.('[data-branch-next]');if(next){e.preventDefault();e.stopPropagation();const i=Number(next.dataset.branchNext),m=currentChat()?.messages?.[i];if(m)switchVariant(i,activeVariant(m)+1)}
  });

  let pressTimer=null,pressTarget=null,startX=0,startY=0,longPressed=false;
  const cancelPress=()=>{if(pressTimer){clearTimeout(pressTimer);pressTimer=null}pressTarget=null};
  box.addEventListener('pointerdown',e=>{
    if(e.button!=null&&e.button!==0)return;
    const bubble=e.target.closest?.('.message.assistant[data-message] .bubble[data-longpress-edit]');
    if(!bubble||e.target.closest?.('button'))return;
    cancelPress();pressTarget=bubble;startX=e.clientX;startY=e.clientY;longPressed=false;
    const index=Number(bubble.dataset.longpressEdit);
    pressTimer=setTimeout(()=>{
      pressTimer=null;longPressed=true;
      if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
      editAssistant(index);
    },520);
  });
  box.addEventListener('pointermove',e=>{
    if(!pressTarget)return;
    if(Math.hypot(e.clientX-startX,e.clientY-startY)>10)cancelPress();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(type=>box.addEventListener(type,cancelPress));
  box.addEventListener('click',e=>{
    if(!longPressed)return;
    const bubble=e.target.closest?.('.message.assistant[data-message] .bubble[data-longpress-edit]');
    if(bubble){e.preventDefault();e.stopPropagation()}
    longPressed=false;
  },true);
  box.addEventListener('contextmenu',e=>{
    const bubble=e.target.closest?.('.message.assistant[data-message] .bubble[data-longpress-edit]');
    if(!bubble)return;
    e.preventDefault();
    if(!pressTimer&&!longPressed)editAssistant(Number(bubble.dataset.longpressEdit));
    cancelPress();
  });

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor()});

  syncAll();renderMessages();
})();
