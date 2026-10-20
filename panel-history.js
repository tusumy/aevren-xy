(()=>{
  "use strict";
  let returningToHub=false;

  const panel=document.querySelector("#panel");
  const panelClose=document.querySelector("#closePanel");

  function closeOverlays(){
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#scrim")?.classList.remove("show");
    document.querySelector(".xy-edit-backdrop")?.remove();
    document.querySelector(".xy-context-backdrop")?.remove();
    document.querySelector(".xy-delete-backdrop")?.remove();
    document.querySelector(".xy-context-active")?.classList.remove("xy-context-active");
    returningToHub=false;
    updatePanelClose(false);
  }
  function ensureHistory(){
    if(history.state?.xyOverlay)return;
    history.pushState({...history.state,xyOverlay:true},"");
  }
  function updatePanelClose(isChild){
    if(!panelClose)return;
    panelClose.textContent=isChild?"‹":"×";
    panelClose.setAttribute("aria-label",isChild?"返回工具中心":"关闭页面");
    panelClose.title=isChild?"返回工具中心":"关闭页面";
    panel?.classList.toggle("xy-from-toolhub",isChild);
  }
  function enterFromHub(){
    // The hub is already the active overlay. Add a *nested* browser-history
    // entry for the selected tool so Android hardware Back also returns there.
    ensureHistory();
    if(!history.state?.xyHubChild){
      history.pushState({...history.state,xyOverlay:true,xyHubChild:true},"");
    }
    returningToHub=true;
    updatePanelClose(true);
  }
  function requestBackToHub(event){
    if(!returningToHub||!history.state?.xyHubChild)return false;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    history.back();
    return true;
  }
  window.xyEnsureOverlayHistory=ensureHistory;
  window.xyPanelNavigation={enterFromHub,backToHub:requestBackToHub,
    isHubChild:()=>returningToHub&&!!history.state?.xyHubChild};

  const priorOpenPanel=openPanel;
  openPanel=function(type){ensureHistory();return priorOpenPanel(type)};

  document.querySelector("#menuBtn")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    if(document.querySelector("#sidebar")?.classList.contains("open"))ensureHistory();
  }));

  window.addEventListener("popstate",()=>{
    // From a tool opened inside Tool Hub, one Back should restore the hub,
    // rather than dismissing the overlay all the way to the conversation.
    if(returningToHub&&history.state?.xyOverlay&&!history.state?.xyHubChild){
      returningToHub=false;
      updatePanelClose(false);
      openPanel("toolhub");
      return;
    }
    closeOverlays();
  });

  // app.js already owns a bubble-phase close handler; intercept only the
  // nested-tool case before it closes the panel. Ordinary close stays intact.
  panelClose?.addEventListener("click",event=>{
    requestBackToHub(event);
  },true);
  ["#closePanel","#sidebarClose","#scrim"].forEach(sel=>{
    document.querySelector(sel)?.addEventListener("click",()=>{
      if(history.state?.xyOverlay)history.back();
    });
  });
})();