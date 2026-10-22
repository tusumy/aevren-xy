/* 砚屿 · optional glass recipes; keeps existing theme/bubble settings intact.
   Visual approach inspired by wave2234/liquid-glass-recipes (MIT). */
(()=>{
  "use strict";
  const KEY="xy.glass.recipe.v1";
  const FINISHES=["off","clear","frost","liquid"];
  const DEFAULTS={
    off:{finish:"off",veil:20,blur:14,refraction:26},
    clear:{finish:"clear",veil:22,blur:14,refraction:26},
    frost:{finish:"frost",veil:52,blur:22,refraction:26},
    liquid:{finish:"liquid",veil:15,blur:3,refraction:26}
  };
  const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Math.round(Number(n)))):fallback;
  function normalize(value){
    const finish=FINISHES.includes(value?.finish)?value.finish:"off";
    const d=DEFAULTS[finish];
    return {
      finish,
      veil:clamp(value?.veil,10,80,d.veil),
      blur:clamp(value?.blur,0,28,d.blur),
      refraction:clamp(value?.refraction,0,40,d.refraction)
    };
  }
  function read(){
    try{return normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return {...DEFAULTS.off}}
  }
  let state=read();
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
  }
  function ensureLens(){
    if(document.getElementById("xy-glass-lens-svg"))return;
    const NS="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(NS,"svg");
    svg.id="xy-glass-lens-svg";
    svg.setAttribute("width","0");svg.setAttribute("height","0");
    svg.setAttribute("aria-hidden","true");
    svg.style.cssText="position:absolute;left:0;top:0;overflow:hidden;pointer-events:none";
    const defs=document.createElementNS(NS,"defs");
    const filter=document.createElementNS(NS,"filter");
    filter.id="xy-glass-lens";
    filter.setAttribute("x","-20%");filter.setAttribute("y","-20%");
    filter.setAttribute("width","140%");filter.setAttribute("height","140%");
    filter.setAttribute("color-interpolation-filters","sRGB");
    const noise=document.createElementNS(NS,"feTurbulence");
    noise.setAttribute("type","fractalNoise");
    noise.setAttribute("baseFrequency","0.009 0.015");
    noise.setAttribute("numOctaves","2");
    noise.setAttribute("seed","7");
    noise.setAttribute("result","n");
    const map=document.createElementNS(NS,"feDisplacementMap");
    map.id="xy-glass-displace";
    map.setAttribute("in","SourceGraphic");
    map.setAttribute("in2","n");
    map.setAttribute("scale","26");
    map.setAttribute("xChannelSelector","R");
    map.setAttribute("yChannelSelector","G");
    filter.append(noise,map);defs.append(filter);svg.append(defs);
    document.body.prepend(svg);
  }
  function apply(){
    const root=document.documentElement;
    root.dataset.xyGlass=state.finish;
    root.style.setProperty("--xy-glass-veil",(state.veil/100).toFixed(2));
    root.style.setProperty("--xy-glass-blur",state.blur+"px");
    document.getElementById("xy-glass-displace")?.setAttribute("scale",String(state.refraction));
  }
  function saveAndApply(){persist();apply()}
  const OPTIONS=[["off","原版"],["clear","毛玻璃"],["frost","磨砂"],["liquid","液态"]];
  function decorate(){
    const body=document.getElementById("panelBody");
    if(!body||!body.querySelector("#themeBubbleGlass")||body.querySelector(".xy-glass-card"))return;
    const card=document.createElement("section");
    card.className="theme-setting-card xy-glass-card";
    card.setAttribute("aria-label","玻璃材质设置");
    card.innerHTML=[
      '<p class="xy-glass-title">玻璃材质</p>',
      '<p class="xy-glass-caption">只改变顶栏、输入框和工具入口的质感，不改变聊天气泡皮肤。</p>',
      '<div class="xy-glass-choices" role="group" aria-label="玻璃材质">',
      OPTIONS.map(([id,label])=>'<button type="button" class="xy-glass-choice" data-xy-glass-finish="'+id+'" aria-pressed="false"><span class="xy-glass-thumb" aria-hidden="true"></span>'+label+'</button>').join(""),
      '</div>',
      '<div class="xy-glass-tuning">',
        '<label><span class="xy-glass-range-label"><span>玻璃底色浓度</span><b id="xyGlassVeilValue"></b></span><input type="range" min="10" max="80" step="1" data-xy-glass-param="veil" aria-label="玻璃底色浓度"></label>',
        '<label><span class="xy-glass-range-label"><span>背景模糊</span><b id="xyGlassBlurValue"></b></span><input type="range" min="0" max="28" step="1" data-xy-glass-param="blur" aria-label="玻璃模糊像素"></label>',
        '<label data-liquid-only><span class="xy-glass-range-label"><span>折射强度</span><b id="xyGlassRefractionValue"></b></span><input type="range" min="0" max="40" step="1" data-xy-glass-param="refraction" aria-label="液态玻璃折射强度"></label>',
      '</div>',
      '<p class="xy-glass-footnote">液态折射在有纹理的壁纸上更明显；不支持 SVG 背景滤镜的浏览器会回退到柔和玻璃。</p>'
    ].join("");
    const before=body.querySelector(".xy-bubble-skin-section");
    if(before)before.before(card);else body.append(card);
    syncCard(card);
  }
  function syncCard(card){
    if(!card)return;
    card.querySelectorAll("[data-xy-glass-finish]").forEach(button=>{
      button.setAttribute("aria-pressed",String(button.dataset.xyGlassFinish===state.finish));
    });
    const tunings=card.querySelector(".xy-glass-tuning");
    if(tunings)tunings.setAttribute("aria-disabled",String(state.finish==="off"));
    card.querySelectorAll("[data-xy-glass-param]").forEach(input=>{
      const key=input.dataset.xyGlassParam;
      input.value=String(state[key]);
      input.disabled=state.finish==="off";
    });
    const only=card.querySelector("[data-liquid-only]");
    if(only)only.hidden=state.finish!=="liquid";
    const veil=card.querySelector("#xyGlassVeilValue");
    const blur=card.querySelector("#xyGlassBlurValue");
    const refract=card.querySelector("#xyGlassRefractionValue");
    if(veil)veil.textContent=state.veil+"%";
    if(blur)blur.textContent=state.blur+"px";
    if(refract)refract.textContent=String(state.refraction);
  }
  ensureLens();apply();
  const body=document.getElementById("panelBody");
  if(!body)return;
  body.addEventListener("click",event=>{
    if(event.target.closest("#resetTheme")){
      state={...DEFAULTS.off};saveAndApply();
      return;
    }
    const button=event.target.closest("[data-xy-glass-finish]");
    if(!button||!body.contains(button))return;
    const finish=button.dataset.xyGlassFinish;
    if(!FINISHES.includes(finish))return;
    state={...DEFAULTS[finish]};
    saveAndApply();syncCard(body.querySelector(".xy-glass-card"));
  },true);
  body.addEventListener("input",event=>{
    const input=event.target.closest("[data-xy-glass-param]");
    if(!input||state.finish==="off")return;
    const param=input.dataset.xyGlassParam;
    const bounds={veil:[10,80],blur:[0,28],refraction:[0,40]}[param];
    if(!bounds)return;
    state[param]=clamp(input.value,...bounds,state[param]);
    saveAndApply();syncCard(body.querySelector(".xy-glass-card"));
  });
  const observer=new MutationObserver(decorate);
  observer.observe(body,{childList:true});
  decorate();
})();