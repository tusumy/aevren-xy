(()=>{
  const routedFetch=window.fetch.bind(window);
  const rawFetch=window.__xyBrowserFetch;
  const isNative=()=>Boolean(window.AevrenNative&&typeof window.AevrenNative.request==='function');
  const inputUrl=input=>{
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.toString();
    if(input instanceof Request)return input.url;
    return String(input||'');
  };
  const clean=v=>String(v||'').trim().replace(/\/$/,'');
  const activeEndpoint=()=>{
    const list=Array.isArray(window.endpoints)?window.endpoints:(typeof endpoints!=='undefined'&&Array.isArray(endpoints)?endpoints:[]);
    return list.find(x=>x.active)||list[0]||null;
  };
  const isOpenAiRequest=url=>{
    const ep=activeEndpoint();
    if(!ep)return false;
    const protocol=ep.protocol||'openai';
    if(protocol!=='openai')return false;
    const base=clean(ep.base);
    return Boolean(base&&(url===base||url.startsWith(base+'/')));
  };

  window.fetch=async function(input,init){
    const url=inputUrl(input);
    const first=await routedFetch(input,init);
    if(isNative()||!rawFetch||first.status!==403||!isOpenAiRequest(url))return first;

    // Some third-party OpenAI-compatible services reject Cloudflare Worker egress
    // while allowing a direct browser request. Retry once without the proxy layer.
    try{
      const retryInput=input instanceof Request?input.clone():input;
      const direct=await rawFetch(retryInput,init);
      if(direct.ok||direct.status!==403)return direct;
    }catch{}
    return first;
  };
})();
