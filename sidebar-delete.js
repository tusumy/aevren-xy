(()=>{
  "use strict";
  const list=document.querySelector("#chatList");
  if(!list)return;
  const safeId=value=>String(value);
  const findConversation=id=>chats.find(c=>safeId(c.id)===safeId(id));
  const label=c=>String(c?.title||"新对话").trim()||"新对话";

  const previousRenderChats=renderChats;
  renderChats=function(){
    // Reuse the existing title rendering, then add a sibling delete button.
    previousRenderChats();
    const buttons=[...list.querySelectorAll("button.chat-item[data-id]")];
    for(const button of buttons){
      const id=button.dataset.id;
      const conversation=findConversation(id);
      if(!conversation)continue;
      const row=document.createElement("div");
      row.className="xy-chat-row";
      const del=document.createElement("button");
      del.type="button";
      del.className="xy-chat-delete";
      del.dataset.deleteChat=id;
      del.setAttribute("aria-label","删除对话："+label(conversation));
      del.title="删除对话";
      del.textContent="×";
      button.replaceWith(row);
      row.append(button,del);
    }
  };

  function nextChat(){
    let id=Date.now();
    while(chats.some(c=>safeId(c.id)===safeId(id)))id++;
    const ch=window.xyCurrentCharacter?.();
    return {
      id,title:"新对话",characterId:ch?.id||undefined,
      messages:[{role:"assistant",text:"嗯，我在。",createdAt:Date.now()}]
    };
  }

  function askDelete(conversation){
    if(document.querySelector("#xyConversationDeleteDialog"))return;
    const id=safeId(conversation.id);
    const title=label(conversation);
    const overlay=document.createElement("div");
    overlay.id="xyConversationDeleteDialog";
    overlay.className="xy-edit-backdrop xy-chat-delete-backdrop";
    overlay.innerHTML=
      '<div class="xy-delete-card" role="dialog" aria-modal="true" aria-labelledby="xyChatDeleteTitle">'+
      '<div class="xy-delete-title" id="xyChatDeleteTitle"></div>'+
      '<div class="xy-delete-copy">只删除这一个本机对话，其他聊天、记忆、日记和云端备份不受影响。删除前会保存一份本机快照。</div>'+
      '<div class="xy-delete-copy xy-chat-delete-error" role="status" hidden></div>'+
      '<div class="xy-delete-actions"><button type="button" data-action="cancel">取消</button>'+
      '<button type="button" class="danger" data-action="confirm">确认删除</button></div></div>';
    overlay.querySelector("#xyChatDeleteTitle").textContent="删除「"+title+"」？";
    const cancel=overlay.querySelector('[data-action="cancel"]');
    const confirm=overlay.querySelector('[data-action="confirm"]');
    const error=overlay.querySelector(".xy-chat-delete-error");
    let running=false;
    const close=()=>{if(!running)overlay.remove()};
    cancel.addEventListener("click",close);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    overlay.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();close()}});
    confirm.addEventListener("click",async()=>{
      if(running)return;
      running=true;
      cancel.disabled=true;confirm.disabled=true;confirm.textContent="正在备份…";
      error.hidden=true;
      try{
        if(sending)throw new Error("正在回复消息，请等这轮回复结束后再删除。");
        const mgr=window.xyDataManager;
        if(typeof mgr?.createSnapshot!=="function")
          throw new Error("数据保护功能尚未准备好。请重新打开砚屿后再试。");
        const protectedCopy=await mgr.createSnapshot("删除对话前："+title.slice(0,32));
        if(!protectedCopy)throw new Error("本机快照正在保存，请稍后重试。");
        const index=chats.findIndex(c=>safeId(c.id)===id);
        if(index<0)throw new Error("这条对话已不存在。");
        // A request could begin while the snapshot was being written.
        if(sending)throw new Error("消息回复正在进行，已取消删除。");
        const previous=chats,oldCurrent=current;
        const removingCurrent=safeId(current)===id;
        const next=chats.filter(c=>safeId(c.id)!==id);
        chats=next.length?next:[nextChat()];
        if(removingCurrent)current=chats[0].id;
        try{save()}
        catch(err){chats=previous;current=oldCurrent;throw err}
        renderChats();
        if(removingCurrent)renderMessages();
        overlay.remove();
      }catch(err){
        error.textContent="未删除："+(err?.message||String(err));
        error.hidden=false;
        running=false;cancel.disabled=false;confirm.disabled=false;confirm.textContent="确认删除";
      }
    });
    document.body.appendChild(overlay);
    cancel.focus();
  }

  // The original sidebar handler only handles [data-id]. The delete button
  // is a sibling of that element and is caught before it can select a chat.
  list.addEventListener("click",event=>{
    const button=event.target.closest?.("button[data-delete-chat]");
    if(!button||!list.contains(button))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const c=findConversation(button.dataset.deleteChat);
    if(c)askDelete(c);
  },true);

  renderChats();
})();