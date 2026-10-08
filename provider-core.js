(()=>{
  const nextFetch=window.fetch.bind(window);
  const PROVIDERS={
    openai:{label:'OpenAI 通用',base:'https://api.openai.com/v1'},
    anthropic:{label:'Anthropic 通用',base:'https://api.anthropic.com/v1'},
    gemini:{label:'Gemini 通用',base:'https://generativelanguage.googleapis.com/v1beta'}
  };
  const clean=v=>String(v||'').trim().replace(/\/$/,'');
  const protocolOf=ep=>PROVIDERS[ep?.protocol]?ep.protocol:'openai';

  const inputUrl=input=>{
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.toString();
    if(input instanceof Request)return input.url;
    return String(input||'');
  };
  const mergedHeaders=(input,init)=>{
    const h=new Headers(input instanceof Request?input.headers:undefined);
    if(init?.headers)new Headers(init.headers).forEach((v,k)=>h.set(k,v));
    return h;
  };
  const bearerKey=h=>String(h.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const jsonResponse=(data,status=200,sourceHeaders)=>{
    const h=new Headers(sourceHeaders||undefined);h.set('content-type','application/json; charset=utf-8');
    return new Response(JSON.stringify(data),{status,headers:h});
  };
  const parseBody=async(input,init)=>{
    const raw=init?.body ?? (input instanceof Request?await input.clone().text():'');
    if(!raw)return {};
    if(typeof raw==='string')return JSON.parse(raw);
    return JSON.parse(String(raw));
  };
  const apiRoot=(base,kind)=>{
    const b=clean(base);
    if(kind==='anthropic')return /\/v1$/i.test(b)?b:b+'/v1';
    if(kind==='gemini')return /\/v1(?:beta)?$/i.test(b)?b:b+'/v1beta';
    return b;
  };

  function formConfig(url){
    const form=document.querySelector('#endpointForm');
    if(!form||form.hidden)return null;
    const base=clean(document.querySelector('#endpointBase')?.value);
    const protocol=document.querySelector('#endpointProtocol')?.value||'openai';
    if(base&&(url===base||url.startsWith(base+'/')))return {base,protocol};
    return null;
  }
  function activeConfig(url){
    const ep=(Array.isArray(endpoints)?endpoints:[]).find(x=>x.active)||endpoints?.[0];
    if(!ep)return null;
    const base=clean(ep.base),protocol=protocolOf(ep);
    if(base&&(url===base||url.startsWith(base+'/')))return {base,protocol};
    return null;
  }

  const pushRole=(arr,role,blocks)=>{
    if(!blocks?.length)return;
    const last=arr[arr.length-1];
    if(last?.role===role&&Array.isArray(last.content))last.content.push(...blocks);
    else arr.push({role,content:blocks});
  };
  const safeJson=s=>{try{return JSON.parse(s)}catch{return {result:String(s??'')}}};

  function openAIText(content){
    if(typeof content==="string")return content;
    if(!Array.isArray(content))return String(content??"");
    return content.map(part=>{
      if(typeof part==="string")return part;
      if(part?.type==="text")return String(part.text||"");
      return "";
    }).filter(Boolean).join("\n");
  }

  function anthropicBlocks(content){
    const parts=Array.isArray(content)?content:[content];
    const out=[];
    for(const part of parts){
      if(typeof part==="string"){
        if(part.trim())out.push({type:"text",text:part});
        continue;
      }
      if(!part||typeof part!=="object")continue;
      if(part.type==="text"){
        const text=String(part.text||"");if(text.trim())out.push({type:"text",text});
        continue;
      }
      if(part.type==="image"&&part.source){out.push(part);continue}
      if(part.type==="image_url"){
        const url=String(part.image_url?.url||part.url||"");
        const match=url.match(/^data:([^;,]+);base64,(.+)$/s);
        if(match)out.push({type:"image",source:{type:"base64",media_type:match[1],data:match[2]}});
        else if(url)out.push({type:"text",text:"[图片："+url+"]"});
      }
    }
    return out;
  }

  function toAnthropicMessages(messages){
    const out=[];
    for(const m of messages||[]){
      if(m.role==="system")continue;
      if(m.role==="assistant"){
        const blocks=anthropicBlocks(m.content);
        for(const tc of m.tool_calls||[]){
          blocks.push({type:"tool_use",id:tc.id,name:tc.function?.name||"tool",input:safeJson(tc.function?.arguments||"{}")});
        }
        pushRole(out,"assistant",blocks);
      }else if(m.role==="tool"){
        pushRole(out,"user",[{type:"tool_result",tool_use_id:m.tool_call_id,content:String(m.content??"")}]);
      }else{
        const blocks=anthropicBlocks(m.content);
        pushRole(out,"user",blocks.length?blocks:[{type:"text",text:"[Empty]"}]);
      }
    }
    return out;
  }
  function openAIToolsToAnthropic(tools){
    return (tools||[]).filter(x=>x?.function?.name).map(x=>({name:x.function.name,description:x.function.description||'',input_schema:x.function.parameters||{type:'object',properties:{}}}));
  }

  async function anthropicFetch(input,init,cfg){
    const url=inputUrl(input),headers=mergedHeaders(input,init),key=bearerKey(headers)||headers.get('x-api-key')||'';
    const root=apiRoot(cfg.base,'anthropic');
    if(/\/models(?:\?|$)/.test(url)){
      const h=new Headers({Accept:'application/json','anthropic-version':'2023-06-01'});if(key)h.set('x-api-key',key);
      return nextFetch(root+'/models',{method:'GET',headers:h,signal:init?.signal});
    }
    if(!/\/chat\/completions(?:\?|$)/.test(url))return nextFetch(input,init);
    const payload=await parseBody(input,init);
    const system=(payload.messages||[]).filter(x=>x.role==='system').map(x=>openAIText(x.content)).filter(Boolean).join('\n\n');
    const body={model:payload.model,max_tokens:Number(payload.max_tokens||2048),messages:toAnthropicMessages(payload.messages),temperature:payload.temperature};
    if(system)body.system=system;
    const tools=openAIToolsToAnthropic(payload.tools);if(tools.length)body.tools=tools;
    const h=new Headers({'content-type':'application/json',accept:'application/json','anthropic-version':'2023-06-01'});if(key)h.set('x-api-key',key);
    const res=await nextFetch(root+'/messages',{method:'POST',headers:h,body:JSON.stringify(body),signal:init?.signal});
    const text=await res.text();let data;try{data=JSON.parse(text)}catch{return new Response(text,{status:res.status,headers:res.headers})}
    if(!res.ok)return jsonResponse(data,res.status,res.headers);
    const blocks=Array.isArray(data.content)?data.content:[];
    const content=blocks.filter(x=>x.type==='text').map(x=>x.text||'').join('\n').trim();
    const calls=blocks.filter(x=>x.type==='tool_use').map(x=>({id:x.id||('tool_'+Date.now()),type:'function',function:{name:x.name,arguments:JSON.stringify(x.input||{})}}));
    const message={role:'assistant',content:content||null};if(calls.length)message.tool_calls=calls;
    return jsonResponse({choices:[{message,finish_reason:calls.length?'tool_calls':'stop'}],model:data.model,usage:data.usage},200,res.headers);
  }

  function geminiParts(content){
    const parts=Array.isArray(content)?content:[content];
    const out=[];
    for(const part of parts){
      if(typeof part==="string"){
        if(part.trim())out.push({text:part});
        continue;
      }
      if(!part||typeof part!=="object")continue;
      if(part.type==="text"){
        const text=String(part.text||"");if(text.trim())out.push({text});
        continue;
      }
      if(part.type==="image_url"){
        const url=String(part.image_url?.url||part.url||"");
        const match=url.match(/^data:([^;,]+);base64,(.+)$/s);
        if(match)out.push({inlineData:{mimeType:match[1],data:match[2]}});
        else if(url)out.push({text:"[图片："+url+"]"});
      }else if(part.inlineData||part.inline_data){
        const inline=part.inlineData||part.inline_data;
        out.push({inlineData:{mimeType:inline.mimeType||inline.mime_type||"image/jpeg",data:inline.data||""}});
      }
    }
    return out;
  }

  function toGeminiContents(messages){
    const out=[],callNames=new Map();
    for(const m of messages||[]){
      if(m.role==="system")continue;
      if(m.role==="assistant"){
        const parts=geminiParts(m.content);
        for(const tc of m.tool_calls||[]){
          const name=tc.function?.name||"tool";
          callNames.set(tc.id,name);
          parts.push({functionCall:{name,args:safeJson(tc.function?.arguments||"{}")}});
        }
        if(parts.length)out.push({role:"model",parts});
      }else if(m.role==="tool"){
        const name=callNames.get(m.tool_call_id)||"tool";
        out.push({role:"user",parts:[{functionResponse:{name,response:safeJson(m.content)}}]});
      }else{
        const parts=geminiParts(m.content);
        if(parts.length)out.push({role:"user",parts});
      }
    }
    return out;
  }
  const openAIToolsToGemini=tools=>{
    const decl=(tools||[]).filter(x=>x?.function?.name).map(x=>({name:x.function.name,description:x.function.description||'',parameters:x.function.parameters||{type:'object',properties:{}}}));
    return decl.length?[{functionDeclarations:decl}]:undefined;
  };

  async function geminiFetch(input,init,cfg){
    const url=inputUrl(input),headers=mergedHeaders(input,init),key=bearerKey(headers)||headers.get('x-goog-api-key')||'';
    const root=apiRoot(cfg.base,'gemini');
    const gh=new Headers({accept:'application/json'});if(key)gh.set('x-goog-api-key',key);
    if(/\/models(?:\?|$)/.test(url)){
      const res=await nextFetch(root+'/models',{method:'GET',headers:gh,signal:init?.signal});
      const text=await res.text();let data;try{data=JSON.parse(text)}catch{return new Response(text,{status:res.status,headers:res.headers})}
      if(!res.ok)return jsonResponse(data,res.status,res.headers);
      const models=(data.models||[]).map(x=>({id:String(x.name||'').replace(/^models\//,'')})).filter(x=>x.id);
      return jsonResponse({data:models},200,res.headers);
    }
    if(!/\/chat\/completions(?:\?|$)/.test(url))return nextFetch(input,init);
    const payload=await parseBody(input,init);
    const system=(payload.messages||[]).filter(x=>x.role==='system').map(x=>openAIText(x.content)).filter(Boolean).join('\n\n');
    const body={contents:toGeminiContents(payload.messages),generationConfig:{temperature:payload.temperature,maxOutputTokens:Number(payload.max_tokens||2048)}};
    if(system)body.systemInstruction={parts:[{text:system}]};
    const tools=openAIToolsToGemini(payload.tools);if(tools)body.tools=tools;
    const h=new Headers({'content-type':'application/json',accept:'application/json'});if(key)h.set('x-goog-api-key',key);
    const target=root+'/models/'+encodeURIComponent(payload.model)+':generateContent';
    const res=await nextFetch(target,{method:'POST',headers:h,body:JSON.stringify(body),signal:init?.signal});
    const text=await res.text();let data;try{data=JSON.parse(text)}catch{return new Response(text,{status:res.status,headers:res.headers})}
    if(!res.ok)return jsonResponse(data,res.status,res.headers);
    const parts=data?.candidates?.[0]?.content?.parts||[];
    const content=parts.filter(x=>typeof x.text==='string').map(x=>x.text).join('\n').trim();
    const calls=parts.filter(x=>x.functionCall).map((x,i)=>({id:'gemini_'+Date.now()+'_'+i,type:'function',function:{name:x.functionCall.name,arguments:JSON.stringify(x.functionCall.args||{})}}));
    const message={role:'assistant',content:content||null};if(calls.length)message.tool_calls=calls;
    return jsonResponse({choices:[{message,finish_reason:calls.length?'tool_calls':'stop'}],model:payload.model},200,res.headers);
  }

  window.fetch=async function(input,init){
    const url=inputUrl(input),cfg=formConfig(url)||activeConfig(url);
    if(!cfg||cfg.protocol==='openai')return nextFetch(input,init);
    if(cfg.protocol==='anthropic')return anthropicFetch(input,init,cfg);
    if(cfg.protocol==='gemini')return geminiFetch(input,init,cfg);
    return nextFetch(input,init);
  };

  function decorateCards(){
    document.querySelectorAll('.endpoint-card[data-endpoint]').forEach(card=>{
      if(card.querySelector('.provider-badge'))return;
      const i=Number(card.dataset.endpoint),ep=endpoints?.[i],strong=card.querySelector('strong');if(!ep||!strong)return;
      const badge=document.createElement('span');badge.className='provider-badge';badge.textContent=PROVIDERS[protocolOf(ep)].label;strong.insertAdjacentElement('afterend',badge);
    });
  }
  function injectProtocol(){
    const form=document.querySelector('#endpointForm'),base=document.querySelector('#endpointBase');
    if(!form||!base||document.querySelector('#endpointProtocol'))return;
    const wrap=document.createElement('label');wrap.className='provider-protocol-row';wrap.innerHTML='<span>接口类型</span><select id="endpointProtocol"><option value="openai">OpenAI 通用</option><option value="anthropic">Anthropic 通用</option><option value="gemini">Gemini 通用</option></select><small>不同类型会自动转换请求格式；Base URL 仍可自行修改。</small>';
    base.insertAdjacentElement('beforebegin',wrap);
    const select=wrap.querySelector('select');
    select.addEventListener('change',()=>{
      const next=PROVIDERS[select.value],current=clean(base.value),known=Object.values(PROVIDERS).some(x=>clean(x.base)===current);
      if(!current||known)base.value=next.base;
    });
  }
  const previousOpenPanel=openPanel;
  openPanel=function(type){const r=previousOpenPanel(type);if(type==='settings')requestAnimationFrame(()=>{injectProtocol();decorateCards()});return r};

  let pending=null;
  document.addEventListener('click',e=>{
    if(e.target.id==='addEndpoint')requestAnimationFrame(()=>{injectProtocol();const s=document.querySelector('#endpointProtocol');if(s)s.value='openai'});
    if(e.target.classList?.contains('edit-endpoint')){
      const i=Number(e.target.dataset.i),ep=endpoints?.[i];requestAnimationFrame(()=>{injectProtocol();const s=document.querySelector('#endpointProtocol');if(s)s.value=protocolOf(ep)});
    }
  });
  document.addEventListener('click',e=>{
    if(e.target.id!=='saveEndpoint')return;
    const form=document.querySelector('#endpointForm');
    pending={edit:form?.dataset.edit??'',protocol:document.querySelector('#endpointProtocol')?.value||'openai'};
    setTimeout(()=>{
      if(!pending)return;const p=pending;pending=null;const i=p.edit!==''?Number(p.edit):endpoints.length-1;if(endpoints[i]){endpoints[i].protocol=p.protocol;try{save()}catch{}}
    },0);
  },true);

  endpoints.forEach(ep=>{if(!ep.protocol)ep.protocol='openai'});try{save()}catch{}
  requestAnimationFrame(()=>{injectProtocol();decorateCards()});
})();
