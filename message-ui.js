(()=>{
  const originalSend=window.AevrenApiCompat?.send||send;
  const pendingUserQueue=[];
  let queueDraining=false,pendingSeq=0,flushTimer=null;
  const SEND_SETTLE_MS=10000;

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
    if(raw.includes("```"))return [raw];
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
        const playable=Boolean(a.dataUrl);
        return `<button type="button" class="xy-message-voice-note" ${playable?`data-voice-note-src="${esc(a.dataUrl)}"`:"disabled"} title="${playable?"播放语音":"本地语音缓存已失效"}"><span class="xy-message-voice-icon">▶</span><span class="xy-message-voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>${duration}"</b></button>`;
      }
      return `<div class="xy-message-file"><span>▤</span><b>${esc(a.name||"附件")}</b></div>`;
    }).join("");
    return `<div class="xy-message-attachments">${inner}</div>`;
  }

  function messageHtml(m,index){
    if(m?.kind==="call"){
      const when=timeText(m.createdAt),name=String(m.characterName||"角色");
      const rows=Array.isArray(m.transcript)?m.transcript.slice(0,160):[];
      const content=rows.length?rows.map(item=>`<div class="xy-call-history-turn"><b>${esc(item.role==="user"?"你":name)}</b><span>${esc(String(item.text||""))}</span></div>`).join(""):'<div class="xy-call-history-empty">本次没有识别到对话</div>';
      return `<div class="message xy-call-record"><details class="xy-call-history"><summary><span class="xy-call-history-icon">☎</span><span>与${esc(name)}通话 · ${esc(m.duration||"00:00")}</span><small>${esc(when)}</small></summary><div class="xy-call-history-content">${content}</div></details></div>`;
    }
    const isAssistant=m.role==="assistant";
    const rawParts=isAssistant?splitReply(m.text):[String(m.text??"")];
    const parts=isAssistant?rawParts.map(trimPlainEnding):rawParts;
    const stamp=timeText(m.createdAt),title=timeTitle(m.createdAt),media=attachmentHtml(m.attachments);
    return parts.map((part,i)=>{
      const first=i===0,last=i===parts.length-1;
      const split=parts.length>1?` split-piece ${first?"split-first":""} ${last?"split-last":"split-mid"}`:"";
      const ts=last&&stamp?`<span class="message-time" title="${esc(title)}">${esc(stamp)}</span>`:"";
      const attachments=!isAssistant&&first?media:"";
      const text=part?`<span class="bubble-text">${esc(part)}</span>`:"";
      return `<div class="message ${m.role}${split}" data-message="${index}" data-part="${i}"><div class="message-stack"><div class="bubble">${attachments}${text}</div>${ts}</div></div>`;
    }).join("");
  }

  function pendingHtml(item){
    const stamp=timeText(item.createdAt),title=timeTitle(item.createdAt);
    const ts=stamp?`<span class="message-time" title="${esc(title)}">${esc(stamp)}</span>`:"";
    const media=attachmentHtml(item.attachments),text=item.text?`<span class="bubble-text">${esc(item.text)}</span>`:"";
    return `<div class="message user xy-pending" data-pending="${item.id}"><div class="message-stack"><div class="bubble">${media}${text}</div>${ts}</div></div>`;
  }

  function updateReplyNow(){
    const button=document.querySelector("#xyReplyNow");
    if(button)button.hidden=!pendingUserQueue.length||queueDraining||sending;
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
    const total=saved.length+pendingUserQueue.length;
    const users=saved.filter(m=>m.role==="user").length+pendingUserQueue.length;
    const assistants=saved.filter(m=>m.role==="assistant").length;
    if(day){day.textContent="AEVREN · XY";day.title="你 "+users+" · "+currentCharacterName()+" "+assistants}
    const wrap=ensureHeaderMessageStats();if(!wrap)return;
    const count=wrap.querySelector(".xy-header-count span"),sheet=wrap.querySelector(".xy-header-stats-sheet");
    if(count)count.textContent=String(total);
    const limit=String(localStorage.getItem("xy.contextMessageLimit")||"40");
    const contextLabel=limit==="0"?"全部消息":("最近 "+limit+" 条");
    if(sheet)sheet.innerHTML='<span>当前对话</span><strong>'+total+' 条消息</strong><div><span>你</span><b>'+users+'</b></div><div><span>'+esc(currentCharacterName())+'</span><b>'+assistants+'</b></div><div class="is-highlight"><span>发送给模型</span><b>'+contextLabel+'</b></div>';
    wrap.querySelector(".xy-header-count")?.setAttribute("aria-label","当前对话 "+total+" 条消息");
  }

  function renderPendingQueue(){
    const box=document.querySelector("#messages");if(!box)return;
    box.querySelectorAll(".xy-pending").forEach(x=>x.remove());
    if(!pendingUserQueue.length){updateReplyNow();updateMessageCount();return}
    const html=pendingUserQueue.map(pendingHtml).join("");
    const typing=box.querySelector("#typing");
    if(typing)typing.insertAdjacentHTML("beforebegin",html);else box.insertAdjacentHTML("beforeend",html);
    box.scrollTop=box.scrollHeight;
    updateReplyNow();
    updateMessageCount();
  }

  renderMessages=function(){
    const c=chat(),box=document.querySelector("#messages");
    if(!box||!c)return;
    box.innerHTML='<div class="day">AEVREN · XY</div>'+c.messages.map(messageHtml).join("");
    renderPendingQueue();
    box.scrollTop=box.scrollHeight;
    const name=document.querySelector(".presence strong");if(name)name.textContent=currentCharacterName();
    updatePlaceholder();
    updateMessageCount();
  };

  async function performOriginalSend(text,createdAt=Date.now(),attachments=[]){
    const c=chat(),input=document.querySelector("#input");
    if(!c||!input)return;
    input.value=String(text||"");
    window.xyActiveSendAttachments=Array.isArray(attachments)?attachments:[];
    try{resize()}catch{}
    const before=c.messages.length,start=Date.now();
    const pending=originalSend();
    const afterImmediate=c.messages.length;
    for(let i=before;i<afterImmediate;i++){
      if(c.messages[i].createdAt)continue;
      c.messages[i].createdAt=(i===before&&c.messages[i].role==="user")?createdAt:start+i-before;
    }
    if(afterImmediate>before){
      save();renderMessages();
      if(sending&&!document.querySelector("#typing"))showTyping();
    }
    const button=document.querySelector("#sendBtn");
    if(button&&sending)button.disabled=false;
    try{return await pending}
    finally{
      window.xyActiveSendAttachments=[];
      const finished=Date.now();
      for(let i=afterImmediate;i<c.messages.length;i++)if(!c.messages[i].createdAt)c.messages[i].createdAt=finished+i-afterImmediate;
      save();renderMessages();
      if(button)button.disabled=false;
    }
  }

  async function queueCurrentInput(){
    const input=document.querySelector("#input"),text=input?.value.trim()||"";
    if(!input)return false;
    const api=window.xyAttachments;
    if(api?.busy()){
      api.toast?.("图片还在处理，处理完会继续发送");
      try{await api.wait()}catch{}
    }
    const attachments=api?.take?.();
    const files=Array.isArray(attachments)?attachments:[];
    if(!text&&!files.length)return false;
    pendingUserQueue.push({id:++pendingSeq,text,attachments:files,createdAt:Date.now()});
    input.value="";
    try{resize()}catch{}
    renderPendingQueue();
    return true;
  }

  function scheduleFlush(delay=SEND_SETTLE_MS){
    if(flushTimer)clearTimeout(flushTimer);
    flushTimer=setTimeout(()=>{
      flushTimer=null;
      const draft=document.querySelector("#input")?.value.trim()||"";
      if(draft){scheduleFlush(900);return}
      drainQueue();
    },delay);
  }

  async function drainQueue(){
    if(queueDraining||sending||!pendingUserQueue.length){
      if(pendingUserQueue.length)scheduleFlush();
      return;
    }
    queueDraining=true;
    updateReplyNow();
    try{
      const batch=pendingUserQueue.splice(0);
      renderPendingQueue();
      const c=chat();if(!c)return;
      const last=batch.at(-1),hadUser=c.messages.some(x=>x.role==="user");
      if(!hadUser){
        const first=batch[0];
        c.title=(first?.text||first?.attachments?.[0]?.name||"新对话").slice(0,22);
      }
      for(const item of batch.slice(0,-1))c.messages.push({role:"user",text:item.text,attachments:item.attachments||[],createdAt:item.createdAt});
      if(batch.length>1||!hadUser){save();renderChats();renderMessages()}
      await performOriginalSend(last.text,last.createdAt,last.attachments||[]);
    }finally{
      queueDraining=false;
      updateReplyNow();
      if(pendingUserQueue.length)scheduleFlush();
    }
  }

  send=async function(){
    if(!await queueCurrentInput())return;
    const latest=pendingUserQueue.at(-1);
    if(latest?.attachments?.length){
      if(flushTimer){clearTimeout(flushTimer);flushTimer=null}
      await drainQueue();
      return;
    }
    scheduleFlush();
  };
  window.xySendQueued=send;

  const sendButton=document.querySelector("#sendBtn");if(sendButton){sendButton.disabled=false;sendButton.onclick=send}
  const composerWrap=document.querySelector(".composer-wrap");
  if(composerWrap&&!document.querySelector("#xyReplyNow")){
    const quick=document.createElement("button");
    quick.type="button";quick.id="xyReplyNow";quick.className="xy-reply-now";quick.textContent="直接回答";quick.hidden=true;
    composerWrap.insertBefore(quick,composerWrap.querySelector(".composer"));
    quick.addEventListener("click",()=>{if(flushTimer){clearTimeout(flushTimer);flushTimer=null}drainQueue()});
  }
  const inputEl=document.querySelector("#input");
  inputEl?.addEventListener("input",()=>{if(pendingUserQueue.length)scheduleFlush()});
  if(inputEl)inputEl.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
  document.querySelector("#newChat")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    const c=chat();if(c?.messages?.length&&!c.messages[0].createdAt){c.messages[0].createdAt=Date.now();save();renderMessages()}
  }));
  document.addEventListener("click",e=>{
    if(e.target.closest(".use-character")||e.target.id==="saveCharacter")requestAnimationFrame(()=>{updatePlaceholder();renderMessages()});
  });

  migrateLegacyTimestamps();
  renderMessages();
})();