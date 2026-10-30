(()=>{
  const originalSend=window.AevrenApiCompat?.send||send;
  let replyRequestRunning=false;

  const currentCharacterName=()=>{
    try{return window.xyCurrentCharacter?.()?.name||document.querySelector(".presence strong")?.textContent?.trim()||"玄砚"}catch{return "玄砚"}
  };
  const updatePlaceholder=()=>{
    const input=document.querySelector("#input");
    if(input)input.placeholder=`想和${currentCharacterName()}说什么…`;
  };
  const timeText=ts=>{
    if(!ts)return "";
    const d=new Date(ts);
    if(Number.isNaN(d.getTime()))return "";
    return d.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false});
  };
  // Keep short time for call history, but date + time for each chat bubble.
  const messageStamp=ts=>{
    if(!ts)return "";
    const d=new Date(ts);
    if(Number.isNaN(d.getTime()))return "";
    const two=n=>String(n).padStart(2,"0");
    return [two(d.getFullYear()%100),two(d.getMonth()+1),two(d.getDate())].join("-")+" "+two(d.getHours())+":"+two(d.getMinutes());
  };
  const timeTitle=ts=>{
    if(!ts)return "";
    const d=new Date(ts);
    if(Number.isNaN(d.getTime()))return "";
    return d.toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
  };
  function migrateLegacyTimestamps(){
    let changed=false;
    const now=Date.now();
    chats.forEach((c,ci)=>{
      const missing=c.messages.filter(m=>!m.createdAt).length;
      if(!missing)return;
      let n=0;
      const base=now-(missing-1)*1000-ci*100;
      c.messages.forEach(m=>{if(!m.createdAt){m.createdAt=base+n*1000;n++;changed=true}});
    });
    if(changed)save();
  }

  function trimPlainEnding(text){
    let s=String(text??"").trimEnd();
    while(s.endsWith("。")||s.endsWith("."))s=s.slice(0,-1).trimEnd();
    return s;
  }

  function splitReply(text){
    const raw=String(text??"").trim();
    if(!raw)return [""];
    if(raw.includes("```")||/(?:^|\n)[ \t]*<(?:!doctype\s+html\b|html\b|head\b|body\b|div\b|section\b|article\b|style\b|svg\b|table\b|details\b|p\b|span\b|jn_status\b)/i.test(raw))return [raw];
    const parts=raw.split(/\n{2,}|\n+/).map(x=>x.trim()).filter(Boolean);
    return parts.length?parts:[raw];
  }

  function attachmentHtml(items){
    const list=Array.isArray(items)?items.filter(Boolean):[];
    if(!list.length)return "";
    const inner=list.map(a=>{
      if(a.kind==="image"&&(a.previewDataUrl||a.dataUrl))return `<img class="xy-message-image" src="${esc(a.previewDataUrl||a.dataUrl)}" alt="${esc(a.name||"图片")}">`;
      if(a.kind==="audio"){
        const duration=Math.max(1,Math.round(Number(a.duration||1)));
        const playable=Boolean(a.dataUrl||a.localAudioKey||a.voiceUrl);
        const source=a.dataUrl?`data-voice-note-src="${esc(a.dataUrl)}"`:a.localAudioKey?`data-voice-note-key="${esc(a.localAudioKey)}"`:a.voiceUrl?`data-voice-note-src="${esc(a.voiceUrl)}"`:"disabled";
        const transcript=a.transcript?`<span class="xy-voice-transcript">${esc(a.transcript)}</span>`:a.transcriptError?`<span class="xy-voice-transcript" title="${esc(a.transcriptError)}">未转写 · AI暂时无法理解语音</span>`:"";
        const hearing=a.hearingSummary?`<details class="xy-voice-hearing" style="max-width:280px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px"><summary>声音线索</summary>${esc(String(a.hearingSummary).slice(0,1600))}</details>`:"";
        return `<div class="xy-voice-note-wrap"><button type="button" class="xy-message-voice-note" ${source} title="${playable?"播放语音":"旧语音没有保存原始音频"}"><span class="xy-message-voice-icon">▶</span><span class="xy-message-voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>${duration}"</b></button>${transcript}${hearing}</div>`;
      }
      return `<div class="xy-message-file"><span>▤</span><b>${esc(a.name||"附件")}</b></div>`;
    }).join("");
    return `<div class="xy-message-attachments">${inner}</div>`;
  }


  // Keep the original quote text in chat history/model context, but show it as
  // a compact in-bubble reference instead of oversized ordinary bubble text.
  function quotedSourceIndex(quote,who,beforeIndex){
    const messages=chat()?.messages||[];
    const needle=String(quote||"").replace(/…$/,"").replace(/\s+/g," ").trim();
    if(needle.length<3)return -1;
    const expectedRole=who==="你"?"user":"assistant";
    for(let i=Math.min(beforeIndex,messages.length)-1;i>=0;i--){
      const m=messages[i];if(m?.role!==expectedRole)continue;
      const variant=Array.isArray(m.variants)&&m.variants.length?m.variants[Math.min(Math.max(Number(m.activeVariant)||0,0),m.variants.length-1)]?.text:null;
      const source=String(variant??m.text??"").replace(/\s+/g," ").trim();
      if(source.includes(needle))return i;
    }
    return -1;
  }
  function bubbleTextHtml(value,index,role){
    const raw=String(value??"");
    const quote=role==="user"?raw.match(/^引用([^\r\n：「]{1,40})：「([^\r\n]*)」(?:\r?\n|$)/):null;
    const body=quote?raw.slice(quote[0].length):raw;
    const rendered=window.xyChatMarkdown?.render?.(body)??(window.xyStickerShelf?.renderText?.(body)??esc(body));
    if(!quote)return `<span class="bubble-text">${rendered}</span>`;
    const who=quote[1].trim(),excerpt=quote[2];
    const target=quotedSourceIndex(excerpt,who,index);
    const tag=target>=0?"button":"span";
    const attributes=target>=0?` type="button" data-xy-quote-target="${target}" title="跳转到原消息" aria-label="跳转到${esc(who)}的原消息"`:"";
    const preview=`<${tag} class="xy-quoted-preview"${attributes}><span class="xy-quoted-author">↪ 引用 · ${esc(who)}</span><span class="xy-quoted-excerpt">${esc(excerpt)}</span></${tag}>`;
    return `<span class="bubble-text">${preview}${rendered}</span>`;
  }

  function messageHtml(m,index){
    if(m?.kind==="call"){
      const when=timeText(m.createdAt),name=String(m.characterName||"角色");
      const rows=Array.isArray(m.transcript)?m.transcript.slice(0,160):[];
      const content=rows.length?rows.map(item=>`<div class="xy-call-history-turn"><b>${esc(item.role==="user"?"你":name)}</b><span>${esc(String(item.text||""))}</span></div>`).join(""):'<div class="xy-call-history-empty">本次没有识别到对话</div>';
      return `<div class="message xy-call-record"><details class="xy-call-history"><summary><span class="xy-call-history-icon">☎</span><span>与${esc(name)}通话 · ${esc(m.duration||"00:00")}</span><small>${esc(when)}</small></summary><div class="xy-call-history-content">${content}</div></details></div>`;
    }
    const isAssistant=m.role==="assistant";
    const visualText=isAssistant?(window.xyTavernDisplay?.strip?.(m.text,chat()?.characterId)??m.text):m.text;
    const namedText=isAssistant?(window.xyTavernMacros?.replace?.(visualText,currentCharacterName())??visualText):visualText;
    const rawParts=isAssistant?splitReply(namedText):[String(namedText??"")];
    const parts=isAssistant?rawParts.map(trimPlainEnding):rawParts;
    const stamp=messageStamp(m.createdAt),title=timeTitle(m.createdAt),media=attachmentHtml(m.attachments);
    return parts.map((part,i)=>{
      const first=i===0,last=i===parts.length-1;
      // Each paragraph has exactly one position class. Previously the first
      // paragraph was also marked split-mid, which hid its bear/cat decoration.
      const split=parts.length>1?` split-piece ${first?"split-first":last?"split-last":"split-mid"}`:"";
      const ts=last&&stamp?`<span class="message-time" title="${esc(title)}">${esc(stamp)}</span>`:"";
      const attachments=first?media:"";
       const text=part?bubbleTextHtml(part,index,m.role):"";
      return `<div class="message ${m.role}${split}" data-message="${index}" data-part="${i}"><div class="message-stack"><div class="bubble">${attachments}${text}</div>${ts}</div></div>`;
    }).join("");
  }

  function hasUnansweredUser(c=chat()){
    const messages=c?.messages||[];
    let answeredAt=-1;
    for(let i=messages.length-1;i>=0;i--){
      const m=messages[i];
      if(m?.role==="assistant"&&!m.localOnly&&!String(m.text||"").startsWith("请求失败：")){
        answeredAt=i;break;
      }
    }
    return messages.slice(answeredAt+1).some(m=>m?.role==="user");
  }

  function updateReplyNow(){
    const button=document.querySelector("#xyReplyNow");
    if(!button)return;
    button.hidden=!hasUnansweredUser()||replyRequestRunning||sending;
    button.disabled=replyRequestRunning||sending;
  }

  function ensureHeaderMessageStats(){
    const header=document.querySelector(".main > header");if(!header)return null;
    let wrap=header.querySelector("#xyHeaderMessageStats");
    if(wrap)return wrap;
    wrap=document.createElement("div");wrap.id="xyHeaderMessageStats";wrap.className="xy-header-message-stats";
    wrap.innerHTML='<button type="button" class="xy-header-count" aria-label="查看消息统计" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span>0</span></button><div class="xy-header-stats-sheet" hidden></div>';
    const presence=header.querySelector(".presence");if(presence)presence.appendChild(wrap);else{const settings=header.querySelector("#memoryBtn");header.insertBefore(wrap,settings||null)}
    const button=wrap.querySelector(".xy-header-count"),sheet=wrap.querySelector(".xy-header-stats-sheet");
    button.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      sheet.hidden=!sheet.hidden;button.setAttribute("aria-expanded",String(!sheet.hidden));
    });
    document.addEventListener("click",e=>{
      if(!wrap.contains(e.target)&&!sheet.hidden){sheet.hidden=true;button.setAttribute("aria-expanded","false")}
    });
    return wrap;
  }

  function updateMessageCount(){
    const c=chat(),day=document.querySelector("#messages .day");
    if(!c)return;
    const saved=(c.messages||[]).filter(m=>m?.role==="user"||m?.role==="assistant");
    const total=saved.length;
    const users=saved.filter(m=>m.role==="user").length;
    const assistants=saved.filter(m=>m.role==="assistant").length;
    if(day){day.textContent="AEVREN · XY";day.title="你 "+users+" · "+currentCharacterName()+" "+assistants}
    const wrap=ensureHeaderMessageStats();if(!wrap)return;
    const count=wrap.querySelector(".xy-header-count span"),sheet=wrap.querySelector(".xy-header-stats-sheet");
    if(count)count.textContent=String(total);
    const limit=window.xyContextWindow?.readLimit?.()??40;
    const contextLabel=limit===0?"全部消息":("最近 "+limit+" 条");
    if(sheet)sheet.innerHTML='<span>当前对话</span><strong>'+total+' 条消息</strong><div><span>你</span><b>'+users+'</b></div><div><span>'+esc(currentCharacterName())+'</span><b>'+assistants+'</b></div><div class="is-highlight"><span>发送给模型</span><b>'+contextLabel+'</b></div>';
    wrap.querySelector(".xy-header-count")?.setAttribute("aria-label","当前对话 "+total+" 条消息");
  }

  renderMessages=function(){
    const c=chat(),box=document.querySelector("#messages");
    if(!box||!c)return;
    box.innerHTML='<div class="day">AEVREN · XY</div>'+c.messages.map(messageHtml).join("");
    window.xyStickerShelf?.hydrateRendered?.(box);
    box.scrollTop=box.scrollHeight;
    const name=document.querySelector(".presence strong");if(name)name.textContent=currentCharacterName();
    updatePlaceholder();
    updateMessageCount();
    updateReplyNow();
  };


  document.querySelector("#messages")?.addEventListener("click",event=>{
    const button=event.target.closest?.(".xy-quoted-preview[data-xy-quote-target]");
    if(!button)return;
    event.preventDefault();event.stopPropagation();
    const index=Number(button.dataset.xyQuoteTarget);
    if(!Number.isInteger(index)||index<0)return;
    const target=document.querySelector(`#messages .message[data-message="${index}"]`);
    if(!target)return;
    target.scrollIntoView({behavior:"smooth",block:"center"});
    target.classList.add("xy-quote-target-active");
    setTimeout(()=>target.classList.remove("xy-quote-target-active"),1500);
  });

  // Local Send is intentionally not an API request. Saved messages survive
  // refreshes and switching conversations until the user asks for a reply.
  let localSending=false;
  send=async function(){
    if(localSending||sending)return;
    const c=chat(),input=document.querySelector("#input");
    if(!c||!input)return;
    const text=input.value.trim(),api=window.xyAttachments;
    if(!text&&!api?.peek?.()?.length)return;
    localSending=true;
    const sourceChatId=c.id;
    let files=[];
    try{
      if(api?.busy()){
        api.toast?.("正在处理附件");
        await api.wait();
      }
      // Don't put attachments into a different conversation if the user
      // changed chats while file processing was underway.
      if(chat()?.id!==sourceChatId)return;
      files=api?.take?.()||[];
      if(files.some(a=>a?.kind==="image"&&!a.dataUrl)){
        await window.xyImagePayload?.hydrate?.([{attachments:files}]);
        if(files.some(a=>a?.kind==="image"&&!a.dataUrl)){
          api?.restore?.(files);
          api?.toast?.("图片读取失败，附件已保留，请重试",true);
          return;
        }
      }
      if(!text&&!files.length)return;
      c.messages.push({role:"user",text,attachments:files,createdAt:Date.now()});
      if(c.messages.filter(m=>m.role==="user").length===1){
        c.title=(text||files[0]?.name||"新对话").slice(0,22);
      }
      input.value="";
      try{resize()}catch{}
      save();renderChats();renderMessages();
    }catch(error){
      if(files.length)api?.restore?.(files);
      api?.toast?.("消息暂未发出："+String(error?.message||error),true);
    }finally{
      localSending=false;
      updateReplyNow();
    }
  };
  window.xySendQueued=send;

  async function answerNow(){
    if(replyRequestRunning||sending||!hasUnansweredUser())return;
    const c=chat(),startIndex=c?.messages?.length||0;
    replyRequestRunning=true;
    updateReplyNow();
    try{
      // Dedicated opt-in. This does not add another user message and does not
      // consume or clear any text currently being composed.
      await originalSend({__xyReplyExisting:true});
    }catch(error){
      window.xyAttachments?.toast?.("请求失败："+String(error?.message||error),true);
    }finally{
      const completedAt=Date.now();
      for(let i=startIndex;i<(c?.messages?.length||0);i++){
        if(!c.messages[i].createdAt)c.messages[i].createdAt=completedAt+i-startIndex;
      }
      save();renderMessages();
      replyRequestRunning=false;
      updateReplyNow();
    }
  }

  const sendButton=document.querySelector("#sendBtn");
  if(sendButton){sendButton.disabled=false;sendButton.onclick=send}
  const composerWrap=document.querySelector(".composer-wrap");
  if(composerWrap&&!document.querySelector("#xyReplyNow")){
    const quick=document.createElement("button");
    quick.type="button";quick.id="xyReplyNow";quick.className="xy-reply-now";
    quick.textContent="直接回答";quick.hidden=true;
    composerWrap.insertBefore(quick,composerWrap.querySelector(".composer"));
    quick.addEventListener("click",answerNow);
  }
  const inputEl=document.querySelector("#input");
  if(inputEl)inputEl.onkeydown=e=>{
    if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){
      e.preventDefault();send();
    }
  };
  document.querySelector("#newChat")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    const c=chat();if(c?.messages?.length&&!c.messages[0].createdAt){c.messages[0].createdAt=Date.now();save();renderMessages()}
  }));
  document.addEventListener("click",e=>{
    if(e.target.closest(".use-character")||e.target.id==="saveCharacter")requestAnimationFrame(()=>{updatePlaceholder();renderMessages()});
  });

  migrateLegacyTimestamps();
  renderMessages();
})();