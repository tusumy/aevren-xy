(()=>{
  const nextFetch=window.fetch.bind(window);
  const clean=v=>String(v||'').trim().replace(/\/$/,'');
  const inputUrl=input=>typeof input==='string'?input:input instanceof URL?input.toString():input instanceof Request?input.url:String(input||'');
  const safeJson=s=>{try{return JSON.parse(s)}catch{return {result:String(s??'')}}};

  function activeAnthropic(url){
    const ep=(Array.isArray(endpoints)?endpoints:[]).find(x=>x.active)||endpoints?.[0];
    if(!ep||ep.protocol!=='anthropic')return null;
    const base=clean(ep.base);
    if(!base)return null;
    if(url===base||url.startsWith(base+'/'))return ep;
    try{
      const a=new URL(url),b=new URL(base);
      return a.origin===b.origin?ep:null;
    }catch{return null}
  }

  function anthropicEndpoint(base){
    const b=clean(base);
    try{
      const u=new URL(b);
      const path=u.pathname.replace(/\/$/,'');
      if(/\/messages$/i.test(path))return b;
      if(/\/v1$/i.test(path))return b+'/messages';
      if(/\/anthropic$/i.test(path))return b+'/v1/messages';
      if(!path)return b+'/v1/messages';
    }catch{}
    return b+'/v1/messages';
  }

  function blocksFromContent(content){
    if(Array.isArray(content)){
      const out=[];
      for(const part of content){
        if(typeof part==='string'&&part.trim())out.push({type:'text',text:part});
        else if(part&&typeof part==='object'){
          if(part.type==='text'&&String(part.text||'').trim()){
            out.push({type:'text',text:String(part.text)});
          }else if(part.type==='image_url'){
            const url=String(part.image_url?.url||part.url||'');
            const match=url.match(/^data:([^;,]+);base64,(.+)$/s);
            if(match){
              out.push({type:'image',source:{type:'base64',media_type:match[1],data:match[2]}});
            }else if(url){
              out.push({type:'text',text:'[图片：'+url+']'});
            }
          }else if(part.type==='image'){
            if(part.source)out.push(part);
            else if(part.data){
              out.push({type:'image',source:{type:'base64',media_type:part.media_type||'image/jpeg',data:part.data}});
            }
          }else if(part.type==='input_audio'){
            out.push({type:'text',text:'[用户发送了一条语音消息；当前 Anthropic 接口不支持直接读取音频]'});
          }
        }
      }
      return out;
    }
    const text=String(content??'').trim();
    return text?[{type:'text',text}]:[];
  }

  function pushTurn(out,role,blocks){
    if(!blocks.length)return;
    const last=out[out.length-1];
    if(last?.role===role)last.content.push(...blocks);
    else out.push({role,content:blocks});
  }

  function strictMessages(messages){
    const out=[];
    for(const m of messages||[]){
      if(!m||m.role==='system')continue;
      if(m.role==='assistant'){
        const blocks=blocksFromContent(m.content);
        for(const tc of m.tool_calls||[]){
          blocks.push({type:'tool_use',id:tc.id||('toolu_'+Date.now()),name:tc.function?.name||'tool',input:safeJson(tc.function?.arguments||'{}')});
        }
        pushTurn(out,'assistant',blocks);
      }else if(m.role==='tool'){
        pushTurn(out,'user',[{type:'tool_result',tool_use_id:m.tool_call_id,content:String(m.content??'[Empty]')||'[Empty]'}]);
      }else{
        const blocks=blocksFromContent(m.content);
        pushTurn(out,'user',blocks.length?blocks:[{type:'text',text:'[Empty]'}]);
      }
    }
    if(!out.length)out.push({role:'user',content:[{type:'text',text:'[Empty]'}]});
    if(out[0].role!=='user')out.unshift({role:'user',content:[{type:'text',text:'[Empty]'}]});

    const merged=[];
    for(const turn of out){
      const last=merged[merged.length-1];
      if(last?.role===turn.role)last.content.push(...turn.content);
      else merged.push({role:turn.role,content:[...turn.content]});
    }
    if(merged[merged.length-1]?.role!=='user')merged.push({role:'user',content:[{type:'text',text:'[Empty]'}]});
    return merged;
  }

  function openAIToolsToAnthropic(tools){
    return (tools||[]).filter(x=>x?.function?.name).map(x=>({
      name:x.function.name,
      description:x.function.description||'',
      input_schema:x.function.parameters||{type:'object',properties:{}}
    }));
  }

  async function parseBody(input,init){
    const raw=init?.body ?? (input instanceof Request?await input.clone().text():'');
    if(!raw)return {};
    return typeof raw==='string'?JSON.parse(raw):JSON.parse(String(raw));
  }

  function jsonResponse(data,status=200,sourceHeaders){
    const h=new Headers(sourceHeaders||undefined);
    h.set('content-type','application/json; charset=utf-8');
    return new Response(JSON.stringify(data),{status,headers:h});
  }

  window.fetch=async function(input,init){
    const url=inputUrl(input);
    const ep=activeAnthropic(url);
    if(!ep||!/\/chat\/completions(?:\?|$)/i.test(url))return nextFetch(input,init);

    let payload;
    try{payload=await parseBody(input,init)}catch{return nextFetch(input,init)}

    const systemText=(payload.messages||[])
      .filter(x=>x?.role==='system')
      .map(x=>Array.isArray(x.content)?x.content.map(p=>p?.text||'').join('\n'):String(x.content||''))
      .filter(Boolean)
      .join('\n\n');

    const body={
      model:payload.model,
      max_tokens:Number(payload.max_tokens||2048),
      messages:strictMessages(payload.messages),
      stream:false
    };
    if(Number.isFinite(Number(payload.temperature)))body.temperature=Number(payload.temperature);
    if(systemText)body.system=[{type:'text',text:systemText}];
    const tools=openAIToolsToAnthropic(payload.tools);
    if(tools.length)body.tools=tools;

    const headers=new Headers({'content-type':'application/json',accept:'application/json','anthropic-version':'2023-06-01'});
    if(ep.key)headers.set('x-api-key',ep.key);

    const target=anthropicEndpoint(ep.base);
    const res=await nextFetch(target,{method:'POST',headers,body:JSON.stringify(body),signal:init?.signal});
    const text=await res.text();
    let data;
    try{data=JSON.parse(text)}catch{return new Response(text,{status:res.status,headers:res.headers})}

    if(!res.ok){
      if(data?.error&&typeof data.error==='object'){
        const roles=body.messages.map(x=>x.role).join('>');
        const msg=String(data.error.message||'');
        if(/alternating user and assistant|error parsing input messages/i.test(msg))data.error.message=msg+' [Aevren roles: '+roles+']';
      }
      return jsonResponse(data,res.status,res.headers);
    }

    const blocks=Array.isArray(data.content)?data.content:[];
    const content=blocks.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n').trim();
    const calls=blocks.filter(x=>x?.type==='tool_use').map((x,i)=>({
      id:x.id||('tool_'+Date.now()+'_'+i),
      type:'function',
      function:{name:x.name||'tool',arguments:JSON.stringify(x.input||{})}
    }));
    const message={role:'assistant',content:content||null};
    if(calls.length)message.tool_calls=calls;
    return jsonResponse({choices:[{message,finish_reason:calls.length?'tool_calls':'stop'}],model:data.model,usage:data.usage},200,res.headers);
  };

  window.AevrenAnthropicStrict={strictMessages,anthropicEndpoint};
})();