(()=>{
  const root=document.documentElement;
  const KEY="xy.bubbleColors";
  const DEFAULTS={userBubble:"#d9e7dd",assistantBubble:"#f3f1eb"};
  const valid=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||"").trim());
  const norm=v=>valid(v)?String(v).trim().toLowerCase():null;
  const readJson=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const readTheme=()=>readJson("xy.theme",{});
  const readColors=()=>{
    const saved=readJson(KEY,{}),theme=readTheme();
    return {
      userBubble:norm(saved.userBubble)||norm(theme.userBubble)||DEFAULTS.userBubble,
      assistantBubble:norm(saved.assistantBubble)||norm(theme.assistantBubble)||DEFAULTS.assistantBubble
    };
  };
  let colors=readColors();
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(colors))}catch{}};
  const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  const textFor=hex=>{const [r,g,b]=rgb(hex);return r*.299+g*.587+b*.114>165?"#303632":"#f7faf8"};

  function paint(){
    root.style.setProperty("--theme-user-bubble",colors.userBubble);
    root.style.setProperty("--theme-assistant-bubble",colors.assistantBubble);
    document.querySelectorAll(".message.user .bubble").forEach(el=>{
      el.style.setProperty("background",colors.userBubble,"important");
      el.style.setProperty("background-color",colors.userBubble,"important");
      el.style.setProperty("color",textFor(colors.userBubble),"important");
    });
    document.querySelectorAll(".message.assistant .bubble").forEach(el=>{
      el.style.setProperty("background",colors.assistantBubble,"important");
      el.style.setProperty("background-color",colors.assistantBubble,"important");
      el.style.setProperty("color",textFor(colors.assistantBubble),"important");
    });
  }

  function syncPanel(){
    const user=document.querySelector("#themeBubbleColor"),assistant=document.querySelector("#themeAssistantBubble");
    if(user)user.value=colors.userBubble;
    if(assistant)assistant.value=colors.assistantBubble;
    [["themeBubbleColor","userBubble"],["themeAssistantBubble","assistantBubble"]].forEach(([id,key])=>{
      const picker=document.querySelector("#"+id);if(!picker)return;
      let hex=picker.parentElement?.querySelector(`.theme-hex-input[data-for="${id}"]`);
      if(!hex){
        hex=document.createElement("input");
        hex.type="text";hex.inputMode="text";hex.maxLength=7;hex.placeholder="#RRGGBB";
        hex.className="theme-hex-input";hex.dataset.for=id;
        picker.parentElement?.insertBefore(hex,picker);
      }
      hex.value=colors[key];
    });
  }

  function setColor(key,value){
    const v=norm(value);if(!v)return;
    colors={...colors,[key]:v};persist();paint();syncPanel();
  }

  document.addEventListener("input",e=>{
    if(e.target.id==="themeBubbleColor")setColor("userBubble",e.target.value);
    if(e.target.id==="themeAssistantBubble")setColor("assistantBubble",e.target.value);
    if(e.target.classList?.contains("theme-hex-input")){
      const key=e.target.dataset.for==="themeBubbleColor"?"userBubble":e.target.dataset.for==="themeAssistantBubble"?"assistantBubble":"";
      if(key&&norm(e.target.value))setColor(key,e.target.value);
    }
  });
  document.addEventListener("change",e=>{
    if(e.target.id==="themeBubbleColor")setColor("userBubble",e.target.value);
    if(e.target.id==="themeAssistantBubble")setColor("assistantBubble",e.target.value);
  });

  document.addEventListener("click",e=>{
    if(e.target.closest?.("#menuBtn")){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelector("#panel")?.classList.remove("open");
      document.querySelector("#sidebar")?.classList.add("open");
      document.querySelector("#scrim")?.classList.add("show");
      return;
    }
    const nav=e.target.closest?.("#sidebar [data-panel]");
    if(nav){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelector("#sidebar")?.classList.remove("open");
      openPanel(nav.dataset.panel);
      requestAnimationFrame(()=>{syncPanel();paint()});
      return;
    }
    if(e.target.closest?.("#closePanel")){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelector("#panel")?.classList.remove("open");
      document.querySelector("#scrim")?.classList.remove("show");
      return;
    }
    if(e.target.closest?.("[data-theme-preset]")||e.target.id==="resetTheme"){
      setTimeout(()=>{
        const theme=readTheme();
        colors={
          userBubble:norm(theme.userBubble)||DEFAULTS.userBubble,
          assistantBubble:norm(theme.assistantBubble)||DEFAULTS.assistantBubble
        };
        persist();paint();syncPanel();
      },0);
    }
  },true);

  const panelBody=document.querySelector("#panelBody");
  if(panelBody)new MutationObserver(()=>requestAnimationFrame(syncPanel)).observe(panelBody,{childList:true,subtree:true});
  const messages=document.querySelector("#messages");
  if(messages)new MutationObserver(()=>requestAnimationFrame(paint)).observe(messages,{childList:true,subtree:true});
  syncPanel();paint();
})();
