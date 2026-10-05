(()=>{
  const nativeFetch=window.fetch.bind(window);
  const GLOBAL_KEY='xy.globalProxy';
  const cleanBase=v=>String(v||'').trim().replace(/\/$/,'');
  const cleanProxy=v=>String(v||'').trim().replace(/\/$/,'');
  const readGlobal=()=>{try{return JSON.parse(localStorage.getItem(GLOBAL_KEY))||{}}catch{return {}}};
  const writeGlobal=value=>{try{localStorage.setItem(GLOBAL_KEY,JSON.stringify(value||{}))}catch{}};
  let installed=false;

  function inputUrl(input){
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.toString();
    if(input instanceof Request)return input.url;
    return String(input||'');
  }

  function modeFor(ep){
    if(['global','direct','custom'].includes(ep?.proxyMode))return ep.proxyMode;
    if(cleanProxy(ep?.proxy))return 'custom';
    return cleanProxy(readGlobal().url)?'global':'direct';
  }

  function proxyFor(mode,customProxy,customKey){
    if(mode==='direct')return null;
    if(mode==='custom'){
      const proxy=cleanProxy(customProxy),proxyKey=String(customKey||'').trim();
      return proxy?{proxy,proxyKey}:null;
    }
    const global=readGlobal(),proxy=cleanProxy(global.url),proxyKey=String(global.key||'').trim();
    return proxy?{proxy,proxyKey}:null;
  }

  function draftConfig(url){
    const form=document.querySelector('#endpointForm');
    if(!form||form.hidden)return null;
    const base=cleanBase(document.querySelector('#endpointBase')?.value);
    if(!base||!(url===base||url.startsWith(base+'/')))return null;
    const mode=document.querySelector('#endpointProxyMode')?.value||'direct';
    const picked=proxyFor(mode,document.querySelector('#endpointProxy')?.value,document.querySelector('#endpointProxyKey')?.value);
    return picked?{base,...picked}:null;
  }

  function activeConfig(url){
    const list=Array.isArray(endpoints)?endpoints:[];
    const ep=list.find(x=>x.active)||list[0];
    if(!ep)return null;
    const base=cleanBase(ep.base);
    if(!base||!(url===base||url.startsWith(base+'/')))return null;
    const picked=proxyFor(modeFor(ep),ep.proxy,ep.proxyKey);
    return picked?{base,...picked}:null;
  }

  function installProxyFetch(){
    if(installed)return;
    installed=true;
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
  }

  function maybeInstall(){
    const global=readGlobal();
    const list=Array.isArray(endpoints)?endpoints:[];
    if(cleanProxy(global.url)||list.some(x=>cleanProxy(x?.proxy)))installProxyFetch();
  }

  function syncCustomVisibility(){
    const mode=document.querySelector('#endpointProxyMode')?.value;
    const proxy=document.querySelector('#endpointProxy'),key=document.querySelector('#endpointProxyKey');
    const custom=mode==='custom';
    if(proxy)proxy.hidden=!custom;
    if(key)key.hidden=!custom;
  }

  function injectGlobalCard(){
    const list=document.querySelector('#endpointList');
    if(!list||document.querySelector('#xyGlobalProxyCard'))return;
    const global=readGlobal();
    const card=document.createElement('div');
    card.id='xyGlobalProxyCard';card.className='endpoint-card active';
    card.innerHTML='<strong>全局代理</strong><small>一个 Cloudflare Worker 给所有 API 共用；单个接口仍可改成直连。</small><div class="endpoint-form" style="margin-top:10px"><input id="globalProxyUrl" placeholder="Worker 地址，例如 https://aevren-xy-api.xxx.workers.dev"><input id="globalProxyKey" type="password" placeholder="代理密钥 PROXY_KEY"><button type="button" class="panel-action" id="saveGlobalProxy">保存全局代理</button></div>';
    list.insertAdjacentElement('beforebegin',card);
    card.querySelector('#globalProxyUrl').value=global.url||'';
    card.querySelector('#globalProxyKey').value=global.key||'';
    card.querySelector('#saveGlobalProxy').addEventListener('click',()=>{
      const url=cleanProxy(card.querySelector('#globalProxyUrl').value),key=String(card.querySelector('#globalProxyKey').value||'').trim();
      writeGlobal({url,key});
      if(url)installProxyFetch();
      const btn=card.querySelector('#saveGlobalProxy'),old=btn.textContent;btn.textContent=url?'已保存':'已清除';setTimeout(()=>btn.textContent=old,1200);
    });
  }

  function injectFields(){
    const form=document.querySelector('#endpointForm');
    const base=document.querySelector('#endpointBase');
    if(!form||!base)return;
    let mode=document.querySelector('#endpointProxyMode');
    if(!mode){
      mode=document.createElement('select');
      mode.id='endpointProxyMode';
      mode.innerHTML='<option value="global">使用全局代理</option><option value="direct">直接连接</option><option value="custom">自定义代理</option>';
      base.insertAdjacentElement('afterend',mode);
      mode.addEventListener('change',()=>{syncCustomVisibility();if(mode.value!=='direct')installProxyFetch()});
    }
    let proxy=document.querySelector('#endpointProxy');
    if(!proxy){
      proxy=document.createElement('input');proxy.id='endpointProxy';proxy.placeholder='自定义代理地址';
      mode.insertAdjacentElement('afterend',proxy);
      proxy.addEventListener('input',()=>{if(cleanProxy(proxy.value))installProxyFetch()});
    }
    let key=document.querySelector('#endpointProxyKey');
    if(!key){
      key=document.createElement('input');key.id='endpointProxyKey';key.type='password';key.placeholder='自定义代理密钥';
      proxy.insertAdjacentElement('afterend',key);
    }
    syncCustomVisibility();
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){
    const result=previousOpenPanel(type);
    if(type==='settings')requestAnimationFrame(()=>{injectGlobalCard();injectFields()});
    return result;
  };

  let pendingSave=null;
  document.addEventListener('click',e=>{
    if(e.target.id==='addEndpoint')requestAnimationFrame(()=>{
      injectFields();
      const mode=document.querySelector('#endpointProxyMode'),p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
      if(mode)mode.value=cleanProxy(readGlobal().url)?'global':'direct';
      if(p)p.value='';if(k)k.value='';syncCustomVisibility();
    });
    if(e.target.classList?.contains('edit-endpoint')){
      const i=Number(e.target.dataset.i),ep=endpoints?.[i];
      requestAnimationFrame(()=>{
        injectFields();
        const mode=document.querySelector('#endpointProxyMode'),p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
        if(mode)mode.value=modeFor(ep);if(p)p.value=ep?.proxy||'';if(k)k.value=ep?.proxyKey||'';
        syncCustomVisibility();
        if(mode?.value!=='direct')installProxyFetch();
      });
    }
  });

  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const form=document.querySelector('#endpointForm');
    pendingSave={
      edit:form?.dataset.edit??'',
      proxyMode:document.querySelector('#endpointProxyMode')?.value||'direct',
      proxy:cleanProxy(document.querySelector('#endpointProxy')?.value),
      proxyKey:String(document.querySelector('#endpointProxyKey')?.value||'').trim()
    };
    if(pendingSave.proxyMode!=='direct')installProxyFetch();
    setTimeout(()=>{
      if(!pendingSave)return;
      const {edit,proxyMode,proxy,proxyKey}=pendingSave;pendingSave=null;
      const index=edit!==''?Number(edit):endpoints.length-1;
      const ep=endpoints[index];if(!ep)return;
      ep.proxyMode=proxyMode;ep.proxy=proxy;ep.proxyKey=proxyKey;
      try{save()}catch{}
    },0);
  },true);

  requestAnimationFrame(()=>{injectGlobalCard();injectFields()});
  maybeInstall();
})();
