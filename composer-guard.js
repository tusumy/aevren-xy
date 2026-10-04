(()=>{
  const sendBtn=document.querySelector('#sendBtn');
  const attachBtn=document.querySelector('.attach');
  const composer=document.querySelector('.composer');
  if(!sendBtn||!composer)return;

  const unlock=()=>{sendBtn.disabled=false;sendBtn.removeAttribute('aria-disabled')};
  unlock();
  window.addEventListener('pageshow',unlock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)unlock()});

  sendBtn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    unlock();
    if(typeof window.send==='function')window.send();
  };

  if(attachBtn){
    let picker=document.querySelector('#xyAttachmentPicker');
    if(!picker){
      picker=document.createElement('input');
      picker.id='xyAttachmentPicker';
      picker.type='file';
      picker.accept='image/*';
      picker.multiple=true;
      picker.hidden=true;
      document.body.appendChild(picker);
    }
    let chip=document.querySelector('#xyAttachmentChip');
    if(!chip){
      chip=document.createElement('div');
      chip.id='xyAttachmentChip';
      chip.hidden=true;
      composer.parentElement?.insertBefore(chip,composer);
    }
    attachBtn.onclick=e=>{e.preventDefault();e.stopPropagation();picker.click()};
    picker.onchange=()=>{
      const files=[...(picker.files||[])];
      window.xyPendingAttachments=files;
      if(!files.length){chip.hidden=true;chip.textContent='';return}
      chip.hidden=false;
      chip.textContent=files.length===1?`已选择图片：${files[0].name}`:`已选择 ${files.length} 张图片`;
    };
  }
})();