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
    else if(attachments.some(a=>a?.kind==='image'&&a.dataUrl))parts.push({type:'text',text:'请查看我发送的图片。'});
    else if(attachments.some(a=>a?.kind==='audio'&&a.transcript))parts.push({type:'text',text:'以下是语音消息转写内容。'});
    for(const a of attachments){
      if(a?.kind==='image'&&a.visionDescription)parts.push({type:'text',text:'[备用视觉对图片的分析，仅作参考] '+String(a.visionDescription)});
      else if(a?.kind==='image'&&a.dataUrl)parts.push({type:'image_url',image_url:{url:String(a.dataUrl)}});
      else if(a?.kind==='audio'&&a.transcript){
        parts.push({type:'text',text:'[语音转写] '+String(a.transcript)});
      }else if(a?.kind==='audio'&&a.dataUrl){
        const match=String(a.dataUrl).match(/^data:audio\/[^;,]+;base64,(.+)$/s);
        const format=String(a.format||'').toLowerCase();
        if(match&&['wav','mp3'].includes(format)){
          parts.push({type:'input_audio',input_audio:{data:match[1],format}});
        }else{
          parts.push({type:'text',text:'[用户发送了语音附件，当前接口未能识别音频内容。请明确告诉用户未能听懂，切勿猜测或冒充听见。]'});
        }
      }else if(a?.kind==='text'&&typeof a.text==='string'){
        parts.push({type:'text',text:'[附件：'+String(a.name||'文本文件')+(a.truncated?'；内容已截断':'')+']\n'+a.text});
      }else if(a?.kind==='audio'){
        parts.push({type:'text',text:'[此前有一段未转写的语音附件，无法仅凭时长得知内容。请勿声称听过内容。]'});
      }else if(a?.name){
        parts.push({type:'text',text:'[附件：'+String(a.name)+'；内容当前不可用]'});
      }
    }
    return parts.length===1&&parts[0].type==='text'?parts[0].text:parts;
  }

  function mergeContent(a,b){
    if(typeof a==='string'&&typeof b==='string')return (a+'\n\n'+b).trim();
    const toParts=v=>Array.isArray(v)?v:(String(v||'').trim()?[{type:'text',text:String(v)}]:[]);
    return [...toParts(a),...toParts(b)];
  }

  function normalizedHistory(items){
    const out=[];
    let started=false;
    for(const item of items||[]){
      const role=item?.role;
      if(role!=='user'&&role!=='assistant')continue;
      const content=role==='user'?attachmentContent(item):String(item?.text??item?.content??'').trim();
      const empty=typeof content==='string'?!content.trim():!Array.isArray(content)||!content.length;
      if(empty)continue;
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

  async function compatSend(options){
    const fromCall=options?.__xyCall===true&&typeof options.text==='string';
    const el=$('#input'),text=fromCall?options.text.trim():el.value.trim();
    const attachments=fromCall?[]:(Array.isArray(window.xyActiveSendAttachments)?window.xyActiveSendAttachments:[]);
    if(!text&&!attachments.length)return;
    if(sending){if(fromCall)throw new Error('上一条消息还在发送');return}
    const ep=endpoints.find(x=>x.active)||endpoints[0];
    if(!fromCall&&attachments.some(a=>a?.kind==="image")&&ep?.vision!==true&&!window.xyVisionFallback?.forSend?.()){
      window.xyAttachments?.restore?.(attachments);
      window.xyAttachments?.toast?.("当前模型不支持看图，请启用视觉或设置备用视觉模型",true);
      return;
    }
    if(fromCall&&(!ep?.base||!ep?.model))throw new Error('请先配置可用的聊天模型接口');
    sending=true;
    $('#sendBtn').disabled=true;
    const c=chat();
    c.messages.push({role:'user',text,attachments});
    if(c.messages.filter(x=>x.role==='user').length===1)c.title=(text||attachments[0]?.name||'新对话').slice(0,22);
    if(!fromCall){el.value='';resize()}
    save();renderChats();renderMessages();showTyping();
    if(!ep?.base||!ep?.model){
      hideTyping();
      c.messages.push({role:'assistant',text:'嗯，我在。你刚才说的已经留在这里了。',localOnly:true});
      save();renderMessages();sending=false;$('#sendBtn').disabled=false;return;
    }

    const headers={'Content-Type':'application/json',Accept:'application/json'};
    if(ep.key)headers.Authorization='Bearer '+ep.key;
    const memoryContext=memories.length?'长期记忆：\n'+memories.map(m=>'- ['+m.tag+'] '+m.text).join('\n'):'';
    const phoneStyle=fromCall?'正在进行语音电话。自然接话、用口语说给对方听；每轮通常一两句，不重复刚听到的话，不写 Markdown、列表或旁白，保留你原有的人设和说话习惯。':'';
    const now=new Date();
    const timeContext="当前设备当地时间："+now.toLocaleString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long",hour:"2-digit",minute:"2-digit",hour12:false})+"；时区："+Intl.DateTimeFormat().resolvedOptions().timeZone+"。这是消息发送时的时间，不要当作每个历史事件的发生时间。";
    const memorySummary=window.xyMemorySummaryFor?.(c.characterId||window.xyCurrentCharacter?.()?.id)||"";
    const heartInstruction=!fromCall?window.xyHeartNotes?.instruction?.()||'':'';
    const system=[ep.system,timeContext,memorySummary?"角色的长期记忆摘要：\n"+memorySummary:"",memoryContext,phoneStyle,heartInstruction].filter(Boolean).join('\n\n');
    // Keep only the requested number of recent chat turns in model context.
    // The 0 setting means unlimited history, not no history. System prompts
    // and explicit character/memory context are independent of this window.
    const limit=window.xyContextWindow?.readLimit?.()??40;
    const historySource=limit===0?c.messages:c.messages.filter(m=>m?.role==="user"||m?.role==="assistant").slice(-limit);
    // Rehydrate only attachments that the model will actually receive.
    await window.xyImagePayload?.hydrate?.(historySource);
    const hasNewImages=attachments.some(a=>a?.kind==="image");
    const useBackup=hasNewImages&&(window.xyNextVisualFallback===true||(ep.vision!==true&&window.xyVisionFallback?.wantsFallback?.()));
    let backupDescription="";
    if(useBackup){
      try{
        backupDescription=await window.xyVisionFallback.describe(attachments);
        save();
      }catch(error){
        hideTyping();
        c.messages.push({role:"assistant",text:"备用视觉分析失败："+String(error?.message||error),localOnly:true});
        save();renderMessages();sending=false;$('#sendBtn').disabled=false;window.xyNextVisualFallback=false;
        return;
      }
    }
    const history=normalizedHistory(historySource);
    // A text-only primary model only receives independently generated image descriptions.
    if(ep.vision!==true||useBackup){
      for(const m of history)if(Array.isArray(m.content)){
        m.content=m.content.map(part=>part?.type==="image_url"?{type:"text",text:"[图像：请参考后续备用视觉分析结果；未分析的旧图不可见]"}:part);
      }
    }
    window.xyNextVisualFallback=false;
    const messages=[...(system?[{role:'system',content:system}]:[]),...history];
    try{await window.xyEnsureMcpTools?.()}catch{}
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
          const heart=window.xyHeartNotes?.parse?.(reply)||{text:String(reply)};
          c.messages.push({role:'assistant',text:heart.text,heartShort:heart.heartShort||'',heartFull:heart.heartFull||''});
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
        const models=(Array.isArray(source)?source:[]).map(x=>typeof x==='string'?x:(x?.id||String(x?.name||'').replace(/^models\//,''))).filter(Boolean).sort();
        if(!models.length){last='没有返回模型';continue}
        if(picker){
          picker.innerHTML='<select class="model-select" id="modelSelect"><option value="">选择模型…</option>'+models.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select>';
          $('#modelSelect').onchange=ev=>{if(ev.target.value)$('#endpointModel').value=ev.target.value};
        }
        if(status)status.textContent='已拉取 '+models.length+' 个模型';
        return;
      }catch(error){last=String(error?.message||error)}
    }
    if(status)status.textContent='拉取失败：'+(last||'未知错误')+'；可继续手填 Model';
  }

  send=compatSend;
  window.send=compatSend;
  const sendBtn=$('#sendBtn');if(sendBtn)sendBtn.onclick=compatSend;
  const input=$('#input');if(input)input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();compatSend()}};

  document.addEventListener('click',e=>{
    if(e.target?.id!=='fetchModels')return;
    e.preventDefault();e.stopImmediatePropagation();
    compatFetchModels(e.target);
  },true);

  window.AevrenApiCompat={completeChatEndpoint,modelCandidates,normalizedHistory,normalizeApiResponse,attachmentContent,send:compatSend};
})();