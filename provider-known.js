(()=>{
  const OPENAI_V1_HOSTS=new Set(['api.justwoker.icu']);
  const clean=v=>String(v||'').trim().replace(/\/$/,'');

  function normalizeBase(base,protocol){
    const raw=clean(base);
    if(!raw||protocol!=='openai')return raw;
    try{
      const u=new URL(raw);
      if(OPENAI_V1_HOSTS.has(u.hostname.toLowerCase())&&(u.pathname===''||u.pathname==='/')){
        u.pathname='/v1';
        return clean(u.toString());
      }
    }catch{}
    return raw;
  }

  function migrateSaved(){
    if(!Array.isArray(endpoints))return;
    let changed=false;
    endpoints.forEach(ep=>{
      const protocol=ep?.protocol||'openai';
      const next=normalizeBase(ep?.base,protocol);
      if(next&&next!==ep.base){ep.base=next;changed=true;}
    });
    if(!changed)return;
    const active=endpoints.find(x=>x.active)||endpoints[0];
    if(active){settings.apiBase=active.base;settings.model=active.model||settings.model;}
    try{save()}catch{}
  }

  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const base=document.querySelector('#endpointBase');
    const protocol=document.querySelector('#endpointProtocol')?.value||'openai';
    if(base)base.value=normalizeBase(base.value,protocol);
  },true);

  migrateSaved();
})();
