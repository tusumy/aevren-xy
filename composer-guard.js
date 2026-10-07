(()=>{
  const sendBtn=document.querySelector('#sendBtn');
  if(!sendBtn)return;

  const unlock=()=>{sendBtn.disabled=false;sendBtn.removeAttribute('aria-disabled')};
  unlock();
  window.addEventListener('pageshow',unlock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)unlock()});

  sendBtn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    unlock();
    const queued=window.xySendQueued||window.send;
    if(typeof queued==='function')queued();
  };
})();