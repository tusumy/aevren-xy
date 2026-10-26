/* 砚屿 · 主题设置折叠层。
   Works on existing controls *and* cards added later by material/HTML/bubble plugins.
   Keep the original card nodes, handlers, sliders and storage untouched. */
(()=>{
 "use strict";
 const body=document.getElementById("panelBody");
 if(!body)return;
 const KEY="xy.theme.sections.expanded.v1";
 const expanded=(()=>{
   try{
     const saved=JSON.parse(localStorage.getItem(KEY)||"{}");
     return saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{};
   }catch{return {}}
 })();
 const remember=(key,open)=>{
   expanded[key]=Boolean(open);
   try{localStorage.setItem(KEY,JSON.stringify(expanded))}catch{}
 };
 const savedOpen=(key,fallback=false)=>typeof expanded[key]==="boolean"?expanded[key]:fallback;

 // Each group is identified by its actual settings, not by index; addon order can change.
 const GROUPS=[
   {key:"glass-app",title:"玻璃材质",matches:card=>card.matches(".xy-glass-card")},
   {key:"glass-html",title:"HTML / 状态卡片材质",matches:card=>card.matches(".xy-html-glass-settings")},
   {key:"bubble-skins",title:"聊天气泡皮肤",matches:card=>card.matches(".xy-bubble-skin-section")},
   {key:"glass-bubble",title:"气泡玻璃材质",matches:card=>card.matches(".xy-bubble-glass-card")},
   {key:"fine-colors",title:"气泡与背景颜色",matches:card=>!!card.querySelector("[data-color-row]")},
   {key:"bubble-layout",title:"气泡与文字设置",matches:card=>!!card.querySelector("#themeBubbleGlass")},
   {key:"wallpaper",title:"背景图片",matches:card=>!!card.querySelector("#themeBgUrl")},
   {key:"background-effects",title:"背景遮罩与模糊",matches:card=>!!card.querySelector("#themeOverlay")}
 ];
 function identify(card){
   const known=GROUPS.find(group=>group.matches(card));
   if(known)return known;
   const heading=card.querySelector("h2,h3,.xy-glass-title,.xy-bubble-glass-title,.xy-html-glass-heading,p");
   const title=(heading?.textContent||"其他外观设置").trim().slice(0,30);
   const key="extra-"+title.replace(/\s+/g,"-");
   return {key,title};
 }
 function foldCard(card){
   if(card.dataset.xyThemeSection)return;
   const {key,title}=identify(card);
   card.dataset.xyThemeSection=key;
   card.classList.add("xy-theme-section");
   const open=savedOpen(key,false);
   card.dataset.xyFolded=String(!open);
   const toggle=document.createElement("button");
   toggle.type="button";
   toggle.className="xy-theme-section-toggle";
   toggle.setAttribute("aria-label",title+"，点击展开或收起");
   toggle.setAttribute("aria-expanded",String(open));
   toggle.innerHTML='<span class="xy-theme-section-title"></span><span class="xy-theme-section-chevron" aria-hidden="true">⌄</span>';
   toggle.querySelector(".xy-theme-section-title").textContent=title;
   toggle.addEventListener("click",()=>{
     const next=card.dataset.xyFolded==="true";
     card.dataset.xyFolded=String(!next);
     toggle.setAttribute("aria-expanded",String(next));
     remember(key,next);
   });
   card.prepend(toggle);
 }
 function foldTop(selector,key,title,defaultOpen=true){
   const item=body.querySelector(selector);
   if(!item||item.closest(".xy-theme-top-details"))return;
   const detail=document.createElement("details");
   detail.className="xy-theme-top-details";
   detail.dataset.xyThemeGroup=key;
   detail.open=savedOpen(key,defaultOpen);
   const summary=document.createElement("summary");
   summary.textContent=title;
   item.before(detail);
   detail.append(summary,item);
   detail.addEventListener("toggle",()=>remember(key,detail.open));
 }
 function foldBasics(){
   const basic=body.querySelector(".xy-theme-basics");
   if(!basic||basic.dataset.xyThemeFoldReady)return;
   basic.dataset.xyThemeFoldReady="1";
   basic.open=savedOpen("basic-colors",false);
   basic.addEventListener("toggle",()=>remember("basic-colors",basic.open));
 }
 function decorate(){
   // Avoid accidentally modifying another panel or chat content.
   if(!body.querySelector("#themeBubbleGlass"))return;
   foldTop(".theme-mode-switch","color-mode","明暗模式",true);
   foldTop(".xy-theme-curated","theme-palette","精选主题",true);
   foldBasics();
   body.querySelectorAll(".theme-setting-card:not([data-xy-theme-section])").forEach(foldCard);
 }
 // Dynamic material cards arrive via different observers, sometimes after the theme panel is rendered.
 let scanning=false;
 const onChange=()=>{
   if(scanning)return;
   scanning=true;
   try{decorate()}finally{scanning=false}
 };
 new MutationObserver(onChange).observe(body,{childList:true,subtree:true});
 onChange();
})();