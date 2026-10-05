(()=>{
  const isAndroid=/AevrenXY\/Android/i.test(navigator.userAgent)||new URLSearchParams(location.search).get('app')==='android';
  if(!isAndroid)return;

  const root=document.documentElement;
  root.style.setProperty('--xy-ime-bottom','0px');

  const style=document.createElement('style');
  style.textContent=`
    html,body,.app,.main{height:100dvh!important;max-height:100dvh!important}
    .main,.messages{min-height:0!important}
    body{overflow:hidden!important}
    @media(max-width:760px){
      .messages{
        padding-bottom:110px!important;
        scroll-padding-bottom:120px!important;
      }
      .composer-wrap{
        position:fixed!important;
        left:0!important;
        right:0!important;
        bottom:var(--xy-ime-bottom,0px)!important;
        z-index:50!important;
        flex:0 0 auto!important;
        transform:none!important;
        transition:bottom .12s ease-out!important;
      }
      html.xy-ime-open .messages{
        padding-bottom:calc(110px + var(--xy-ime-bottom,0px))!important;
        scroll-padding-bottom:calc(120px + var(--xy-ime-bottom,0px))!important;
      }
    }
  `;
  document.head.appendChild(style);

  let nativeImeBottom=0;

  const scrollChatToBottom=()=>{
    requestAnimationFrame(()=>{
      const messages=document.querySelector('#messages');
      if(messages)messages.scrollTop=messages.scrollHeight;
      const active=document.activeElement;
      if(active&&/^(TEXTAREA|INPUT)$/.test(active.tagName)){
        active.scrollIntoView({block:'nearest',inline:'nearest'});
      }
    });
  };

  const applyImeBottom=value=>{
    const bottom=Math.max(0,Math.round(Number(value)||0));
    root.style.setProperty('--xy-ime-bottom',bottom+'px');
    root.classList.toggle('xy-ime-open',bottom>24);
    if(bottom>24)scrollChatToBottom();
  };

  window.__xyNativeImeBottom=value=>{
    nativeImeBottom=Math.max(0,Number(value)||0);
    applyImeBottom(nativeImeBottom);
  };

  const syncViewportFallback=()=>{
    if(nativeImeBottom>0)return;
    const vv=window.visualViewport;
    if(!vv)return;
    const layoutHeight=window.innerHeight||document.documentElement.clientHeight||0;
    const obscured=Math.max(0,layoutHeight-vv.height-vv.offsetTop);
    applyImeBottom(obscured);
  };

  window.visualViewport?.addEventListener('resize',syncViewportFallback,{passive:true});
  window.visualViewport?.addEventListener('scroll',syncViewportFallback,{passive:true});
  window.addEventListener('resize',syncViewportFallback,{passive:true});

  document.addEventListener('focusin',event=>{
    if(/^(TEXTAREA|INPUT)$/.test(event.target?.tagName||'')){
      setTimeout(()=>{
        syncViewportFallback();
        scrollChatToBottom();
      },80);
    }
  });

  document.addEventListener('focusout',()=>setTimeout(()=>{
    if(!document.activeElement||!/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName||'')){
      nativeImeBottom=0;
      applyImeBottom(0);
    }
  },180));

  syncViewportFallback();
})();