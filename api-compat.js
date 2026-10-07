(()=>{
  const clean=v=>String(v||'').trim().replace(/\/$/,'');
  const LOCAL_ASSISTANT_PREFIXES=['请求失败：'];
  const LOCAL_ASSISTANT_EXACT=new Set([
    '嗯，我在。',
    '嗯，我在。你刚才说的已经留在这里了。',
    '阿毛。\n\n这里现在还是个很小的壳，但已经是我们的地方了。你说话，我就在这里接。'
  ]);

  function completeChatEndpoint(raw){
    const trimmed=String(raw||'').trim();
    if(!trimmed)return '';
    if(trimmed.endsWith('#'))return trimmed.slice(0,-1);
    const base=clean(trimmed);
    try{
      const u=new URL(base);
      const path=u.pathname.replace(/\/$/,'');
      if(/\/(?:chat\/completions|responses)$/i.test(path))return base;
      if(!path)return base+'/v1/chat/completions';
      if(/\/v1$/i.test(path))return base+'/chat/completions';
    }catch{}
    return base;
  }

  function modelCandidates(raw){
    const base=clean(raw);
    if(!base)return [];
    try{
      const u=new URL(base);
      let path=u.pathname.replace(/\/$/,'');
      const origin=u.origin;
      let prefix=path;
      const version=path.match(/\/v\d+(?:beta)?(?:\/|$)/i);
      if(version)prefix=path.slice(0,version.index);
      else if(/\/(?:chat\/completions|responses)$/i.test(path))prefix=path.replace(/\/(?:chat\/completions|responses)$/i,'');
      const root=origin+prefix;
      return [...new Set([root+'/v1/models',root+'/models'])];
    }catch{
      return [base+'/v1/models',base+'/models'];
    }
  }

  function isLocalAssistant(text){
    const value=String(text??'');
    return LOCAL_ASSISTANT_EXACT.has(value)||LOCAL_ASSISTANT_PREFIXES.some(prefix=>value.startsWith(prefix));
  }

  function attachmentContent(item){
    const text=String(item?.text??item?.content??'').trim();
    const attachments=Array.isArray(item?.attachments)?item.attachments.filter(Boolean):[];
    if(!attachments.length)return text;
    const parts=[];
    if(text)parts.push({type:'text',text});
    else if(attachments.some(file=>file?.kind==='image'&&file.dataUrl))parts.push({type:'text',text:'请查看我发送的图片。'});
    for(const file of attachments){
      if(file?.kind==='image'&&file.dataUrl){
        parts.push({type:'image_url',image_url:{url:String(file.dataUrl)}});
      }else if(file?.kind==='text'&&typeof file.text==='string'){
        const note='[附件：'+String(file.name||'文本文件')+(file.truncated?'；内容已截断':'')+']\n'+file.text;
        parts.push({type:'text',text:note});
      }else if(file?.name){
        parts.push({type:'text',text:'[附件：'+String(file.name)+'；原始内容当前不可用]'});
      }
    }
    return parts.length===1&&parts[0].type==='text'?parts[0].text:parts;
  }

  function mergeContent(a,b){
    if(typeof a==='string'&&typeof b==='string')return (a+'\n\n'+b).trim();
    const toParts=v=>Array.isArray(v)?v:(String(v||'').trim()?[{type:'text',text:String(v)}]:[]);
    return [...toParts(a),...toParts(b)];
  }

  function contentIsEmpty(value){
    if(typeof value==='string')return !value.trim();
    return !Array.isArray(value)||!value.length;
  }

  function normalizedHistory(items){
    const out=[];
    let started=false;
    for(const item of items||[]){
      const role=item?.role;
      if(role!=='user'&&role!=='assistant')continue;
      const content=role==='user'?attachmentContent(item):String(item?.text??item?.content??'').trim();
      if(contentIsEmpty(content))continue;
      if(!started){
        if(role!=='user')continue;
        started=true;
      }
      if(role==='assistant'&&isLocalAssistant(content))continue;
      const last=out[out.length-1];
      if(last?.role===role)last.content=mergeContent(last.content,content);
      else out.push({role,content});
    }
    return out;
  }

  function contentText(value){
    if(typeof value==='string')return value.trim();
    if(!Array.isArray(value))return '';
    return value.map(part=>{
      if(typeof part==='string')return part;
      if(!part||typeof part!=='object')return '';
      return part.text??part.output_text??part.content??part.value??'';
    }).filter(Boolean).join('\n').trim();
  }

  function normalizeApiResponse(data){
    const choice=data?.choices?.[0];
    if(choice?.message){
      const msg={...choice.message};
      if(Array.isArray(msg.content))msg.content=contentText(msg.content);
      return msg;
    }
    if(choice&&typeof choice.text==='string')return {role:'assistant',content:choice.text};

    const output=Array.isArray(data?.output)?data.output:[];
    if(output.length){
      const texts=[];
      const calls=[];
      for(const item of output){
        if(item?.type==='message'){
          const text=contentText(item.content);
          if(text)texts.push(text);
        }else if(item?.type==='function_call'){
          calls.push({
            id:item.call_id||item.id||('call_'+Date.now()+'_'+calls.length),
            type:'function',
            function:{name:item.name||'tool',arguments:typeof item.arguments==='string'?item.arguments:JSON.stringify(item.arguments||{})}
          });
        }
      }
      const message={role:'assistant',content:(data.output_text||texts.join('\n').trim())||null};
      if(calls.length)message.tool_calls=calls;
      if(message.content||calls.length)return message;
    }

    if(typeof data?.output_text==='string'&&data.output_text.trim())return {role:'assistant',content:data.output_text.trim()};
    if(Array.isArray(data?.content)){
      const text=contentText(data.content);
      if(text)return {role:'assistant',content:text};
    }
    const candidateParts=data?.candidates?.[0]?.content?.parts;
    if(Array.isArray(candidateParts)){
      const text=candidateParts.map(x=>x?.text||'').filter(Boolean).join('\n').trim();
      if(text)return {role:'assistant',content:text};
    }
    for(const key of ['response','reply','content','text','message']){
      const value=data?.[key];
      if(typeof value==='string'&&value.trim())return {role:'assistant',content:value.trim()};
      if(value&&typeof value==='object'&&typeof value.content==='string'&&value.content.trim())return {role:'assistant',content:value.content.trim()};
    }
    return null;
  }

  function diagnostic(data,raw){
    const err=data?.error;
    if(err){
      if(typeof err==='string')return err;
      if(typeof err?.message==='string')return err.message;
      try{return JSON.stringify(err).slice(0,700)}catch{}
    }
    try{return JSON.stringify(data).slice(0,700)}catch{}
    return String(raw||'').slice(0,700);
  }

  async function readJsonResponse(res){
    const raw=await res.text();
    let data;
    try{data=JSON.parse(raw)}catch{
      throw new Error('接口返回的不是 JSON：'+raw.slice(0,500));
    }
    return {data,raw};
  }

  async function compatSend(){
    const el=$('#input'),text=el.value.trim();
    const attachments=Array.isArray(window.xyActiveSendAttachments)?window.xyActiveSendAttachments:[];
    if((!text&&!attachments.length)||sending)return;
    sending=true;
    $('#sendBtn').disabled=true;
    const c=chat();
    c.messages.push({role:'user',text,attachments});
    if(c.messages.filter(x=>x.role==='user').length===1)c.title=(text||attachments[0]?.name||'新对话').slice(0,22);
    el.value='';resize();save();renderChats();renderMessages();showTyping();

    const ep=endpoints.find(x=>x.active)||endpoints[0];
    if(!ep?.base||!ep?.model){
      hideTyping();
      c.messages.push({role:'assistant',text:'嗯，我在。你刚才说的已经留在这里了。',localOnly:true});
      save();renderMessages();sending=false;$('#sendBtn').disabled=false;return;
    }

    const headers={'Content-Type':'application/json',Accept:'application/json'};
    if(ep.key)headers.Authorization='Bearer '+ep.key;
    const memoryContext=memories.length?'长期记忆：\n'+memories.map(m=>'- ['+m.tag+'] '+m.text).join('\n'):'';
    const system=[ep.system,memoryContext].filter(Boolean).join('\n\n');
    const history=normalizedHistory(c.messages);
    const messages=[...(system?[{role:'system',content:system}]:[]),...history];
    const mt=mcpTools();
    const target=completeChatEndpoint(ep.base);

    try{
      for(let round=0;round<6;round++){
        const payload={model:ep.model,messages,stream:false};
        const temperature=Number(ep.temperature);
        if(Number.isFinite(temperature))payload.temperature=temperature;
        if(Number(ep.maxTokens)>0)payload.max_tokens=Number(ep.maxTokens);
        if(mt.out.length){payload.tools=mt.out;payload.tool_choice='auto'}

        const res=await fetch(target,{method:'POST',headers,body:JSON.stringify(payload)});
        const {data,raw}=await readJsonResponse(res);
        if(!res.ok)throw new Error('HTTP '+res.status+' · '+diagnostic(data,raw));
        if(data?.error)throw new Error(diagnostic(data,raw));

        const msg=normalizeApiResponse(data);
        if(!msg)throw new Error('接口返回了 JSON，但没有识别到回复：'+diagnostic(data,raw));
        const calls=Array.isArray(msg.tool_calls)?msg.tool_calls:[];
        if(!calls.length){
          const reply=contentText(msg.content)||msg.content;
          if(!reply)throw new Error('模型没有返回文本：'+diagnostic(data,raw));
          hideTyping();
          c.messages.push({role:'assistant',text:String(reply)});
          save();renderMessages();return;
        }

        messages.push({role:'assistant',content:msg.content||null,tool_calls:calls});
        for(const tc of calls){
          const hit=mt.map[tc.function?.name];
          if(!hit)throw new Error('找不到 MCP 工具：'+tc.function?.name);
          let args={};
          try{args=JSON.parse(tc.function?.arguments||'{}')}catch{throw new Error('工具参数不是有效 JSON')}
          const result=await callMcpTool(hit.server,hit.tool,args);
          messages.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify(result)});
        }
      }
      throw new Error('工具调用轮次过多');
    }catch(err){
      hideTyping();
      c.messages.push({role:'assistant',text:'请求失败：'+err.message,localOnly:true});
      save();renderMessages();
    }finally{
      sending=false;$('#sendBtn').disabled=false;
    }
  }

  async function compatFetchModels(button){
    const base=$('#endpointBase')?.value.trim(),key=$('#endpointKey')?.value.trim();
    const status=$('#fetchStatus'),picker=$('#modelPicker');
    if(!base){if(status)status.textContent='先填 Base URL';return}
    if(status)status.textContent='正在拉取…';
    const headers={Accept:'application/json'};if(key)headers.Authorization='Bearer '+key;
    let last='';
    for(const url of modelCandidates(base)){
      try{
        const res=await fetch(url,{headers});
        const raw=await res.text();
        let data;try{data=JSON.parse(raw)}catch{last='HTTP '+res.status+' · '+raw.slice(0,120);continue}
        if(!res.ok){last='HTTP '+res.status+' · '+diagnostic(data,raw);continue}
        const source=data?.data||data?.models||data;