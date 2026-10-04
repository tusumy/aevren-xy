(()=>{
  const nativeFetch=window.fetch.bind(window);
  const cleanBase=v=>String(v||'').trim().replace(/\/$/,'');
  const cleanProxy=v=>String(v||'').trim().replace(/\/$/,'');

  function draftConfig(url){
    const form=document.querySelector('#endpointForm');
    if(!form||form.hidden)return null;
    const base=cleanBase(document.querySelector('#endpointBase')?.value);
    const proxy=cleanProxy(document.querySelector('#endpointProxy')?.value);
    const proxyKey=String(document.querySelector('#endpointProxyKey')?.value||'').trim();
    if(base&&proxy&&(url===base||url.startsWith(base+'/')))return {base,proxy,proxyKey};
    return null;
  }

  function activeConfig(url){
    const ep=(Array.isArray(endpoints)?endpoints:[]).find(x=>x.active)||endpoints?.[0];
    if(!ep)return null;
    const base=cleanBase(ep.base),proxy=cleanProxy(ep.proxy),proxyKey=String(ep.proxyKey||'').trim();
    if(base&&proxy&&(url===base||url.startsWith(base+'/')))return {base,proxy,proxyKey};
    return null;
  }

  function inputUrl(input){
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.toString();
    if(input instanceof Request)return input.url;
    return String(input||'');
  }

  window.fetch=async function(input,init){
    const url=inputUrl(input);
    const cfg=draftConfig(url)||activeConfig(url);
    if(!cfg)return nativeFetch(input,init);

    const proxied=cfg.proxy+(cfg.proxy.includes('?')?'&':'?')+'target='+encodeURIComponent(url);
    const sourceHeaders=input instanceof Request?input.headers:undefined;
    const headers=new Headers(sourceHeaders||undefined);
    if(init?.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
    if(cfg.proxyKey)headers.set('X-Aevren-Proxy-Key',cfg.proxyKey);

    const next={...(init||{}),headers};
    if(input instanceof Request){
      if(next.method==null)next.method=input.method;
      if(next.body==null&&input.method!=='GET'&&input.method!=='HEAD')next.body=input.body;
      if(next.signal==null)next.signal=input.signal;
      if(next.redirect==null)next.redirect=input.redirect;
    }
    return nativeFetch(proxied,next);
  };

  function injectFields(){
    const form=document.querySelector('#endpointForm');
    const base=document.querySelector('#endpointBase');
    if(!form||!base||document.querySelector('#endpointProxy'))return;
    const proxy=document.createElement('input');
    proxy.id='endpointProxy';
    proxy.placeholder='代理地址（可选，例如 https://aevren-proxy.xxx.workers.dev）';
    const key=document.createElement('input');
    key.id='endpointProxyKey';
    key.type='password';
    key.placeholder='代理密钥（可选，仅保存在本机）';
    base.insertAdjacentElement('afterend',proxy);
    proxy.insertAdjacentElement('afterend',key);
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){
    const result=previousOpenPanel(type);
    if(type==='settings')requestAnimationFrame(injectFields);
    return result;
  };

  let pendingSave=null;
  document.addEventListener('click',e=>{
    if(e.target.id==='addEndpoint')requestAnimationFrame(()=>{
      injectFields();
      const p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
      if(p)p.value='';if(k)k.value='';
    });
    if(e.target.classList?.contains('edit-endpoint')){
      const i=Number(e.target.dataset.i),ep=endpoints?.[i];
      requestAnimationFrame(()=>{
        injectFields();
        const p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
        if(p)p.value=ep?.proxy||'';if(k)k.value=ep?.proxyKey||'';
      });
    }
  });

  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const form=document.querySelector('#endpointForm');
    pendingSave={
      edit:form?.dataset.edit??'',
      proxy:cleanProxy(document.querySelector('#endpointProxy')?.value),
      proxyKey:String(document.querySelector('#endpointProxyKey')?.value||'').trim()
    };
    setTimeout(()=>{
      if(!pendingSave)return;
      const {edit,proxy,proxyKey}=pendingSave;pendingSave=null;
      const index=edit!==''?Number(edit):endpoints.length-1;
      const ep=endpoints[index];if(!ep)return;
      ep.proxy=proxy;ep.proxyKey=proxyKey;
      try{save()}catch{}
    },0);
  },true);

  requestAnimationFrame(injectFields);
})();
