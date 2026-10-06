(()=>{
  const side=document.querySelector("#sidebar"),panel=document.querySelector("#panel"),scrim=document.querySelector("#scrim");
  if(!side||!scrim)return;
  let sx=0,sy=0,tracking=false,closing=false;
  const open=()=>{panel?.classList.remove("open");side.classList.add("open");scrim.classList.add("show");window.xyEnsureOverlayHistory?.()};
  const close=()=>{if(history.state?.xyOverlay)history.back();else{side.classList.remove("open");scrim.classList.remove("show")}};

  document.addEventListener("touchstart",e=>{
    const t=e.touches?.[0];if(!t)return;
    const isOpen=side.classList.contains("open");
    if(!isOpen&&t.clientX<=56){tracking=true;closing=false;sx=t.clientX;sy=t.clientY}
    else if(isOpen&&t.clientX<=Math.min(side.getBoundingClientRect().right,window.innerWidth*.9)){tracking=true;closing=true;sx=t.clientX;sy=t.clientY}
  },{passive:true});
  document.addEventListener("touchend",e=>{
    if(!tracking)return;tracking=false;
    const t=e.changedTouches?.[0];if(!t)return;
    const dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)*.9)return;
    if(!closing&&dx>62)open();
    if(closing&&dx<-62)close();
  },{passive:true});
})();