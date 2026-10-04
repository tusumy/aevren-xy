(()=>{
  const root=document.documentElement;
  const COLOR_MAP={
    themeBgColor:{key:"bgColor",css:"--theme-bg"},
    themeBubbleColor:{key:"userBubble",css:"--theme-user-bubble"},
    themeAssistantBubble:{key:"assistantBubble",css:"--theme-assistant-bubble"},
    themeAccent:{key:"accent",css:"--theme-accent"}
  };
  const validHex=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||"").trim());
  const normalize=v=>validHex(v)?String(v).trim().toLowerCase():null;
  const themeData=()=>store.get("xy.theme",{});
  const saveColor=(key,value)=>{const t=themeData();t[key]=value;store.set("xy.theme",t)};
  const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  const textFor=hex=>{const [r,g,b]=rgb(hex);return r*.299+g*.587+b*.114>165?"#303632":"#f7faf8"};

  function paintBubbles(){
    const t=themeData();
    const user=normalize(t.userBubble)||normalize(getComputedStyle(root).getPropertyValue("--theme-user-bubble").trim())||"#d9e7dd";
    const assistant=normalize(t.assistantBubble)||normalize(getComputedStyle(root).getPropertyValue("--theme-assistant-bubble").trim())||"#f3f1eb";
    root.style.setProperty("--theme-user-bubble",user);
    root.style.setProperty("--theme-assistant-bubble",assistant);
    document.querySelectorAll(".message.user .bubble").forEach(el=>{
      el.style.setProperty("background",user,"important");
      el.style.setProperty("background-color",user,"important");
      el.style.setProperty("color",textFor(user),"important");
      el.querySelectorAll(".message-time").forEach(x=>{x.style.color="currentColor";x.style.opacity=".52"});
    });
    document.querySelectorAll(".message.assistant .bubble").forEach(el=>{
      el.style.setProperty("background",assistant,"important");
      el.style.setProperty("background-color",assistant,"important");
      el.style.setProperty("color",textFor(assistant),"important");
      el.querySelectorAll(".message-time").forEach(x=>{x.style.color="currentColor";x.style.opacity=".48"});
    });
  }

  function applyPicker(input){
    const spec=COLOR_MAP[input.id],value=normalize(input.value);if(!spec||!value)return;
    root.style.setProperty(spec.css,value);
    saveColor(spec.key,value);
    const hex=input.parentElement?.querySelector(`.theme-hex-input[data-for="${input.id}"]`);if(hex)hex.value=value;
    paintBubbles();
  }

  function ensureHexEditors(){
    Object.keys(COLOR_MAP).forEach(id=>{
      const picker=document.querySelector("#"+id);if(!picker||picker.parentElement?.querySelector(`.theme-hex-input[data-for="${id}"]`))return;
      const hex=document.createElement("input");
      hex.type="text";hex.inputMode="text";hex.autocapitalize="off";hex.spellcheck=false;
      hex.className="theme-hex-input";hex.dataset.for=id;hex.maxLength=7;hex.value=normalize(picker.value)||"#000000";hex.placeholder="#RRGGBB";
      picker.parentElement.insertBefore(hex,picker);
    });
  }

  function closePanelOnly(){document.querySelector("#panel")?.classList.remove("open");document.querySelector("#scrim")?.classList.remove("show")}
  function openSidebarOnly(){document.querySelector("#panel")?.classList.remove("open");document.querySelector("#sidebar")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show")}

  document.addEventListener("input",e=>{
    if(COLOR_MAP[e.target.id])applyPicker(e.target);
    if(e.target.classList?.contains("theme-hex-input")){
      const value=normalize(e.target.value);if(!value)return;
      const picker=document.querySelector("#"+e.target.dataset.for);if(!picker)return;
      picker.value=value;picker.dispatchEvent(new Event("input",{bubbles:true}));
    }
  },true);
  document.addEventListener("change",e=>{if(COLOR_MAP[e.target.id])applyPicker(e.target)},true);

  document.addEventListener("click",e=>{
    if(e.target.closest?.("#menuBtn")){e.preventDefault();e.stopImmediatePropagation();openSidebarOnly();return}
    const nav=e.target.closest?.("#sidebar [data-panel]");
    if(nav){e.preventDefault();e.stopImmediatePropagation();document.querySelector("#sidebar")?.classList.remove("open");openPanel(nav.dataset.panel);requestAnimationFrame(()=>{ensureHexEditors();paintBubbles()});return}
    if(e.target.closest?.("#closePanel")){e.preventDefault();e.stopImmediatePropagation();closePanelOnly();return}
  },true);

  const panelBody=document.querySelector("#panelBody");
  if(panelBody)new MutationObserver(()=>requestAnimationFrame(ensureHexEditors)).observe(panelBody,{childList:true,subtree:true});
  const messages=document.querySelector("#messages");
  if(messages)new MutationObserver(()=>requestAnimationFrame(paintBubbles)).observe(messages,{childList:true,subtree:true});
  new MutationObserver(()=>requestAnimationFrame(paintBubbles)).observe(root,{attributes:true,attributeFilter:["data-theme-mode"]});

  ensureHexEditors();paintBubbles();
})();
