/* 砚屿：青苹果珍珠玻璃首页。仅替换原岛屿导航层，不迁移聊天、书房或创作数据。 */
(()=>{
"use strict";
if(document.getElementById("xyIslandHome"))return;

const originalApp=document.querySelector(".app");
const originalInert=Boolean(originalApp?.inert);
let fromHome=false;
const NAV_ROOT="xyIslandRoot";
const allowed=new Set(["chat","study","imagine","creation","groupchat","journal","toolhub","settings","voice","theme","memory"]);
const cards=[
  {label:"书房",description:"人物与角色卡",icon:"book",route:"study"},
  {label:"生图",description:"灵感画室",icon:"image",route:"imagine"},
  {label:"创作角",description:"故事与设定",icon:"folder",route:"creation"},
  {label:"群聊",description:"一起讲故事",icon:"group",route:"groupchat"}
];
const icons={
  heart:'<path d="M20.8 5.9a4.7 4.7 0 0 0-6.7 0L12 8 9.9 5.9a4.7 4.7 0 1 0-6.7 6.7L12 21l8.8-8.4a4.7 4.7 0 0 0 0-6.7Z"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="m10 2.7-.6 2.1-2.1.9-1.9-1.1-2.7 2.7 1.1 1.9-.9 2.1-2.1.6v3.8l2.1.6.9 2.1-1.1 1.9 2.7 2.7 1.9-1.1 2.1.9.6 2.1h3.8l.6-2.1 2.1-.9 1.9 1.1 2.7-2.7-1.1-1.9.9-2.1 2.1-.6v-3.8l-2.1-.6-.9-2.1 1.1-1.9-2.7-2.7-1.9 1.1-2.1-.9-.6-2.1Z" transform="translate(1 -1) scale(.92)"/>',
  mic:'<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 10.6a6.5 6.5 0 0 0 13 0M12 17v4M8.4 21h7.2"/>',
  chat:'<path d="M20.2 11.5a8.3 8.3 0 0 1-8.7 8.2 9.3 9.3 0 0 1-3.4-.7l-4.5 1.4 1.3-4.3a8.3 8.3 0 1 1 15.3-4.6Z"/><path d="M8.2 11.3h7.6M8.2 14.2h5.2"/>',
  book:'<path d="M12 20.2c-2.7-2.1-5.4-2.7-9-1.8V4.8c3.8-1.1 6.4-.4 9 1.7 2.6-2.1 5.2-2.8 9-1.7v13.6c-3.6-.9-6.3-.3-9 1.8ZM12 6.5v13.7"/><path d="M5.6 9.2c1.5-.2 2.8.1 4 .7M14.5 9.9c1.2-.6 2.5-.9 4-.7"/>',
  image:'<rect x="2.5" y="3.5" width="19" height="17" rx="3"/><circle cx="8" cy="9" r="1.6"/><path d="m4.5 17.1 5-5 3.4 3.3 3.4-4.1 3.4 5.8"/>',
  phone:'<path d="M7.6 3.6 10 7.4 8 9.5c1.2 2.8 3.2 4.8 6 6l2.1-2 3.8 2.4-.7 3.5c-.2.9-1 1.5-1.9 1.5C9.7 20.7 3.3 14.3 3.1 6.4c0-.9.6-1.7 1.5-1.9Z"/><path d="M14.4 4a6 6 0 0 1 5.6 5.6M14.2 7.6a2.5 2.5 0 0 1 2.3 2.3"/>',
  folder:'<path d="M3.2 7.2A2.3 2.3 0 0 1 5.5 5h5l2 2.2h6A2.3 2.3 0 0 1 20.8 9v9a2.3 2.3 0 0 1-2.3 2.3h-13a2.3 2.3 0 0 1-2.3-2.3Z"/><path d="m12 17-2.3-2.1a1.7 1.7 0 0 1 2.3-2.5 1.7 1.7 0 0 1 2.3 2.5Z"/>',
  group:'<circle cx="12" cy="8" r="3.1"/><path d="M5.7 19v-2.4a6.3 6.3 0 0 1 12.6 0V19ZM4.6 8.9a2.6 2.6 0 1 0 0 5.2M19.4 8.9a2.6 2.6 0 1 1 0 5.2M3.1 19v-2M20.9 19v-2"/>',
  journal:'<rect x="5.5" y="3.4" width="13" height="17" rx="2"/><path d="M9 2.5v3M15 2.5v3M8.6 10h6.8M8.6 13.4h6.8M8.6 16.8h4.4"/>',
  home:'<path d="m3.5 10 8.5-7 8.5 7v9.7c0 .8-.6 1.4-1.4 1.4H4.9c-.8 0-1.4-.6-1.4-1.4Z"/><path d="M9 21v-7h6v7"/>',
  toolbox:'<rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3M3 12h18M10 11.9v2.1h4v-2.1"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 20.3a8 8 0 0 1 16 0"/>',
  arrow:'<path d="m9 5 7 7-7 7"/>'
};
const svg=(type,cls="")=>'<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[type]||icons.heart)+'</svg>';

const root=document.createElement("section");
root.id="xyIslandHome";
root.className="xy-pearl-home";
root.setAttribute("aria-label","砚屿 · 首页");
const cardMarkup=cards.map(item=>
 '<button type="button" class="xy-pearl-tile" data-xy-home-route="'+item.route+'" aria-label="'+item.label+'">'+
 '<span class="xy-pearl-glyph">'+svg(item.icon)+'</span>'+
 '<span class="xy-pearl-card-text"><strong>'+item.label+'</strong><small>'+item.description+'</small></span>'+
 '<span class="xy-pearl-card-arrow" aria-hidden="true">↗</span></button>'
).join("");
const tabs=[
 {label:"首页",icon:"home",route:"home"},
 {label:"对话",icon:"chat",route:"chat"},
 {label:"工具",icon:"toolbox",route:"toolhub"},
 {label:"收藏",icon:"heart",route:"favorites"},
 {label:"我",icon:"user",route:"settings"}
];
const tabMarkup=tabs.map(item=>
 '<button type="button" class="xy-pearl-tab'+(item.route==="home"?' is-active':'')+'" data-xy-home-route="'+item.route+'" aria-label="'+item.label+'"'+(item.route==="home"?' aria-current="page"':'')+'>'+
 '<span class="xy-pearl-tab-icon">'+svg(item.icon)+'</span><span>'+item.label+'</span></button>'
).join("");
root.innerHTML=
 '<div class="xy-pearl-ambient" aria-hidden="true"></div>'+
 '<div class="xy-pearl-shell">'+
 '<div class="xy-pearl-scroll" id="xyPearlScroll">'+
 '<div class="xy-pearl-topline">AEVREN XY / ONLY OURS</div>'+
 '<section class="xy-pearl-hero">'+
 '<span class="xy-pearl-hero-decor" aria-hidden="true">♡</span>'+
 '<div class="xy-pearl-micro">OUR LITTLE CORNER</div>'+
 '<h1><span id="xyPearlName">阿毛</span>，今天想聊些什么？</h1>'+
 '<p>好久不见，今天也有好多话想和你说。</p></section>'+
 '<div class="xy-pearl-actions">'+
 '<button type="button" class="xy-pearl-primary" data-xy-home-route="chat" aria-label="继续我们的对话">'+
 '<span><strong>继续我们的对话</strong><small>Pick up where we left off</small></span>'+
 '<span class="xy-pearl-action-arrow" aria-hidden="true">→</span></button>'+
 '<button type="button" class="xy-pearl-secondary" data-xy-home-route="call" aria-label="语音通话">'+svg("phone")+'<span>语音</span></button></div>'+
 '<section class="xy-pearl-spaces" aria-labelledby="xySpacesHeading">'+
 '<div class="xy-pearl-sectionbar"><h2 id="xySpacesHeading">我们的空间</h2>'+
 '<button type="button" data-xy-home-route="toolhub" class="xy-pearl-explore">Keep exploring　↗</button></div>'+
 '<div class="xy-pearl-grid">'+cardMarkup+'</div>'+
 '</section>'+
 '<button class="xy-pearl-moment" type="button" data-xy-home-route="journal" aria-label="打开我的记录">'+
 '<span class="xy-pearl-moment-symbol" aria-hidden="true">✳</span>'+
 '<span><strong>今天也有好多话想跟你说</strong><small>Just another little moment, ours.</small></span>'+
 '<span class="xy-pearl-moment-heart" aria-hidden="true">♡</span></button>'+
 '</div>'+
 '<nav class="xy-pearl-bottom" aria-label="首页导航">'+tabMarkup+'</nav></div>';
document.body.appendChild(root);
function syncName(){
  const value=window.xyTavernMacros?.name?.();
  const name=typeof value==="string"&&value.trim()&&value.trim()!=="你"?value.trim():"阿毛";
  const label=root.querySelector("#xyPearlName");if(label)label.textContent=name;
}
syncName();
window.addEventListener("xy-user-profile-change",syncName);


function ensureHomeRoot(){
 const h=history.state||{};
 if(h[NAV_ROOT]&&!h.xyOverlay&&!h.xyHubChild&&!h.xyIslandPage)return;
 history.replaceState({...h,[NAV_ROOT]:true,xyOverlay:false,xyHubChild:false,xyIslandPage:false,xyIslandChat:false},"");
}
function clearOverlays(){
 document.querySelector("#panel")?.classList.remove("open");
 document.querySelector("#sidebar")?.classList.remove("open");
 document.querySelector("#scrim")?.classList.remove("show");
}
function open(asReturn=false){
 root.hidden=false;
 if(originalApp)originalApp.inert=true;
 document.documentElement.classList.add("xy-island-visible");
 if(!asReturn){fromHome=false;ensureHomeRoot()}
}
function close(){
 root.hidden=true;
 if(originalApp)originalApp.inert=originalInert;
 document.documentElement.classList.remove("xy-island-visible");
}
function navigate(type){
 if(type==="home"){root.querySelector("#xyPearlScroll")?.scrollTo({top:0,behavior:"smooth"});return}
 if(type==="call"){startCall();return}
 const favorites=type==="favorites";
 if(favorites)type="toolhub";
 if(!allowed.has(type))return;
 if(root.hidden)return;
 ensureHomeRoot();
 fromHome=true;
 try{
  if(type==="chat"){
   history.pushState({...history.state,xyIslandRoot:false,xyIslandPage:"chat",xyOverlay:false,xyHubChild:false},"");
  }else if(typeof openPanel==="function"){
   openPanel(type);
  }else throw Error("No panel route: "+type);
  close();
  if(favorites){
    const disclosure=document.querySelector("#xyHubSectionsDisclosure");
    if(disclosure)disclosure.open=true;
    document.querySelector('#xyToolHub [data-hub-filter="favorite"]')?.click();
  }
  if(type==="chat")document.querySelector("#input")?.focus({preventScroll:true});
 }catch(error){
  console.warn("[砚屿首页] 打开入口失败",type,error);
  fromHome=false;open();
 }
}
function startCall(){
 if(root.hidden)return;
 navigate("chat");
 const call=window.AevrenCall;
 if(call?.ring&&call?.answer){
  try{
   call.ring(undefined,{nativeAccepted:true});
   Promise.resolve(call.answer()).catch(error=>console.warn("[砚屿首页] 语音接通失败",error));
  }catch(error){
   console.warn("[砚屿首页] 语音启动失败",error);
   if(typeof openPanel==="function")openPanel("voice");
  }
 }else if(typeof openPanel==="function")openPanel("voice");
}
root.addEventListener("click",event=>{
 const btn=event.target.closest("button[data-xy-home-route]");
 if(!btn||!root.contains(btn))return;
 navigate(btn.dataset.xyHomeRoute);
});
function returnHome(){
 fromHome=false;
 clearOverlays();
 open(true);
}
window.addEventListener("popstate",()=>{
 if(!fromHome)return;
 const state=history.state||{};
 if(state.xyOverlay||state.xyHubChild||state.xyIslandPage)return;
 if(state[NAV_ROOT]||(!state.xyOverlay&&!state.xyHubChild))returnHome();
});
// Keep Android and close buttons consistent with the former island navigation.
document.addEventListener("click",event=>{
 if(!fromHome||!root.hidden)return;
 const button=event.target.closest?.("#closePanel,#sidebarClose,#scrim");
 if(!button||history.state?.xyHubChild)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 if(history.state?.xyOverlay||history.state?.xyIslandPage)history.back();
 else returnHome();
},true);
const header=document.querySelector(".main > header");
if(header&&!document.getElementById("xyIslandReturn")){
 const btn=document.createElement("button");
 btn.type="button";btn.id="xyIslandReturn";btn.className="xy-pearl-return";
 btn.textContent="⌂";btn.title="返回砚屿首页";btn.setAttribute("aria-label","返回砚屿首页");
 header.insertBefore(btn,header.querySelector("#memoryBtn")||null);
 btn.addEventListener("click",()=>{clearOverlays();open()});
}
window.xyIslandHome={
 open,close,arrive:()=>{},replay:()=>open(),navigate,nativeBack(){
  if(!root.hidden)return true;
  if(!fromHome)return false;
  if(history.state?.xyHubChild||history.state?.xyOverlay||history.state?.xyIslandPage)history.back();
  else returnHome();
  return true;
 },panBy:()=>{}
};
open();
})();