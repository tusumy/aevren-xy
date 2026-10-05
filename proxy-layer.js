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
    const hasGlobal=Boolean(cleanProxy(readGlobal().url));
    if(ep?.proxyMode==='custom')return 'custom';
    if(ep?.proxyMode==='direct'&&ep?.proxyModeExplicit)return 'direct';
    if(ep?.proxyMode==='global')return hasGlobal?'global':'direct';
    if(cleanProxy(ep?.proxy))return 'custom';
    return hasGlobal?'global':'direct';
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

  function buildProxyUrl(proxy,target){
    return proxy+(proxy.includes('?')?'&':'?')+'target='+encodeURIComponent(target);
  }

  function installProxyFetch(){
    if(installed)return;
    installed=true;
    window.fetch=async function(input,init){
      const url=inputUrl(input);
      const cfg=draftConfig(url)||activeConfig(url);
      if(!cfg)return nativeFetch(input,init);

      const proxied=buildProxyUrl(cfg.proxy,url);
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

  function syncCustomVisibility(){
    const mode=document.querySelector('#endpointProxyMode')?.value;
    const proxy=document.querySelector('#endpointProxy'),key=document.querySelector('#endpointProxyKey');
    const custom=mode==='custom';
    if(proxy)proxy.hidden=!custom;
    if(key)key.hidden=!custom;
  }

  async function testGlobalProxy(card){
    const proxy=cleanProxy(card.querySelector('#globalProxyUrl')?.value);
    const proxyKey=String(card.querySelector('#globalProxyKey')?.value||'').trim();
    const status=card.querySelector('#globalProxyStatus');
    if(!proxy){if(status)status.textContent='先填 Worker 地址';return}
    if(status)status.textContent='正在测试 Worker…';
    const headers=new Headers({Accept:'text/html'});
    if(proxyKey)headers.set('X-Aevren-Proxy-Key',proxyKey);
    try{
      const res=await nativeFetch(buildProxyUrl(proxy,'https://example.com/'),{method:'GET',headers});
      const text=await res.text().catch(()=>"");
      if(res.ok){
        const mark=res.headers.get('x-aevren-proxy')==='1'?' · Worker 已确认':'';
        if(status)status.textContent='代理链正常 · HTTP '+res.status+mark;
      }else{
        let detail=text.trim();
        try{const j=JSON.parse(detail);detail=j.error+(j.host?' · '+j.host:'')+(j.message?' · '+j.message:'')}catch{}
        if(status)status.textContent='代理返回 HTTP '+res.status+(detail?' · '+detail.slice(0,120):'');
      }
    }catch(error){
      if(status)status.textContent='代理请求失败 · '+String(error?.message||error);
    }
  }

  function injectGlobalCard(){
    const list=document.querySelector('#endpointList');
    if(!list||document.querySelector('#xyGlobalProxyCard'))return;
    const global=readGlobal();
    const card=document.createElement('div');
    card.id='xyGlobalProxyCard';card.className='endpoint-card active';
    card.innerHTML='<strong>全局代理</strong><small>网页端统一走一个 Cloudflare Worker；APK 原生网络不需要它。</small><div class="endpoint-form" style="margin-top:10px"><input id="globalProxyUrl" placeholder="Worker 地址，例如 https://aevren-xy-api.xxx.workers.dev"><input id="globalProxyKey" type="password" placeholder="代理密钥 PROXY_KEY"><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px"><button type="button" class="panel-action" id="saveGlobalProxy">保存</button><button type="button" class="panel-action" id="testGlobalProxy">测试代理</button></div><div class="fetch-status" id="globalProxyStatus"></div></div>';
    list.insertAdjacentElement('beforebegin',card);
    card.querySelector('#globalProxyUrl').value=global.url||'';
    card.querySelector('#globalProxyKey').value=global.key||'';
    card.querySelector('#saveGlobalProxy').addEventListener('click',()=>{
      const url=cleanProxy(card.querySelector('#globalProxyUrl').value),key=String(card.querySelector('#globalProxyKey').value||'').trim();
      writeGlobal({url,key});
      const btn=card.querySelector('#saveGlobalProxy'),old=btn.textContent;btn.textContent=url?'已保存':'已清除';setTimeout(()=>btn.textContent=old,1200);
      const status=card.querySelector('#globalProxyStatus');if(status)status.textContent=url?'已保存；现有旧接口会默认跟随全局代理':'全局代理已清除';
    });
    card.querySelector('#testGlobalProxy').addEventListener('click',()=>testGlobalProxy(card));
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
      mode.addEventListener('change',()=>{form.dataset.proxyModeExplicit='1';syncCustomVisibility()});
    }
    let proxy=document.querySelector('#endpointProxy');
    if(!proxy){
      proxy=document.createElement('input');proxy.id='endpointProxy';proxy.placeholder='自定义代理地址';
      mode.insertAdjacentElement('afterend',proxy);
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
      const form=document.querySelector('#endpointForm'),mode=document.querySelector('#endpointProxyMode'),p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
      if(form)form.dataset.proxyModeExplicit='';
      if(mode)mode.value=cleanProxy(readGlobal().url)?'global':'direct';
      if(p)p.value='';if(k)k.value='';syncCustomVisibility();
    });
    if(e.target.classList?.contains('edit-endpoint')){
      const i=Number(e.target.dataset.i),ep=endpoints?.[i];
      requestAnimationFrame(()=>{
        injectFields();
        const form=document.querySelector('#endpointForm'),mode=document.querySelector('#endpointProxyMode'),p=document.querySelector('#endpointProxy'),k=document.querySelector('#endpointProxyKey');
        if(form)form.dataset.proxyModeExplicit=ep?.proxyModeExplicit?'1':'';
        if(mode)mode.value=modeFor(ep);if(p)p.value=ep?.proxy||'';if(k)k.value=ep?.proxyKey||'';
        syncCustomVisibility();
      });
    }
  });

  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const form=document.querySelector('#endpointForm');
    pendingSave={
      edit:form?.dataset.edit??'',
      proxyMode:document.querySelector('#endpointProxyMode')?.value||'direct',
      proxyModeExplicit:form?.dataset.proxyModeExplicit==='1',
      proxy:cleanProxy(document.querySelector('#endpointProxy')?.value),
      proxyKey:String(document.querySelector('#endpointProxyKey')?.value||'').trim()
    };
    setTimeout(()=>{
      if(!pendingSave)return;
      const {edit,proxyMode,proxyModeExplicit,proxy,proxyKey}=pendingSave;pendingSave=null;
      const index=edit!==''?Number(edit):endpoints.length-1;
      const ep=endpoints[index];if(!ep)return;
      ep.proxyMode=proxyMode;ep.proxyModeExplicit=proxyModeExplicit;ep.proxy=proxy;ep.proxyKey=proxyKey;
      try{save()}catch{}
    },0);
  },true);

  // Always install the proxy layer before provider-core loads. It stays dormant
  // when no proxy applies, but this preserves the provider -> proxy -> network order
  // even when a global proxy is configured later from the UI.
  installProxyFetch();
  requestAnimationFrame(()=>{injectGlobalCard();injectFields()});
})();
