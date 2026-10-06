(()=>{
  const closeOverlays=()=>{
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#scrim")?.classList.remove("show");
    document.querySelector(".xy-edit-backdrop")?.remove();
    document.querySelector(".xy-context-backdrop")?.remove();
    document.querySelector(".xy-context-active")?.classList.remove("xy-context-active");
  };
  const ensureHistory=()=>{
    if(history.state?.xyOverlay)return;
    history.pushState({...history.state,xyOverlay:true},"");
  };

  const priorOpenPanel=openPanel;
  openPanel=function(type){ensureHistory();return priorOpenPanel(type)};

  document.querySelector("#menuBtn")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    if(document.querySelector("#sidebar")?.classList.contains("open"))ensureHistory();
  }));

  window.addEventListener("popstate",()=>closeOverlays());

  ["#closePanel","#sidebarClose","#scrim"].forEach(sel=>{
    document.querySelector(sel)?.addEventListener("click",()=>{
      if(history.state?.xyOverlay)history.back();
    });
  });
})();