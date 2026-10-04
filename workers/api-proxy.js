const corsHeaders=(origin,env)=>{
  const allowed=String(env.ALLOWED_ORIGIN||'*').trim()||'*';
  const value=allowed==='*'?'*':(origin===allowed?allowed:'');
  return {
    'Access-Control-Allow-Origin':value||allowed,
    'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Authorization, Accept, X-Aevren-Proxy-Key',
    'Access-Control-Expose-Headers':'Content-Type, Content-Length',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  };
};

const json=(data,status,headers)=>new Response(JSON.stringify(data),{
  status,
  headers:{'Content-Type':'application/json; charset=utf-8',...headers}
});

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const cors=corsHeaders(origin,env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});

    if(env.ALLOWED_ORIGIN&&env.ALLOWED_ORIGIN!=='*'&&origin&&origin!==env.ALLOWED_ORIGIN){
      return json({error:'origin_not_allowed'},403,cors);
    }
    if(env.PROXY_KEY&&request.headers.get('X-Aevren-Proxy-Key')!==env.PROXY_KEY){
      return json({error:'invalid_proxy_key'},401,cors);
    }

    const incoming=new URL(request.url);
    const targetRaw=incoming.searchParams.get('target');
    if(!targetRaw)return json({error:'missing_target'},400,cors);

    let target;
    try{target=new URL(targetRaw)}catch{return json({error:'invalid_target'},400,cors)}
    if(!['https:','http:'].includes(target.protocol))return json({error:'invalid_protocol'},400,cors);

    const allowedHosts=String(env.ALLOWED_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!allowedHosts.length&&!env.PROXY_KEY){
      return json({error:'proxy_not_configured',message:'Set ALLOWED_HOSTS or PROXY_KEY in Worker variables.'},500,cors);
    }
    if(allowedHosts.length&&!allowedHosts.includes(target.hostname)){
      return json({error:'host_not_allowed',host:target.hostname},403,cors);
    }

    const headers=new Headers(request.headers);
    for(const name of [...headers.keys()]){
      const lower=name.toLowerCase();
      if(lower==='host'||lower==='origin'||lower==='referer'||lower==='x-aevren-proxy-key'||lower.startsWith('cf-')||lower.startsWith('sec-')||lower.startsWith('x-forwarded-'))headers.delete(name);
    }

    const init={method:request.method,headers,redirect:'follow'};
    if(request.method!=='GET'&&request.method!=='HEAD')init.body=request.body;

    try{
      const upstream=await fetch(target.toString(),init);
      const outHeaders=new Headers(upstream.headers);
      Object.entries(cors).forEach(([k,v])=>outHeaders.set(k,v));
      return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders});
    }catch(err){
      return json({error:'upstream_fetch_failed',message:String(err?.message||err)},502,cors);
    }
  }
};
