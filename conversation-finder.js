(()=>{
  "use strict";
  const input=document.querySelector("#xyConversationSearch");
  const clear=document.querySelector("#xyConversationSearchClear");
  const list=document.querySelector("#chatList");
  const summary=document.querySelector("#xyChatSearchSummary");
  const empty=document.querySelector("#xyConversationSearchEmpty");
  if(!input||!clear||!list||!summary||!empty)return;

  const fold=value=>{
    const raw=String(value??"");
    try{return raw.normalize("NFKC").toLocaleLowerCase().trim()}
    catch{return raw.toLowerCase().trim()}
  };

  function refresh(){
    const q=fold(input.value);
    const nodes=[...list.querySelectorAll("button.chat-item[data-id]")];
    let matches=0;
    for(const node of nodes){
      // Titles are searchable, without exposing message bodies or writing any data.
      const matched=!q||fold(node.textContent).includes(q);
      node.hidden=!matched;
      if(matched)matches++;
    }
    clear.hidden=!q;
    empty.hidden=matches!==0;
    summary.textContent=q?matches+" / "+nodes.length:nodes.length+" 段";
  }

  input.addEventListener("input",()=>{
    refresh();
    list.scrollTop=0;
  });
  input.addEventListener("search",refresh);
  input.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&input.value){
      event.preventDefault();
      input.value="";
      refresh();
    }
  });
  clear.addEventListener("click",()=>{
    input.value="";
    refresh();
    input.focus();
  });

  // The pre-existing delegated chat click handler handles navigation.
  // Reset only the filter afterwards so the next visit shows all chats.
  list.addEventListener("click",event=>{
    if(!event.target.closest("button.chat-item[data-id]"))return;
    if(input.value){
      input.value="";
      refresh();
    }
  });

  // The chat list is replaced whenever a conversation is renamed, pinned,
  // added or deleted. Hook the existing renderer after long-press sorting.
  const previousRenderChats=renderChats;
  renderChats=function(){
    const result=previousRenderChats.apply(this,arguments);
    refresh();
    return result;
  };
  refresh();
})();
