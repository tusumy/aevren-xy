(()=>{
  const originalSend=send;

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

  function messageHtml(m,index){
    const isAssistant=m.role==="assistant";
    const rawParts=splitReply(m.text);
    const parts=isAssistant?rawParts.map(trimPlainEnding):rawParts;
    const stamp=timeText(m.createdAt),title=timeTitle(m.createdAt);
    return parts.map((part,i)=>{
      const first=i===0,last=i===parts.length-1;
      const split=parts.length>1?` split-piece ${first?"split-first":""} ${last?"split-last":"split-mid"}`:"";
      const ts=last&&stamp?`<span class="message-time" title="${esc(title)}">${esc(stamp)}</span>`:"";
      return `<div class="message ${m.role}${split}" data-message="${index}" data-part="${i}"><div class="message-stack"><div class="bubble"><span class="bubble-text">${esc(part)}</span></div>${ts}</div></div>`;
    }).join("");
  }

  renderMessages=function(){
    const c=chat(),box=document.querySelector("#messages");
    if(!box||!c)return;
    box.innerHTML='<div class="day">AEVREN · XY</div>'+c.messages.map(messageHtml).join("");
    box.scrollTop=box.scrollHeight;
    const name=document.querySelector(".presence strong");if(name)name.textContent=currentCharacterName();
    updatePlaceholder();
  };

  send=async function(){
    const c=chat();
    if(!c)return originalSend();
    const before=c.messages.length,start=Date.now();
    const pending=originalSend();
    const afterImmediate=c.messages.length;
    for(let i=before;i<afterImmediate;i++)if(!c.messages[i].createdAt)c.messages[i].createdAt=start+i-before;
    if(afterImmediate>before){save();renderMessages()}
    try{return await pending}
    finally{
      const finished=Date.now();
      for(let i=afterImmediate;i<c.messages.length;i++)if(!c.messages[i].createdAt)c.messages[i].createdAt=finished+i-afterImmediate;
      save();renderMessages();
    }
  };

  const sendButton=document.querySelector("#sendBtn");if(sendButton)sendButton.onclick=send;
  document.querySelector("#newChat")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    const c=chat();if(c?.messages?.length&&!c.messages[0].createdAt){c.messages[0].createdAt=Date.now();save();renderMessages()}
  }));
  document.addEventListener("click",e=>{
    if(e.target.closest(".use-character")||e.target.id==="saveCharacter")requestAnimationFrame(()=>{updatePlaceholder();renderMessages()});
  });

  migrateLegacyTimestamps();
  renderMessages();
})();