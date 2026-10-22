/* 砚屿：桌面两侧入口 + 每个地点自己的风景卡，不改动已有功能页的数据。 */
(()=>{
"use strict";
const home=document.querySelector("#xyIslandHome"),world=home?.querySelector("#xyIslandWorld");
if(!home||!world||window.xyIslandLocations)return;
const places=[
 {id:"home",name:"海边小屋",subtitle:"聊天 · 我们的日常",icon:"⌂",type:"chat",x:196,y:721},
 {id:"garden",name:"小岛",subtitle:"动态 · 农场 · 活动",icon:"❀",type:"chat",x:288,y:988},
 {id:"journal",name:"临海亭",subtitle:"日记 · 回忆",icon:"✎",type:"journal",x:896,y:1120},
 {id:"lighthouse",name:"灯塔",subtitle:"工具 · MCP · API",icon:"♧",type:"toolhub",x:855,y:473},
 {id:"study",name:"藏书阁",subtitle:"角色 · 书房 · 记忆",icon:"▤",type:"study",x:725,y:654},
 {id:"atelier",name:"画室",subtitle:"生图 · 画册",icon:"✧",type:"imagine",x:865,y:902},
 {id:"characters",name:"角色",subtitle:"角色与书房",icon:"◉",type:"study",x:335,y:1447},
 {id:"mine",name:"我的",subtitle:"个人设置",icon:"⚙",type:"settings",x:900,y:1447}
];
function img(){return typeof window.xyIslandPaintingData==="string"?window.xyIslandPaintingData:""}
const copy={
 chat:{name:"海边小屋",subtitle:"临海灯火 · 聊聊我们的日常",x:196,y:721},
 toolhub:{name:"云崖灯塔",subtitle:"海上灯塔 · 所有工具的入口",x:855,y:473},
 study:{name:"藏书阁",subtitle:"山间楼阁 · 角色与书房",x:725,y:654},
 journal:{name:"临海亭",subtitle:"听潮写字 · 日记与回忆",x:896,y:1120},
 imagine:{name:"画室",subtitle:"樱花水岸 · 绘画与画册",x:865,y:902},
 settings:{name:"岛务所",subtitle:"我的设置",x:900,y:1447},
 characters:{name:"藏书阁",subtitle:"角色与书房",x:725,y:654}
};
const data={};
for(const p of places)data[p.id]=p;
const navs=[{side:"left",headline:"云海尽头",caption:"走进砚屿的日常",ids:["home","garden","journal"]},
 {side:"right",headline:"岛屿漫游",caption:"每个角落都有故事",ids:["lighthouse","study","atelier"]}];
for(const n of navs){
 const aside=document.createElement("nav");
 aside.className="xy-island-desktop-dock";
 aside.dataset.side=n.side;
 aside.setAttribute("aria-label",n.headline);
 const title=document.createElement("div");title.className="xy-island-dock-title";title.textContent=n.headline;
 const note=document.createElement("p");note.className="xy-island-dock-intro";note.textContent=n.caption;
 aside.append(title,note);
 for(const id of n.ids){
  const p=data[id],btn=document.createElement("button");btn.type="button";btn.className="xy-island-dock-card";
  btn.innerHTML='<span class="xy-island-dock-symbol" aria-hidden="true">'+p.icon+'</span>'+
   '<span class="xy-island-dock-label"><strong>'+p.name+'</strong><small>'+p.subtitle+'</small></span>';
  btn.addEventListener("click",()=>home.querySelector('.xy-island-entry[data-place="'+id+'"]')?.click());
  aside.appendChild(btn);
 }
 world.appendChild(aside);
}
const arrows=document.createElement("nav");
arrows.className="xy-island-mobile-arrows";
arrows.setAttribute("aria-label","移动岛屿画面");
for(const [side,direction] of [["left",-1],["right",1]]){
 const b=document.createElement("button");b.type="button";b.className="xy-island-side-arrow";
 b.dataset.side=side;b.setAttribute("aria-label",side==="left"?"向左探索":"向右探索");
 b.textContent=side==="left"?"‹":"›";
 b.addEventListener("click",()=>window.xyIslandHome?.panBy?.(-direction*110));
 arrows.appendChild(b);
}
world.appendChild(arrows);
function clear(){
 const panel=document.querySelector("#panel"),main=document.querySelector(".main");
 panel?.classList.remove("xy-island-location-panel");
 panel?.querySelector(".xy-island-room-banner")?.remove();
 main?.classList.remove("xy-island-location-chat");
 main?.querySelector(".xy-island-chat-marker")?.remove();
}
function show(type,place){
 clear();
 const p=copy[type]||copy[place?.type];
 if(!p)return;
 const chosen=place?.id&&data[place.id]&&data[place.id].type===type?data[place.id]:p;
 const source=img();
 if(!source)return;
 const fx=Math.round(chosen.x/1024*100),fy=Math.round(chosen.y/1536*100);
 const panel=document.querySelector("#panel"),main=document.querySelector(".main");
 const target=type==="chat"?main:panel;if(!target)return;
 target.style.setProperty("--xy-island-room-image",'url("'+source+'")');
 target.style.setProperty("--xy-room-focus-x",fx+"%");
 target.style.setProperty("--xy-room-focus-y",fy+"%");
 if(type==="chat"){
  main.classList.add("xy-island-location-chat");
  const badge=document.createElement("span");badge.className="xy-island-chat-marker";
  badge.textContent="⌂  海边小屋 · "+chosen.subtitle;
  main.appendChild(badge);
 }else{
  panel.classList.add("xy-island-location-panel");
  const banner=document.createElement("div");
  banner.className="xy-island-room-banner";
  banner.setAttribute("role","img");
  banner.setAttribute("aria-label",chosen.name+"附近的岛屿风景");
  const title=document.createElement("strong");title.textContent=chosen.name;
  const small=document.createElement("small");small.textContent=chosen.subtitle;
  banner.append(title,small);
  const panelHead=panel.querySelector(".panel-head");
  if(panelHead)panel.insertBefore(banner,panelHead);
  else panel.prepend(banner);
 }
}
window.xyIslandLocations={show,clear};
})();