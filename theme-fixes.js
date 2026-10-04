(()=>{
  const root=document.documentElement;
  const clamp=n=>Math.max(0,Math.min(255,Math.round(n)));
  const hexToRgb=hex=>{
    const s=String(hex||"").trim().replace("#","");
    if(!/^[0-9a-fA-F]{6}$/.test(s))return null;
    return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
  };
  const rgbToHex=rgb=>"#"+rgb.map(v=>clamp(v).toString(16).padStart(2,"0")).join("");
  const blend=(a,b,keepA)=>{
    const x=hexToRgb(a),y=hexToRgb(b);if(!x||!y)return a||b;
    return rgbToHex(x.map((v,i)=>v*keepA+y[i]*(1-keepA)));
  };
  const cssVar=(name,fallback)=>getComputedStyle(root).getPropertyValue(name).trim()||fallback;
  function refreshBubbleColors(){
    const dark=root.dataset.themeMode==="dark";
    const user=cssVar("--theme-user-bubble","#d9e7dd");
    const assistant=cssVar("--theme-assistant-bubble","#f3f1eb");
    root.style.setProperty("--theme-user-rendered",dark?blend(user,"#17211b",.78):user);
    root.style.setProperty("--theme-assistant-rendered",dark?blend(assistant,"#202622",.62):assistant);
  }
  function persistColor(key,value){
    try{const t=store.get("xy.theme",{});t[key]=value;store.set("xy.theme",t)}catch{}
  }
  function closePanelOnly(){
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#scrim")?.classList.remove("show");
  }
  function openSidebarOnly(){
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#sidebar")?.classList.add("open");
    document.querySelector("#scrim")?.classList.add("show");
  }

  document.addEventListener("input",e=>{
    if(e.target.id==="themeBubbleColor"){
      root.style.setProperty("--theme-user-bubble",e.target.value);
      persistColor("userBubble",e.target.value);
      refreshBubbleColors();
    }
    if(e.target.id==="themeAssistantBubble"){
      root.style.setProperty("--theme-assistant-bubble",e.target.value);
      persistColor("assistantBubble",e.target.value);
      refreshBubbleColors();
    }
  },true);

  document.addEventListener("click",e=>{
    if(e.target.closest?.("#menuBtn")){
      e.preventDefault();e.stopImmediatePropagation();openSidebarOnly();return;
    }
    const nav=e.target.closest?.("#sidebar [data-panel]");
    if(nav){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelector("#sidebar")?.classList.remove("open");
      openPanel(nav.dataset.panel);return;
    }
    if(e.target.closest?.("#closePanel")){
      e.preventDefault();e.stopImmediatePropagation();closePanelOnly();return;
    }
  },true);

  const observer=new MutationObserver(()=>refreshBubbleColors());
  observer.observe(root,{attributes:true,attributeFilter:["data-theme-mode"]});
  refreshBubbleColors();
})();
