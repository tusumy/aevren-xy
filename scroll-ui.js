(()=>{
  const box=document.querySelector("#messages");
  const main=document.querySelector(".main");
  if(!box||!main)return;

  let stickToBottom=true;
  let forceBottom=false;
  let restoring=false;

  const distanceFromBottom=()=>Math.max(0,box.scrollHeight-box.clientHeight-box.scrollTop);
  const nearBottom=()=>distanceFromBottom()<120;

  let down=document.querySelector("#xyScrollBottom");
  if(!down){
    down=document.createElement("button");
    down.type="button";
    down.id="xyScrollBottom";
    down.className="xy-scroll-bottom";
    down.setAttribute("aria-label","回到底部");
    down.textContent="↓";
    main.appendChild(down);
  }

  function updateButton(){
    const show=!nearBottom();
    down.classList.toggle("show",show);
  }

  function jumpBottom(smooth=true){
    forceBottom=true;
    stickToBottom=true;
    box.scrollTo({top:box.scrollHeight,behavior:smooth?"smooth":"auto"});
    setTimeout(()=>{forceBottom=false;updateButton()},smooth?260:0);
  }

  down.addEventListener("click",()=>jumpBottom(true));

  box.addEventListener("scroll",()=>{
    if(restoring)return;
    stickToBottom=nearBottom();
    updateButton();
  },{passive:true});

  document.querySelector("#sendBtn")?.addEventListener("click",()=>{forceBottom=true;stickToBottom=true},true);
  document.querySelector("#input")?.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey){forceBottom=true;stickToBottom=true}
  },true);
  box.addEventListener("click",e=>{
    if(e.target.closest?.(".xy-option-send")){forceBottom=true;stickToBottom=true}
  },true);

  const priorRender=renderMessages;
  renderMessages=function(){
    const wasNear=nearBottom();
    const oldTop=box.scrollTop;
    const oldHeight=box.scrollHeight;
    const shouldBottom=forceBottom||stickToBottom||wasNear;
    const result=priorRender();
    requestAnimationFrame(()=>{
      restoring=true;
      if(shouldBottom){
        box.style.scrollBehavior="auto";
        box.scrollTop=box.scrollHeight;
        requestAnimationFrame(()=>{box.style.scrollBehavior="";restoring=false;forceBottom=false;stickToBottom=true;updateButton()});
      }else{
        const delta=box.scrollHeight-oldHeight;
        box.style.scrollBehavior="auto";
        box.scrollTop=Math.max(0,oldTop+delta);
        requestAnimationFrame(()=>{box.style.scrollBehavior="";restoring=false;updateButton()});
      }
    });
    return result;
  };

  const observer=new MutationObserver(()=>{
    if(forceBottom||stickToBottom||nearBottom()){
      requestAnimationFrame(()=>{
        box.style.scrollBehavior="auto";
        box.scrollTop=box.scrollHeight;
        requestAnimationFrame(()=>{box.style.scrollBehavior="";updateButton()});
      });
    }else updateButton();
  });
  observer.observe(box,{childList:true,subtree:true});

  window.xyScrollToBottom=jumpBottom;
  requestAnimationFrame(()=>jumpBottom(false));
})();