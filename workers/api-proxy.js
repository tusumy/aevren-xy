const corsHeaders=(request,env)=>{
  const origin=request.headers.get('Origin')||'';
  const allowed=String(env.ALLOWED_ORIGIN||'*').trim()||'*';
  const value=allowed==='*'?'*':(origin===allowed?allowed:'');
  const requested=request.headers.get('Access-Control-Request-Headers')||'';
  const fallback=[
    'Content-Type','Authorization','Accept','X-Aevren-Proxy-Key',
    'X-Api-Key','Anthropic-Version','Anthropic-Beta','X-Goog-Api-Key',
    'Mcp-Session-Id','Mcp-Protocol-Version','Last-Event-Id'
  ].join(', ');
  return {
    'Access-Control-Allow-Origin':value||allowed,
    'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':requested||fallback,
    'Access-Control-Expose-Headers':'Content-Type, Content-Length, MCP-Session-Id, X-Aevren-Proxy, X-Aevren-Upstream-Retry',
    'Access-Control-Max-Age':'86400',
    'X-Aevren-Proxy':'1',
    'Vary':'Origin, Access-Control-Request-Headers'
  };
};

const json=(data,status,headers)=>new Response(JSON.stringify(data),{
  status,
  headers:{'Content-Type':'application/json; charset=utf-8',...headers}
});

const stripBrowserOnlyHeaders=headers=>{
  for(const name of [...headers.keys()]){
    const lower=name.toLowerCase();
    if(
      lower==='host'||lower==='origin'||lower==='referer'||lower==='content-length'||
      lower==='x-aevren-proxy-key'||lower==='cookie'||lower==='accept-language'||
      lower.startsWith('cf-')||lower.startsWith('sec-')||lower.startsWith('x-forwarded-')
    ) headers.delete(name);
  }
  return headers;
};

const apkLikeHeaders=source=>{
  const out=new Headers();
  const keep=[
    'content-type','authorization','accept','x-api-key','anthropic-version',
    'anthropic-beta','x-goog-api-key','mcp-session-id','mcp-protocol-version','last-event-id'
  ];
  for(const name of keep){
    const value=source.get(name);
    if(value)out.set(name,value);
  }
  if(!out.has('accept'))out.set('accept','application/json');
  out.set('user-agent','AevrenXY/0.1 Android');
  return out;
};

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const cors=corsHeaders(request,env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});

    if(env.ALLOWED_ORIGIN&&env.ALLOWED_ORIGIN!=='*'&&origin&&origin!==env.ALLOWED_ORIGIN){
      return json({error:'origin_not_allowed',origin,allowed:env.ALLOWED_ORIGIN},403,cors);
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
    if(!env.PROXY_KEY&&allowedHosts.length&&!allowedHosts.includes(target.hostname)){
      return json({error:'host_not_allowed',host:target.hostname,allowedHosts},403,cors);
    }

    const headers=stripBrowserOnlyHeaders(new Headers(request.headers));
    const hasBody=request.method!=='GET'&&request.method!=='HEAD';
    const bodyBytes=hasBody?await request.arrayBuffer():null;
    const makeInit=nextHeaders=>({
      method:request.method,
      headers:nextHeaders,
      redirect:'follow',
      ...(hasBody?{body:bodyBytes}:{}),
      cf:{cacheTtl:0,cacheEverything:false}
    });

    try{
      let upstream=await fetch(target.toString(),makeInit(headers));
      let retried=false;

      // Some OpenAI-compatible gateways reject a browser/Worker-flavoured request while
      // accepting the same request from the APK. On an upstream 403, retry once with the
      // small header set and User-Agent used by Aevren XY's native OkHttp bridge.
      if(upstream.status===403){
        const retryHeaders=apkLikeHeaders(headers);
        const retry=await fetch(target.toString(),makeInit(retryHeaders));
        if(retry.status!==403||retry.headers.get('content-type')?.includes('json')){
          upstream=retry;
          retried=true;
        }
      }

      const outHeaders=new Headers(upstream.headers);
      Object.entries(cors).forEach(([k,v])=>outHeaders.set(k,v));
      if(retried)outHeaders.set('X-Aevren-Upstream-Retry','1');
      return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders});
    }catch(err){
      return json({error:'upstream_fetch_failed',message:String(err?.message||err),target:target.hostname},502,cors);
    }
  }
};
