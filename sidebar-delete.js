(()=>{
  "use strict";
  const list=document.querySelector("#chatList");
  if(!list)return;

  const idOf=x=>String(x);
  const findChat=id=>chats.find(c=>idOf(c.id)===idOf(id));
  const titleOf=c=>String(c?.title||"新对话").trim()||"新对话";
  const HOLD_MS=540, MOVE_TOLERANCE=12;
  let hold=null, menu=null, suppress=null;

  const targetButton=target=>target?.closest?.("button.chat-item[data-id]");
  const cancelHold=()=>{
    if(hold?.timer)clearTimeout(hold.timer);
    hold=null;
  };
  const suppressNextClick=id=>{
    suppress={id:idOf(id),until:Date.now()+1200};
  };
  function closeMenu(){
    if(menu){menu.remove();menu=null}
  }
  function openMenu(button){
    const c=findChat(button?.dataset?.id);
    if(!c)return;
    cancelHold();
    closeMenu();
    const popup=document.createElement("div");
    popup.className="xy-chat-options";
    popup.id="xyChatOptions";
    popup.setAttribute("role","menu");
    popup.setAttribute("aria-label","对话操作："+titleOf(c));
    popup.innerHTML=
      '<button type="button" role="menuitem" data-op="rename">重命名</button>'+
      '<button type="button" role="menuitem" data-op="delete" class="danger">删除对话</button>';
    document.body.appendChild(popup);
    menu=popup;
    const box=button.getBoundingClientRect();
    // Keep the menu within the visible area on narrow phone screens.
    const width=popup.offsetWidth||162,height=popup.offsetHeight||88;
    const vw=document.documentElement.clientWidth||window.innerWidth;
    const vh=document.documentElement.clientHeight||window.innerHeight;
    popup.style.left=Math.max(8,Math.min(box.right-width,vw-width-8))+"px";
    popup.style.top=Math.max(8,Math.min(box.bottom+3,vh-height-8))+"px";
    popup.addEventListener("click",event=>{
      const action=event.target.closest?.("button[data-op]")?.dataset.op;
      if(!action)return;
      event.preventDefault();event.stopPropagation();
      closeMenu();
      const live=findChat(c.id);
      if(!live)return;
      if(action==="rename")renameChat(live);
      if(action==="delete")askDelete(live);
    });
    popup.querySelector("button")?.focus({preventScroll:true});
  }

  function renameChat(conversation){
    if(document.querySelector("#xyChatRenameDialog"))return;
    const id=idOf(conversation.id);
    const overlay=document.createElement("div");
    overlay.id="xyChatRenameDialog";
    overlay.className="xy-edit-backdrop xy-chat-rename-backdrop";
    overlay.innerHTML=
      '<div class="xy-edit-card" role="dialog" aria-modal="true" aria-labelledby="xyChatRenameTitle">'+
      '<div class="xy-edit-title" id="xyChatRenameTitle">重命名对话</div>'+
      '<input id="xyChatRenameInput" type="text" maxlength="60" autocomplete="off" aria-label="对话名称">'+
      '<div class="xy-chat-rename-error" role="status" hidden></div>'+
      '<div class="xy-edit-actions"><button type="button" data-action="cancel">取消</button>'+
      '<button type="button" class="primary" data-action="save">保存</button></div></div>';
    const input=overlay.querySelector("#xyChatRenameInput");
    const error=overlay.querySelector(".xy-chat-rename-error");
    input.value=titleOf(conversation);
    const close=()=>overlay.remove();
    const submit=()=>{
      const title=input.value.trim();
      if(!title){error.textContent="名称不能为空";error.hidden=false;return}
      if(sending){error.textContent="正在回复消息，请稍后再修改名称";error.hidden=false;return}
      const live=findChat(id);
      if(!live){error.textContent="找不到这条对话";error.hidden=false;return}
      const old=live.title;
      live.title=title;
      try{save()}catch(err){live.title=old;error.textContent="保存失败："+(err.message||err);error.hidden=false;return}
      renderChats();
      close();
    };
    overlay.querySelector('[data-action="cancel"]').addEventListener("click",close);
    overlay.querySelector('[data-action="save"]').addEventListener("click",submit);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    overlay.addEventListener("keydown",e=>{
      if(e.key==="Escape"){e.preventDefault();close()}
      if(e.key==="Enter"&&e.target===input){e.preventDefault();submit()}
    });
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  function nextChat(){
    let id=Date.now();
    while(chats.some(c=>idOf(c.id)===idOf(id)))id++;
    const ch=window.xyCurrentCharacter?.();
    return {
      id,title:"新对话",characterId:ch?.id||undefined,
      messages:[{role:"assistant",text:"嗯，我在。",createdAt:Date.now()}]
    };
  }

  function askDelete(conversation){
    if(document.querySelector("#xyConversationDeleteDialog"))return;
    const id=idOf(conversation.id);
    const title=titleOf(conversation);
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
        const index=chats.findIndex(c=>idOf(c.id)===id);
        if(index<0)throw new Error("这条对话已不存在。");
        if(sending)throw new Error("消息回复正在进行，已取消删除。");
        const previous=chats,oldCurrent=current;
        const removingCurrent=idOf(current)===id;
        const next=chats.filter(c=>idOf(c.id)!==id);
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

  list.addEventListener("pointerdown",event=>{
    if(event.pointerType==="mouse"||event.button!==0)return;
    const button=targetButton(event.target);
    if(!button||!list.contains(button))return;
    closeMenu();
    cancelHold();
    const id=idOf(button.dataset.id);
    hold={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{
      if(!hold||hold.id!==id||hold.pointerId!==event.pointerId)return;
      hold=null;
      suppressNextClick(id);
      navigator.vibrate?.(12);
      openMenu(button);
    },HOLD_MS)};
  });
  list.addEventListener("pointermove",event=>{
    if(!hold||event.pointerId!==hold.pointerId)return;
    if(Math.abs(event.clientX-hold.x)>MOVE_TOLERANCE||Math.abs(event.clientY-hold.y)>MOVE_TOLERANCE)cancelHold();
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])list.addEventListener(type,cancelHold);
  list.addEventListener("contextmenu",event=>{
    const button=targetButton(event.target);
    if(!button||!list.contains(button))return;
    event.preventDefault();
    suppressNextClick(button.dataset.id);
    openMenu(button);
  });
  list.addEventListener("keydown",event=>{
    if(event.key!=="ContextMenu"&&!(event.shiftKey&&event.key==="F10"))return;
    const button=targetButton(event.target);
    if(!button||!list.contains(button))return;
    event.preventDefault();
    openMenu(button);
  });

  // A long-press can synthesize a click when the finger lifts. Block only
  // that click, not normal chat selection or taps on other rows.
  list.addEventListener("click",event=>{
    const button=targetButton(event.target);
    if(suppress&&Date.now()>suppress.until)suppress=null;
    if(suppress&&button&&idOf(button.dataset.id)===suppress.id){
      suppress=null;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener("pointerdown",event=>{
    if(menu&&!menu.contains(event.target)&&!list.contains(event.target))closeMenu();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&menu){event.preventDefault();closeMenu()}
  });

  // The standard click handler from app.js remains unchanged.
})();