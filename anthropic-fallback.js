(()=>{
  const nextFetch=window.fetch.bind(window);
  const clean=v=>String(v||'').trim().replace(/\/$/,'');

  const inputUrl=input=>{
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.toString();
    if(input instanceof Request)return input.url;
    return String(input||'');
  };

  function activeAnthropic(url){
    const ep=(Array.isArray(endpoints)?endpoints:[]).find(x=>x.active)||endpoints?.[0];
    if(!ep||ep.protocol!=='anthropic')return null;
    const base=clean(ep.base);
    if(!base||!(url===base||url.startsWith(base+'/')))return null;
    try{
      const host=new URL(base).hostname.toLowerCase();
      if(host==='api.anthropic.com'||host.endsWith('.anthropic.com'))return null;
    }catch{}
    return ep;
  }

  async function errorText(response){
    try{return await response.clone().text()}catch{return ''}
  }

  function shouldFallback(status,text){
    if(status!==400)return false;
    return /bad_response_status_code|alternating\s+user\s+and\s+assistant|error\s+parsing\s+input\s+messages|messages\s+must\s+have\s+alternating/i.test(String(text||''));
  }

  window.fetch=async function(input,init){
    const url=inputUrl(input);
    const ep=activeAnthropic(url);
    const first=await nextFetch(input,init);
    if(!ep||first.ok)return first;

    const detail=await errorText(first);
    if(!shouldFallback(first.status,detail))return first;

    const previous=ep.protocol;
    ep.protocol='openai';
    try{
      const retried=await nextFetch(input,init);
      if(retried.ok)return retried;
      return retried;
    }finally{
      ep.protocol=previous;
    }
  };
})();
