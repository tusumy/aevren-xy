/* User-controlled HTML/status-card finish: never inherit message bubble material. */
(()=>{
"use strict";
const KEY="xy.html.card.appearance.v1";
const modes=["off","clear","frost","liquid"];
const presets={off:{finish:"off",blur:0,opacity:45},clear:{finish:"clear",blur:6,opacity:25},frost:{finish:"frost",blur:14,opacity:45},liquid:{finish:"liquid",blur:2,opacity:20}};
const limit=(v,a,b,f)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Math.round(Number(v)))):f;
const normalize=x=>{const mode=modes.includes(x?.finish)?x.finish:"off";return {finish:mode,blur:limit(x?.blur,0,24,presets[mode].blur),opacity:limit(x?.opacity,0,90,presets[mode].opacity)}};
let state;
try{state=normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{state={...presets.off}}
function apply(){
 const root=document.documentElement;
 root.dataset.xyCardGlass=state.finish;
 root.style.setProperty("--xy-card-surface-blur",state.blur+"px");
 root.style.setProperty("--xy-card-surface-alpha",(state.opacity/100).toFixed(2));
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}apply()}
const panel=document.getElementById("panelBody");
function render(){
 if(!panel||!panel.querySelector("#themeBubbleGlass"))return;
 let card=panel.querySelector(".xy-html-glass-settings");
 if(!card){
  card=document.createElement("section");
  card.className="theme-setting-card xy-html-glass-settings";
  card.innerHTML='<p class="xy-html-glass-heading">HTML / 状态卡片材质</p>'+
   '<p class="xy-html-glass-description">只影响卡片外壳与状态卡封面，不修改卡片里的 HTML、文字和聊天背景。</p>'+
   '<div class="xy-html-glass-options" role="group" aria-label="卡片玻璃材质">'+
   modes.map((m,i)=>'<button type="button" data-card-finish="'+m+'" aria-pressed="false">'+["原样","透明","磨砂","液态"][i]+'</button>').join("")+'</div>'+
   '<div class="xy-html-glass-tuning">'+
   '<label>背景模糊 <b data-card-number="blur"></b><input type="range" min="0" max="24" step="1" data-card-value="blur"></label>'+
   '<label>底色浓度 <b data-card-number="opacity"></b><input type="range" min="0" max="90" step="1" data-card-value="opacity"></label></div>';
  const after=panel.querySelector(".xy-glass-card");
  if(after)after.after(card);else panel.append(card);
 }
 card.querySelectorAll("[data-card-finish]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.cardFinish===state.finish)));
 card.querySelectorAll("[data-card-value]").forEach(input=>{
  const key=input.dataset.cardValue;input.value=String(state[key]);input.disabled=state.finish==="off";
  const n=card.querySelector('[data-card-number="'+key+'"]');if(n)n.textContent=state[key]+(key==="blur"?"px":"%");
 });
 card.querySelector(".xy-html-glass-tuning")?.classList.toggle("is-disabled",state.finish==="off");
}
if(panel){
 panel.addEventListener("click",event=>{
  if(event.target.closest("#resetTheme")){state={...presets.off};save();render();return}
  const btn=event.target.closest("[data-card-finish]");
  if(!btn||!panel.contains(btn))return;
  const mode=btn.dataset.cardFinish;if(!modes.includes(mode))return;
  state={...presets[mode]};save();render();
 });
 panel.addEventListener("input",event=>{
  const input=event.target.closest("[data-card-value]");
  if(!input||state.finish==="off")return;
  const key=input.dataset.cardValue;
  if(!["blur","opacity"].includes(key))return;
  state[key]=limit(input.value,0,key==="blur"?24:90,state[key]);save();render();
 });
 new MutationObserver(render).observe(panel,{childList:true});
}
apply();render();
})();