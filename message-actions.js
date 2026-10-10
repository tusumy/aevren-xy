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
    m.heartShort=String(v?.heartShort??'');m.heartFull=String(v?.heartFull??'');
    if(v?.createdAt)m.createdAt=v.createdAt;
    if(v?.editedAt)m.editedAt=v.editedAt;else delete m.editedAt;
  }
  function syncAll(){currentChat()?.messages?.forEach(syncMessage)}
  function ensureVariants(m,tail){
    if(Array.isArray(m.variants)&&m.variants.length){syncMessage(m);return}
    m.variants=[{text:String(m.text??''),heartShort:m.heartShort||'',heartFull:m.heartFull||'',createdAt:m.createdAt||Date.now(),editedAt:m.editedAt||null,tail:clone(tail||[])}];m.activeVariant=0;
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
    const c=currentChat(),target=c?.messages?.[index];
    if(!c||!target||target.role!=='assistant'||sending)return;
    if(typeof window.AevrenApiCompat?.send!=='function'){
      showNotice('重新生成模块未准备好，请重新打开砚屿',true);return;
    }
    let userIndex=index-1;
    while(userIndex>=0&&c.messages[userIndex]?.role!=='user')userIndex--;
    if(userIndex<0)return showNotice('这条回复前没有对应的用户消息',true);
    syncAll();
    const originalMessages=c.messages,originalTitle=c.title;
    const selected=c.messages[index];
    const prompt=c.messages[userIndex];
    const promptText=String(prompt.text??'');
    const promptAttachments=clone(prompt.attachments||[]);
    if(!promptText.trim()&&!promptAttachments.length){
      showNotice('找不到这条回复对应的用户内容',true);return;
    }
    // A direct API send is essential here: the normal send() is a delayed
    // batching queue and can drain after the temporary chat is restored.
    const tempPrefix=clone(originalMessages.slice(0,userIndex));
    const input=document.querySelector('#input'),originalInput=input?.value||'';
    const originalAttachments=window.xyActiveSendAttachments;
    const oldSave=save,oldRenderMessages=renderMessages,oldRenderChats=renderChats;
    const oldShowTyping=showTyping,oldHideTyping=hideTyping;
    let generated='',generatedHeart={short:'',full:''},error=null;
    try{
      c.messages=tempPrefix;
      save=()=>{};renderMessages=()=>{};renderChats=()=>{};showTyping=()=>{};hideTyping=()=>{};
      if(input)input.value=promptText;
      window.xyActiveSendAttachments=promptAttachments;
      await window.AevrenApiCompat.send();
      const last=c.messages.at(-1);
      if(last?.role==='assistant'){
        generated=String(last.text??'').trim();
        generatedHeart={short:String(last.heartShort||''),full:String(last.heartFull||'')};
      }
    }catch(err){error=String(err?.message||err)}
    finally{
      save=oldSave;renderMessages=oldRenderMessages;renderChats=oldRenderChats;
      showTyping=oldShowTyping;hideTyping=oldHideTyping;
      window.xyActiveSendAttachments=originalAttachments;
      c.messages=originalMessages;c.title=originalTitle;
      if(input)input.value=originalInput;
      try{resize()}catch{}
      const sendButton=document.querySelector('#sendBtn');
      if(sendButton)sendButton.disabled=false;
    }
    if(error)return showNotice('重新生成失败：'+error,true);
    if(!generated)return showNotice('这次没有生成新的回复',true);
    if(/^请求失败[:：]/.test(generated))return showNotice(generated,true);
    // Update the exact selected assistant message; never append at a different
    // index, replace an earlier assistant reply, or delete later conversation.
    if(currentChat()!==c||c.messages[index]!==selected){
      showNotice('聊天内容已变化，未覆盖原消息',true);return;
    }
    ensureVariants(selected,clone(c.messages.slice(index+1)));
    saveCurrentTail(c,index);
    selected.variants.push({
      text:generated,heartShort:generatedHeart.short,heartFull:generatedHeart.full,createdAt:Date.now(),editedAt:null,
      tail:clone(c.messages.slice(index+1))
    });
    selected.activeVariant=selected.variants.length-1;
    syncMessage(selected);
    save();renderMessages();
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
  function insertQuote(index,text){
    const m=currentChat()?.messages?.[index];if(!m)return;
    const input=document.querySelector('#input');if(!input)return;
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(!clean)return;
    const short=clean.length>160?clean.slice(0,160)+'…':clean;
    const who=m.role==='assistant'?(window.xyCurrentCharacter?.()?.name||'玄砚'):'你';
    const prefix=`引用${who}：「${short}」\n`;
    input.value=prefix+(input.value?input.value:'');
    try{resize()}catch{}
    input.focus();input.setSelectionRange(input.value.length,input.value.length);
    showNotice('已引用到输入框');
  }

  function quoteMessage(index){insertQuote(index,messageText(currentChat()?.messages?.[index]))}

  function quoteUnits(text){
    const raw=String(text||'').trim();
    if(!raw)return [];
    const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean),out=[];
    for(const line of lines){
      const parts=line.match(/[^。！？!?…；;]+(?:[。！？!?…；;]+[”’\"）》】]*)|[^。！？!?…；;]+$/g)||[line];
      parts.map(x=>x.trim()).filter(Boolean).forEach(x=>out.push(x));
    }
    return out.length?out:[raw];
  }

  function showQuotePicker(index,point){
    closeLayers();const m=currentChat()?.messages?.[index];if(!m)return;
    const units=quoteUnits(messageText(m));
    if(units.length<=1){insertQuote(index,units[0]||messageText(m));return}
    const wrap=document.createElement('div');wrap.className='xy-context-backdrop';
    wrap.innerHTML=`<div class="xy-context-menu xy-quote-menu" role="menu" aria-label="选择引用句子">${units.map((x,i)=>`<button type="button" data-quote-unit="${i}">${esc(x.length>44?x.slice(0,44)+'…':x)}</button>`).join('')}</div>`;
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
      menu.style.left=Math.round(left)+'px';menu.style.top=Math.round(top)+'px';
    });
    wrap.addEventListener('click',e=>{
      if(e.target===wrap){closeLayers();return}
      const button=e.target.closest?.('[data-quote-unit]');if(!button)return;
      const selected=units[Number(button.dataset.quoteUnit)]||'';
      closeLayers();insertQuote(index,selected);
    });
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
    closeLayers();
    window.xyEnsureOverlayHistory?.();
    const wrap=document.createElement('div');wrap.className='xy-edit-backdrop xy-delete-backdrop';
    wrap.innerHTML='<div class="xy-delete-card" role="dialog" aria-modal="true"><div class="xy-delete-title">真不要这句话了？</div><div class="xy-delete-copy">删掉之后，我就当它没有留在这里</div><div class="xy-delete-actions"><button type="button" data-delete-act="cancel">不删</button><button type="button" class="danger" data-delete-act="confirm">删掉</button></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{
      const act=e.target.closest?.('[data-delete-act]')?.dataset.deleteAct;
      if(e.target===wrap||act==='cancel'){wrap.remove();return}
      if(act!=='confirm')return;
      const live=currentChat();if(!live?.messages?.[index]){wrap.remove();return}
      live.messages.splice(index,1);save();wrap.remove();renderMessages();showNotice('已删除');
    });
  }

  function showContext(index,point,bubble){
    closeLayers();const m=currentChat()?.messages?.[index];if(!m)return;
    bubble?.classList.add('xy-context-active');
    const wrap=document.createElement('div');wrap.className='xy-context-backdrop';
    const assistant=m.role==='assistant';
    const voiceActive=assistant&&window.AevrenVoice?.isMessageSpeaking?.(index,currentChat());
    wrap.innerHTML=`<div class="xy-context-menu" role="menu" aria-label="消息操作">
      <button type="button" data-context-act="copy">复制</button>
      <button type="button" data-context-act="quote">引用整条</button>
      ${assistant?'<button type="button" data-context-act="quote-one">引用一句</button>':''}
      <button type="button" data-context-act="edit">编辑</button>
      <button type="button" data-context-act="remember">记住</button>
      ${assistant?'<button type="button" data-context-act="voice">'+(voiceActive?'停止播放':'播放语音')+'</button>':''}
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
      else if(act==='quote-one'){showQuotePicker(index,point);return}
      else if(act==='edit')editMessage(index);
      else if(act==='remember')rememberMessage(index);
      else if(act==='voice'){if(window.AevrenVoice?.speakMessage)window.AevrenVoice.speakMessage(index,currentChat());else showNotice('语音模块还没准备好',true)}
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