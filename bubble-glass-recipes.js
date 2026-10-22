/* 砚屿 · optional glass for message bubbles.
   Separate from the app chrome glass settings and the legacy bubble-glass toggle.
   Based on visual techniques from wave2234/liquid-glass-recipes (MIT). */
(()=>{
  "use strict";
  const KEY="xy.bubble.glass.recipe.v1";
  const RECIPES={
    off:{finish:"off",veil:52,blur:14,refraction:22},
    clear:{finish:"clear",veil:58,blur:14,refraction:22},
    frost:{finish:"frost",veil:78,blur:21,refraction:22},
    liquid:{finish:"liquid",veil:36,blur:3,refraction:22}
  };
  const OPTIONS=[["off","沿用原设置"],["clear","毛玻璃"],["frost","磨砂"],["liquid","液态"]];
  const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Math.round(Number(n)))):fallback;
  function normalize(saved){
    const finish=Object.hasOwn(RECIPES,saved?.finish)?saved.finish:"off";
    const preset=RECIPES[finish];
    return {
      finish,
      veil:clamp(saved?.veil,30,90,preset.veil),
      blur:clamp(saved?.blur,0,28,preset.blur),
      refraction:clamp(saved?.refraction,0,40,preset.refraction)
    };
  }
  function read(){
    try{return normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}
    catch{return {...RECIPES.off}}
  }
  let state=read();
  function ensureLens(){
    if(document.getElementById("xy-bubble-glass-lens-svg"))return;
    const ns="http://www.w3.org/2000/svg";
    const el=(tag,attrs)=>{
      const node=document.createElementNS(ns,tag);
      Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));
      return node;
    };
    const svg=el("svg",{
      id:"xy-bubble-glass-lens-svg",width:"0",height:"0","aria-hidden":"true"
    });
    svg.style.cssText="position:absolute;left:0;top:0;overflow:hidden;pointer-events:none";
    const defs=el("defs",{});
    const filter=el("filter",{
      id:"xy-bubble-glass-lens",x:"-20%",y:"-20%",width:"140%",height:"140%",
      "color-interpolation-filters":"sRGB"
    });
    const noise=el("feTurbulence",{
      type:"fractalNoise",baseFrequency:"0.009 0.015",numOctaves:"2",seed:"11",result:"n"
    });
    const map=el("feDisplacementMap",{
      id:"xy-bubble-glass-displace",in:"SourceGraphic",in2:"n",scale:"22",
      xChannelSelector:"R",yChannelSelector:"G"
    });
    filter.append(noise,map);defs.append(filter);svg.append(defs);
    document.body.prepend(svg);
  }
  function apply(){
    const root=document.documentElement;
    root.dataset.xyBubbleFinish=state.finish;
    root.style.setProperty("--xy-bubble-veil",state.veil+"%");
    root.style.setProperty("--xy-bubble-dark-veil",Math.max(78,state.veil)+"%");
    root.style.setProperty("--xy-bubble-blur",state.blur+"px");
    document.getElementById("xy-bubble-glass-displace")?.setAttribute("scale",String(state.refraction));
  }
  function saveAndApply(){
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
    apply();
  }
  function cardMarkup(){
    return [
      '<p class="xy-bubble-glass-title">气泡玻璃材质</p>',
      '<p class="xy-bubble-glass-subtitle">和外壳玻璃分开设置。保留你的气泡颜色、小熊／小猫和漫画轮廓。</p>',
      '<div class="xy-bubble-glass-options" role="group" aria-label="气泡玻璃材质">',
      OPTIONS.map(([id,name])=>
        '<button class="xy-bubble-glass-option" type="button" data-xy-bubble-glass-finish="'+id+'" aria-pressed="false">'+
        '<span class="xy-bubble-glass-preview" aria-hidden="true"></span>'+name+'</button>'
      ).join(""),
      '</div>',
      '<div class="xy-bubble-glass-tuning">',
      '<label><span class="xy-bubble-glass-range-label"><span>底色浓度</span><b data-xy-bubble-value="veil"></b></span><input aria-label="气泡底色浓度" type="range" min="30" max="90" step="1" data-xy-bubble-param="veil"></label>',
      '<label><span class="xy-bubble-glass-range-label"><span>模糊程度</span><b data-xy-bubble-value="blur"></b></span><input aria-label="气泡玻璃模糊程度" type="range" min="0" max="28" step="1" data-xy-bubble-param="blur"></label>',
      '<label data-bubble-liquid-only><span class="xy-bubble-glass-range-label"><span>折射强度</span><b data-xy-bubble-value="refraction"></b></span><input aria-label="气泡折射强度" type="range" min="0" max="40" step="1" data-xy-bubble-param="refraction"></label>',
      '</div>',
      '<p class="xy-bubble-glass-footnote">“沿用原设置”继续使用下方的气泡磨砂开关。玻璃滤镜仅对可见消息启用，减少长聊天记录滚动卡顿。</p>'
    ].join("");
  }
  function syncCard(card){
    if(!card)return;
    card.querySelectorAll("[data-xy-bubble-glass-finish]").forEach(button=>
      button.setAttribute("aria-pressed",String(button.dataset.xyBubbleGlassFinish===state.finish)));
    const controls=card.querySelector(".xy-bubble-glass-tuning");
    if(controls)controls.setAttribute("aria-disabled",String(state.finish==="off"));
    card.querySelectorAll("[data-xy-bubble-param]").forEach(input=>{
      input.value=String(state[input.dataset.xyBubbleParam]);
      input.disabled=state.finish==="off";
    });
    const liquid=card.querySelector("[data-bubble-liquid-only]");
    if(liquid)liquid.hidden=state.finish!=="liquid";
    card.querySelectorAll("[data-xy-bubble-value]").forEach(label=>{
      const key=label.dataset.xyBubbleValue;
      label.textContent=state[key]+(key==="veil"?"%":key==="blur"?"px":"");
    });
  }
  function decorate(){
    const body=document.getElementById("panelBody");
    if(!body||!body.querySelector("#themeBubbleGlass")||body.querySelector(".xy-bubble-glass-card"))return;
    const card=document.createElement("section");
    card.className="theme-setting-card xy-bubble-glass-card";
    card.setAttribute("aria-label","气泡玻璃材质设置");
    card.innerHTML=cardMarkup();
    const skin=body.querySelector(".xy-bubble-skin-section");
    if(skin)skin.after(card);
    else body.querySelector("#themeBubbleGlass")?.closest(".theme-setting-card")?.before(card);
    syncCard(card);
  }

  /* Glass backdrop filters on long chat lists are expensive.
     Only the bubbles intersecting the scroll viewport activate the filter. */
  function watchVisibleMessages(){
    const scroller=document.getElementById("messages");
    if(!scroller)return;
    const seen=new WeakSet();
    let observer=null;
    if(typeof IntersectionObserver==="function"){
      observer=new IntersectionObserver(entries=>{
        for(const e of entries)e.target.classList.toggle("xy-bubble-glass-visible",e.isIntersecting);
      },{root:scroller,rootMargin:"120px 0px 120px 0px",threshold:0});
    }
    const scan=()=>{
      scroller.querySelectorAll(".message .bubble").forEach(bubble=>{
        if(seen.has(bubble))return;
        seen.add(bubble);
        if(observer)observer.observe(bubble);
        else bubble.classList.add("xy-bubble-glass-visible");
      });
    };
    let pending=false;
    const schedule=()=>{
      if(pending)return;
      pending=true;
      requestAnimationFrame(()=>{pending=false;scan()});
    };
    new MutationObserver(schedule).observe(scroller,{childList:true,subtree:true});
    scan();
  }

  ensureLens();
  apply();
  watchVisibleMessages();
  const panel=document.getElementById("panelBody");
  if(!panel)return;
  panel.addEventListener("click",event=>{
    if(event.target.closest("#resetTheme")){
      state={...RECIPES.off};
      saveAndApply();
      return;
    }
    const choice=event.target.closest("[data-xy-bubble-glass-finish]");
    if(!choice||!panel.contains(choice))return;
    const finish=choice.dataset.xyBubbleGlassFinish;
    if(!Object.hasOwn(RECIPES,finish))return;
    state={...RECIPES[finish]};
    saveAndApply();
    syncCard(panel.querySelector(".xy-bubble-glass-card"));
  },true);
  panel.addEventListener("input",event=>{
    const input=event.target.closest("[data-xy-bubble-param]");
    if(!input||state.finish==="off")return;
    const field=input.dataset.xyBubbleParam;
    const bounds={veil:[30,90],blur:[0,28],refraction:[0,40]}[field];
    if(!bounds)return;
    state[field]=clamp(input.value,bounds[0],bounds[1],state[field]);
    saveAndApply();
    syncCard(panel.querySelector(".xy-bubble-glass-card"));
  });
  new MutationObserver(decorate).observe(panel,{childList:true});
  decorate();
})();
