(()=>{
  const OPENAI_V1_HOSTS=new Set(['api.justwoker.icu']);
  const clean=v=>String(v||'').trim().replace(/\/$/,'');

  function knownProtocol(base){
    try{
      const host=new URL(clean(base)).hostname.toLowerCase();
      if(OPENAI_V1_HOSTS.has(host))return 'openai';
    }catch{}
    return null;
  }

  function normalizeBase(base,protocol){
    const raw=clean(base);
    if(!raw)return raw;
    try{
      const u=new URL(raw);
      if(protocol==='openai'&&OPENAI_V1_HOSTS.has(u.hostname.toLowerCase())&&(u.pathname===''||u.pathname==='/')){
        u.pathname='/v1';
        return clean(u.toString());
      }
    }catch{}
    return raw;
  }

  function normalizeEndpoint(ep){
    if(!ep)return false;
    let changed=false;
    const forced=knownProtocol(ep.base);
    const protocol=forced||ep.protocol||'openai';
    const nextBase=normalizeBase(ep.base,protocol);
    if(ep.protocol!==protocol){ep.protocol=protocol;changed=true;}
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
    if(base)base.value=normalizeBase(base.value,forced||select?.value||'openai');

    // provider-core also persists protocol after the base form saves.
    // Run one tick later so known-host corrections win over a stale saved protocol.
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