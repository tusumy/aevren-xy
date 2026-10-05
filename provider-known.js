(()=>{
  const ANTHROPIC_HOSTS=new Set(['api.justwoker.icu']);
  const clean=v=>String(v||'').trim().replace(/\/$/,'');

  function knownProtocol(base){
    try{
      const host=new URL(clean(base)).hostname.toLowerCase();
      if(ANTHROPIC_HOSTS.has(host))return 'anthropic';
    }catch{}
    return null;
  }

  function normalizeBase(base){
    return clean(base);
  }

  function normalizeEndpoint(ep){
    if(!ep)return false;
    let changed=false;
    const forced=knownProtocol(ep.base);
    if(forced&&ep.protocol!==forced){ep.protocol=forced;changed=true;}
    const nextBase=normalizeBase(ep.base);
    if(nextBase&&nextBase!==ep.base){ep.base=nextBase;changed=true;}
    return changed;
  }

  function migrateSaved(){
    if(!Array.isArray(endpoints))return;
    let changed=false;
    endpoints.forEach(ep=>{if(normalizeEndpoint(ep))changed=true;});
    if(!changed)return;
    const active=endpoints.find(x=>x.active)||endpoints[0];
    if(active){settings.apiBase=active.base;settings.model=active.model||settings.model;}
    try{save()}catch{}
  }

  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const base=document.querySelector('#endpointBase');
    const select=document.querySelector('#endpointProtocol');
    const forced=knownProtocol(base?.value);
    if(forced&&select)select.value=forced;
    if(base)base.value=normalizeBase(base.value);

    setTimeout(()=>{
      if(!Array.isArray(endpoints))return;
      let changed=false;
      endpoints.forEach(ep=>{if(normalizeEndpoint(ep))changed=true;});
      if(changed){
        const active=endpoints.find(x=>x.active)||endpoints[0];
        if(active){settings.apiBase=active.base;settings.model=active.model||settings.model;}
        try{save()}catch{}
      }
    },1);
  },true);

  migrateSaved();
})();