(()=>{
  const box=document.querySelector('#messages');
  if(!box)return;

  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return v}};
  const currentChat=()=>{try{return chat()}catch{return null}};
  const activeVariant=m=>Array.isArray(m?.variants)&&m.variants.length?Math.min(Math.max(Number(m.activeVariant)||0,0),m.variants.length-1):0;
  const variantText=m=>Array.isArray(m?.variants)&&m.variants.length?String(m.variants[activeVariant(m)]?.text??m.text??''):String(m?.text??'');
  const messageText=m=>m?.role==='assistant'?variantText(m):String(m?.text??'');

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

  function closeLayers(){
    document.querySelector('.xy-edit-backdrop')?.remove();
    document.querySelector('.xy-context-backdrop')?.remove();
    document.querySelector('.xy-context-active')?.classList.remove('xy-context-active');
  }
  function editMessage(index){
    closeLayers();const c=currentChat(),m=c?.messages?.[index];if(!m)return;
    const wrap=document.createElement('div');wrap.className='xy-edit-backdrop';
    wrap.innerHTML=`<div class="xy-edit-card" role="dialog" aria-modal="true"><div class="xy-edit-title">${m.role==='assistant'?'编辑这条回复':'编辑这条消息'}</div><textarea rows="8"></textarea><div class="xy-edit-actions"><button type="button" data-edit-act="cancel">取消</button><button type="button" class="primary" data-edit-act="save">保存</button></div></div>`;
    const area=wrap.querySelector('textarea');area.value=messageText(m);document.body.appendChild(wrap);
    requestAnimationFrame(()=>{area.focus();area.setSelectionRange(area.value.length,area.value.length)});
    wrap.addEventListener('click',e=>{
      const act=e.target?.dataset?.editAct;if(e.target===wrap||act==='cancel'){closeLayers();return}if(act!=='save')return;
      const next=area.value.trim();if(!next)return;const live=currentChat(),target=live?.messages?.[index];if(!target)return closeLayers();
      if(target.role==='assistant'&&Array.isArray(target.variants)&&target.variants.length){const ai=activeVariant(target);target.variants[ai].text=next;target.variants[ai].editedAt=Date.now()}
      target.text=next;target.editedAt=Date.now();save();closeLayers();renderMessages();
    });
  }

  async function copyMessage(index){
    const m=currentChat()?.messages?.[index];if(!m)return;
    const text=messageText(m);
    try{await navigator.clipboard.writeText(text);showNotice('已复制')}catch{
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');showNotice('已复制')}catch{showNotice('复制失败',true)}finally{ta.remove()}
    }
  }
  function quoteMessage(index){
    const m=currentChat()?.messages?.[index];if(!m)return;
    const input=document.querySelector('#input');if(!input)return;
    const text=messageText(m).replace(/\s+/g,' ').trim();
    const short=text.length>120?text.slice(0,120)+'…':text;
    const who=m.role==='assistant'?(window.xyCurrentCharacter?.()?.name||'玄砚'):'你';
    const prefix=`引用${who}：「${short}」\n`;
    input.value=prefix+(input.value?input.value:'');
    try{resize()}catch{}
    input.focus();input.setSelectionRange(input.value.length,input.value.length);
    showNotice('已引用到输入框');
  }

  function rememberMessage(index){
    const m=currentChat()?.messages?.[index];if(!m)return;
    const text=messageText(m).trim();if(!text)return;
    const characterId=window.xyCurrentCharacter?.()?.id;
    const item={text,tag:'聊天'};
    if(characterId)item.characterId=characterId;
    memories.unshift(item);save();renderChats();
    showNotice('已加入记忆');
  }

  function deleteMessage(index){
    const c=currentChat(),m=c?.messages?.[index];if(!c||!m)return;
    if(!window.confirm('删除这条消息？'))return;
    c.messages.splice(index,1);save();renderMessages();
    showNotice('已删除');
  }

  function showContext(index,point,bubble){
    closeLayers();const m=currentChat()?.messages?.[index];if(!m)return;
    bubble?.classList.add('xy-context-active');
    const wrap=document.createElement('div');wrap.className='xy-context-backdrop';
    const assistant=m.role==='assistant';
    wrap.innerHTML=`<div class="xy-context-menu" role="menu" aria-label="消息操作">
      <button type="button" data-context-act="copy">复制</button>
      <button type="button" data-context-act="quote">引用</button>
      <button type="button" data-context-act="edit">编辑</button>
      <button type="button" data-context-act="remember">记住</button>
      ${assistant?'<button type="button" data-context-act="retry">重新生成</button>':''}
      <button type="button" class="danger" data-context-act="delete">删除</button>
    </div>`;
    document.body.appendChild(wrap);
    const menu=wrap.querySelector('.xy-context-menu');
    requestAnimationFrame(()=>{
      const rect=menu.getBoundingClientRect(),gap=12,pad=10;
      const vw=document.documentElement.clientWidth||window.innerWidth;
      const vh=document.documentElement.clientHeight||window.innerHeight;
      const x=Number(point?.x)||vw/2,y=Number(point?.y)||vh/2;
      let left=x<=vw/2?x+gap:x-rect.width-gap;
      let top=y-Math.min(28,rect.height*.2);
      left=Math.max(pad,Math.min(left,vw-rect.width-pad));
      top=Math.max(pad,Math.min(top,vh-rect.height-pad));
      menu.style.left=Math.round(left)+'px';
      menu.style.top=Math.round(top)+'px';
    });
    wrap.addEventListener('click',e=>{
      const act=e.target.closest?.('[data-context-act]')?.dataset.contextAct;
      if(e.target===wrap){closeLayers();return}
      if(!act)return;
      closeLayers();
      if(act==='copy')copyMessage(index);
      else if(act==='quote')quoteMessage(index);
      else if(act==='edit')editMessage(index);
      else if(act==='remember')rememberMessage(index);
      else if(act==='retry')regenerate(index);
      else if(act==='delete')deleteMessage(index);
    });
  }

  function showNotice(text,isError=false){
    document.querySelector('.xy-msg-notice')?.remove();const n=document.createElement('div');
    n.className='xy-msg-notice'+(isError?' error':'');n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),3000);
  }

  function decorate(){
    const c=currentChat();if(!c)return;
    c.messages.forEach((m,index)=>{
      const rows=[...box.querySelectorAll(`.message.${m.role}[data-message="${index}"]`)];
      rows.forEach(row=>row.querySelector('.bubble')?.setAttribute('data-longpress-message',String(index)));
      if(m?.role!=='assistant')return;
      const host=rows.at(-1);if(!host)return;
      if(Array.isArray(m.variants)&&m.variants.length>1&&!host.querySelector('.xy-branch-pager')){
        const ai=activeVariant(m),pager=document.createElement('div');pager.className='xy-branch-pager';
        pager.innerHTML=`<button type="button" data-branch-prev="${index}" ${ai<=0?'disabled':''}>‹</button><span>${ai+1}/${m.variants.length}</span><button type="button" data-branch-next="${index}" ${ai>=m.variants.length-1?'disabled':''}>›</button>`;
        host.appendChild(pager);
      }
    });
  }

  const priorRender=renderMessages;
  renderMessages=function(){syncAll();const r=priorRender();requestAnimationFrame(decorate);return r};

  box.addEventListener('click',e=>{
    const prev=e.target.closest?.('[data-branch-prev]');if(prev){e.preventDefault();e.stopPropagation();const i=Number(prev.dataset.branchPrev),m=currentChat()?.messages?.[i];if(m)switchVariant(i,activeVariant(m)-1);return}
    const next=e.target.closest?.('[data-branch-next]');if(next){e.preventDefault();e.stopPropagation();const i=Number(next.dataset.branchNext),m=currentChat()?.messages?.[i];if(m)switchVariant(i,activeVariant(m)+1)}
  });

  let pressTimer=null,pressTarget=null,startX=0,startY=0,longPressed=false;
  const cancelPress=()=>{if(pressTimer){clearTimeout(pressTimer);pressTimer=null}pressTarget=null};
  box.addEventListener('pointerdown',e=>{
    if(e.button!=null&&e.button!==0)return;
    const bubble=e.target.closest?.('.message[data-message] .bubble[data-longpress-message]');
    if(!bubble||e.target.closest?.('button'))return;
    cancelPress();pressTarget=bubble;startX=e.clientX;startY=e.clientY;longPressed=false;
    const index=Number(bubble.dataset.longpressMessage);
    pressTimer=setTimeout(()=>{
      pressTimer=null;longPressed=true;
      if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
      showContext(index,{x:startX,y:startY},pressTarget);
    },480);
  });
  box.addEventListener('pointermove',e=>{if(pressTarget&&Math.hypot(e.clientX-startX,e.clientY-startY)>10)cancelPress()});
  ['pointerup','pointercancel','pointerleave'].forEach(type=>box.addEventListener(type,cancelPress));
  box.addEventListener('click',e=>{
    if(!longPressed)return;
    const bubble=e.target.closest?.('.message[data-message] .bubble[data-longpress-message]');
    if(bubble){e.preventDefault();e.stopPropagation()}
    longPressed=false;
  },true);
  box.addEventListener('contextmenu',e=>{
    const bubble=e.target.closest?.('.message[data-message] .bubble[data-longpress-message]');
    if(!bubble)return;
    e.preventDefault();showContext(Number(bubble.dataset.longpressMessage),{x:e.clientX,y:e.clientY},bubble);cancelPress();
  });

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers()});
  syncAll();renderMessages();
})();