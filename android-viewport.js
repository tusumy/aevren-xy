(()=>{
  const isAndroid=/AevrenXY\/Android/i.test(navigator.userAgent)||new URLSearchParams(location.search).get('app')==='android';
  if(!isAndroid)return;

  const style=document.createElement('style');
  style.textContent=`
    html,body,.app,.main{height:var(--xy-app-height,100dvh)!important;max-height:var(--xy-app-height,100dvh)!important}
    .main,.messages{min-height:0!important}
    body{overflow:hidden!important}
    .composer-wrap{flex:0 0 auto!important}
  `;
  document.head.appendChild(style);

  let nativeHeight=0;
  const applyHeight=value=>{
    const height=Math.max(1,Math.round(value||window.innerHeight||document.documentElement.clientHeight));
    document.documentElement.style.setProperty('--xy-app-height',height+'px');
    document.body.style.height=height+'px';
    document.querySelector('.app')?.style.setProperty('height',height+'px','important');
    document.querySelector('.main')?.style.setProperty('height',height+'px','important');
    requestAnimationFrame(()=>{
      const input=document.activeElement;
      if(input&&/^(TEXTAREA|INPUT)$/.test(input.tagName)){
        input.scrollIntoView({block:'nearest',inline:'nearest'});
        const messages=document.querySelector('#messages');
        if(messages)messages.scrollTop=messages.scrollHeight;
      }
    });
  };

  const sync=()=>{
    if(nativeHeight>0){applyHeight(nativeHeight);return}
    const vv=window.visualViewport;
    applyHeight(vv?.height||window.innerHeight||document.documentElement.clientHeight);
  };

  window.__xyNativeVisibleHeight=value=>{
    nativeHeight=Number(value)>0?Number(value):0;
    sync();
  };

  sync();
  window.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('scroll',sync,{passive:true});
  document.addEventListener('focusin',()=>setTimeout(sync,30));
  document.addEventListener('focusout',()=>setTimeout(()=>{nativeHeight=0;sync()},120));
})();
