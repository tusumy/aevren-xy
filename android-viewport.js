(()=>{
  const isAndroid=/AevrenXY\/Android/i.test(navigator.userAgent)||new URLSearchParams(location.search).get('app')==='android';
  if(!isAndroid)return;

  const style=document.createElement('style');
  style.textContent='html,body,.app,.main{height:var(--xy-app-height,100dvh)!important}.main,.messages{min-height:0!important}';
  document.head.appendChild(style);

  const sync=()=>{
    const vv=window.visualViewport;
    const height=Math.max(1,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight));
    document.documentElement.style.setProperty('--xy-app-height',height+'px');
    if(vv&&document.activeElement&&/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)){
      requestAnimationFrame(()=>document.activeElement?.scrollIntoView({block:'nearest',inline:'nearest'}));
    }
  };

  sync();
  window.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('scroll',sync,{passive:true});
  document.addEventListener('focusin',()=>setTimeout(sync,60));
})();
