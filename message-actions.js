(()=>{
  const box=document.querySelector('#messages');
  if(!box)return;

  const currentChat=()=>{try{return chat()}catch{return null}};

  function closeLayer(){
    document.querySelector('.xy-msg-sheet-backdrop')?.remove();
    document.querySelector('.xy-msg-editor-backdrop')?.remove();
  }

  function decorate(){
    const c=currentChat();
    if(!c)return;
    box.querySelectorAll('.message[data-message]').forEach(row=>{
      const index=Number(row.dataset.message);
      if(!Number.isInteger(index)||!c.messages[index])return;
      const isLastPiece=!box.querySelector(`.message[data-message="${index}"][data-part="${Number(row.dataset.part||0)+1}"]`);
      if(!isLastPiece||row.querySelector('.xy-msg-more'))return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='xy-msg-more';
      btn.dataset.messageAction=String(index);
      btn.setAttribute('aria-label','消息操作');
      btn.textContent='•••';
      const bubble=row.querySelector('.bubble');
      if(!bubble)return;
      bubble.appendChild(btn);
      if(c.messages[index].editedAt){
        const mark=document.createElement('span');
        mark.className='xy-msg-edited';
        mark.textContent='已编辑';
        bubble.appendChild(mark);
      }
    });
  }

  const nativeRender=renderMessages;
  renderMessages=function(){
    const r=nativeRender();
    requestAnimationFrame(decorate);
    return r;
  };

  function sheet(index){
    closeLayer();
    const c=currentChat(),m=c?.messages?.[index];
    if(!m)return;
    const wrap=document.createElement('div');
    wrap.className='xy-msg-sheet-backdrop';
    wrap.innerHTML=`<div class="xy-msg-sheet" role="dialog" aria-modal="true">
      <div class="xy-msg-sheet-title">消息操作</div>
      <button type="button" data-act="edit">编辑这条消息</button>
      <button type="button" data-act="retry">从这里重试</button>
      <button type="button" data-act="cancel">取消</button>
    </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{
      if(e.target===wrap||e.target.dataset.act==='cancel'){closeLayer();return}
      if(e.target.dataset.act==='edit'){closeLayer();editor(index);return}
      if(e.target.dataset.act==='retry'){closeLayer();retryFrom(index)}
    });
  }

  function editor(index){
    closeLayer();
    const c=currentChat(),m=c?.messages?.[index];
    if(!m)return;
    const wrap=document.createElement('div');
    wrap.className='xy-msg-editor-backdrop';
    wrap.innerHTML=`<div class="xy-msg-editor" role="dialog" aria-modal="true">
      <div class="xy-msg-sheet-title">编辑消息</div>
      <textarea rows="7"></textarea>
      <div class="xy-msg-editor-actions"><button type="button" data-act="cancel">取消</button><button type="button" class="primary" data-act="save">保存</button></div>
    </div>`;
    const area=wrap.querySelector('textarea');
    area.value=String(m.text??'');
    document.body.appendChild(wrap);
    setTimeout(()=>{area.focus();area.setSelectionRange(area.value.length,area.value.length)},0);
    wrap.addEventListener('click',e=>{
      if(e.target===wrap||e.target.dataset.act==='cancel'){closeLayer();return}
      if(e.target.dataset.act!=='save')return;
      const next=area.value.trim();
      if(!next)return;
      const live=currentChat();
      if(!live?.messages?.[index])return closeLayer();
      live.messages[index].text=next;
      live.messages[index].editedAt=Date.now();
      save();closeLayer();renderMessages();
    });
  }

  function retryFrom(index){
    const c=currentChat();
    if(!c?.messages?.length)return;
    let userIndex=index;
    while(userIndex>=0&&c.messages[userIndex]?.role!=='user')userIndex--;
    if(userIndex<0){
      alert('这条前面还没有你的消息，不能从这里重试。');
      return;
    }
    const prompt=String(c.messages[userIndex].text??'').trim();
    if(!prompt)return;
    if(!confirm('会从这条开始重新生成，后面的消息会被替换。继续吗？'))return;
    c.messages.splice(userIndex);
    save();renderMessages();
    const input=document.querySelector('#input');
    if(!input)return;
    input.value=prompt;
    try{resize()}catch{}
    requestAnimationFrame(()=>send());
  }

  box.addEventListener('click',e=>{
    const btn=e.target.closest('.xy-msg-more');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    sheet(Number(btn.dataset.messageAction));
  });

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayer()});
  requestAnimationFrame(decorate);
})();
