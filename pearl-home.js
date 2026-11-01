/* 砚屿：青苹果珍珠玻璃首页。仅替换原岛屿导航层，不迁移聊天、书房或创作数据。 */
(()=>{
"use strict";
if(document.getElementById("xyIslandHome"))return;

const originalApp=document.querySelector(".app");
const originalInert=Boolean(originalApp?.inert);
const panel=document.querySelector("#panel");
const panelParent=panel?.parentNode||null;
const panelNextSibling=panel?.nextSibling||null;
const routeHost=document.createElement("section");
routeHost.id="xyHomeDestination";
routeHost.hidden=true;
routeHost.setAttribute("aria-label","砚屿功能页面");
document.body.appendChild(routeHost);
function mountDestination(){
 if(!panel)return false;
 routeHost.appendChild(panel);
 routeHost.hidden=false;
 if(originalApp)originalApp.inert=true;
 return true;
}
function unmountDestination(){
 routeHost.hidden=true;
 if(panel&&panelParent&&panel.parentNode===routeHost){
  if(panelNextSibling?.parentNode===panelParent)panelParent.insertBefore(panel,panelNextSibling);
  else panelParent.appendChild(panel);
 }
}
let fromHome=false;
const NAV_ROOT="xyIslandRoot";
const allowed=new Set(["chat","study","imagine","creation","groupchat","journal","toolhub","settings","voice","theme","memory","quotes"]);
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
 {label:"我",icon:"user",route:"me"}
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
 '<span class="xy-pearl-moment-symbol" aria-hidden="true">✧</span>'+
 '<span><strong>今天也有好多话想跟你说</strong><small>Just another little moment, ours.</small></span>'+
 '<span class="xy-pearl-moment-heart" aria-hidden="true">♡</span></button>'+
 '</div>'+
 '</div>';
document.body.appendChild(root);
const appTabs=document.createElement("nav");
appTabs.id="xyAppTabBar";
appTabs.className="xy-app-tabs";
appTabs.setAttribute("aria-label","砚屿主导航");
appTabs.innerHTML=tabMarkup;
document.body.appendChild(appTabs);
function syncName(){
  const value=window.xyTavernMacros?.name?.();
  const name=typeof value==="string"&&value.trim()&&value.trim()!=="你"?value.trim():"阿毛";
  const label=root.querySelector("#xyPearlName");if(label)label.textContent=name;
}
syncName();
window.addEventListener("xy-user-profile-change",syncName);


function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
const primaryRoutes=new Set(["home","chat","toolhub","favorites","me"]);
const knownRoutes=new Set([...primaryRoutes,"study","imagine","creation","groupchat","journal","settings","mcp","voice","theme","memory","quotes","characters","avatar","data"]);
let activeRoute="home",activeTab="home";

function tabFor(type){
 if(primaryRoutes.has(type))return type;
 if(type==="quotes")return "favorites";
 return activeTab||"home";
}
function setTabSelection(tab){
 activeTab=tab;
 appTabs.querySelectorAll("[data-xy-home-route]").forEach(button=>{
  const selected=button.dataset.xyHomeRoute===tab;
  button.classList.toggle("is-active",selected);
  if(selected)button.setAttribute("aria-current","page");
  else button.removeAttribute("aria-current");
 });
}
function clearOverlays(){
 panel?.classList.remove("open");
 document.querySelector("#sidebar")?.classList.remove("open");
 document.querySelector("#scrim")?.classList.remove("show");
}
function cleanPanelClasses(){
 panel?.classList.remove("xy-creative-panel","xy-quote-panel","xy-from-toolhub");
}
function panelHeading(eyebrow,title){
 const e=document.querySelector("#panelEyebrow"),t=document.querySelector("#panelTitle");
 if(e)e.textContent=eyebrow;
 if(t)t.textContent=title;
}
function showCustomPage(title,eyebrow,html){
 if(!panel)return;
 cleanPanelClasses();
 panelHeading(eyebrow,title);
 const body=document.querySelector("#panelBody");
 if(body)body.innerHTML=html;
 panel.classList.add("open");
 document.querySelector("#scrim")?.classList.add("show");
}
function displayName(){
 const v=window.xyTavernMacros?.name?.();
 return typeof v==="string"&&v.trim()&&v.trim()!=="你"?v.trim():"阿毛";
}
function renderMe(){
 const name=displayName(),letter=Array.from(name)[0]||"毛";
 showCustomPage("我","PERSONAL SPACE",
  '<div class="xy-my-page">'+
  '<div class="xy-my-profile">'+
   '<span class="xy-my-avatar" aria-hidden="true">'+escapeHtml(letter)+'</span>'+
   '<div class="xy-my-intro"><strong>'+escapeHtml(name)+'</strong><small>我的砚屿 · 个人资料</small></div>'+
  '</div>'+
  '<label class="xy-my-name" for="xyMyName">你的名字 · 用于 {{user}}</label>'+
  '<div class="xy-my-name-row"><input id="xyMyName" type="text" maxlength="40" autocomplete="nickname" value="'+escapeHtml(window.xyTavernMacros?.name?.()==="你"?"":window.xyTavernMacros?.name?.()||"")+'" placeholder="阿毛"><button type="button" data-xy-my-save>保存</button></div>'+
  '<p class="xy-my-note" id="xyMyStatus" role="status">名字与角色卡、聊天中的用户称呼共用同一份设置。</p>'+
  '<div class="xy-my-section-title">外观与管理</div>'+
  pageLink("avatar","头像","聊天头像与角色头像","user")+
  pageLink("theme","个性化","主题、字体、气泡与聊天背景","gear")+
  pageLink("data","数据与备份","导入、导出与本地数据管理","folder")+
  '<div class="xy-my-section-title">连接与设置</div>'+
  pageLink("settings","高级设置","API 接口、模型与参数","gear")+
  pageLink("mcp","MCP 工具","已连接的服务与权限","toolbox")+
  pageLink("characters","角色与设定","角色资料与用户称呼","book")+
  '<p class="xy-my-foot">AEVREN · XY　砚屿</p>'+
  '</div>');
}
function pageLink(route,title,subtitle,icon){
 return '<button type="button" class="xy-my-link" data-xy-subroute="'+route+'">'+
  '<span class="xy-my-link-icon">'+svg(icon)+'</span>'+
  '<span class="xy-my-link-label"><strong>'+escapeHtml(title)+'</strong><small>'+escapeHtml(subtitle)+'</small></span>'+
  '<span class="xy-my-chevron">›</span></button>';
}
const favTools=[
 ["study","书房"],["memory","记忆"],["mcp","MCP 工具"],["quotes","句子收藏"],["characters","角色"],
 ["creation","创作角"],["groupchat","群聊"],["journal","日记"],["imagine","生图"],
 ["theme","主题"],["avatar","头像"],["data","数据管理"],["settings","模型设置"],["voice","语音"]
];
function getToolFavorites(){
 try{
  const v=JSON.parse(localStorage.getItem("xy.toolhub.favorites.v1"));
  return Array.isArray(v)?v.filter(id=>favTools.some(x=>x[0]===id)):["study","memory","mcp"];
 }catch{return ["study","memory","mcp"]}
}
function renderFavorites(){
 const quotes=window.xyQuoteFavorites?.all?.()||[];
 const pinned=getToolFavorites();
 const stickerCount=window.xyStickerShelf?.count?.()||0;
 const quoteSnippet=quotes.length?quotes.slice(0,2).map(q=>'<div class="xy-fav-quote">'+escapeHtml(String(q.text||"").slice(0,115))+'</div>').join(""):'<p class="xy-fav-empty">收藏的句子会出现在这里。</p>';
 const toolSnippet=pinned.length?pinned.slice(0,8).map(id=>{
  const title=favTools.find(t=>t[0]===id)?.[1]||id;
  return '<button type="button" class="xy-fav-tool" data-xy-subroute="'+escapeHtml(id)+'">'+escapeHtml(title)+'</button>';
 }).join(""):'<p class="xy-fav-empty">暂时还没有收藏工具。</p>';
 showCustomPage("收藏","MY FAVORITES",
  '<div class="xy-fav-page">'+
   '<div class="xy-fav-hero"><span>COLLECTED MOMENTS</span><h2>喜欢的，都放在一起。</h2><p>收藏的句子、表情包和常用工具，分开保存，统一从这里进入。</p></div>'+
   '<section class="xy-fav-section"><div class="xy-fav-head"><strong>句子收藏 <small>'+quotes.length+' 句</small></strong><button type="button" data-xy-subroute="quotes">全部查看 ›</button></div>'+quoteSnippet+'</section>'+
   '<section class="xy-fav-section"><div class="xy-fav-head"><strong>表情包 <small>'+stickerCount+' 张</small></strong><button type="button" data-xy-sticker-library>打开图库 ›</button></div><p class="xy-fav-muted">沿用已经保存的表情包和收藏记录，不会重复建立图库。</p></section>'+
   '<section class="xy-fav-section"><div class="xy-fav-head"><strong>常用工具 <small>'+pinned.length+' 项</small></strong><button type="button" data-xy-subroute="toolhub" data-xy-tool-favorites>管理工具 ›</button></div><div class="xy-fav-tools">'+toolSnippet+'</div></section>'+
  '</div>');
}
function showHome(){
 unmountDestination();
 clearOverlays();
 document.documentElement.classList.remove("xy-home-subroute","xy-island-visible","xy-tabs-chat");
 root.hidden=false;
 document.documentElement.classList.add("xy-island-visible");
 if(originalApp)originalApp.inert=true;
}
function showChat(){
 clearOverlays();
 unmountDestination();
 root.hidden=true;
 document.documentElement.classList.remove("xy-home-subroute","xy-island-visible");
 document.documentElement.classList.add("xy-tabs-chat");
 if(originalApp)originalApp.inert=originalInert;
}
function showPanelRoute(type){
 root.hidden=true;
 document.documentElement.classList.remove("xy-island-visible","xy-tabs-chat");
 document.documentElement.classList.add("xy-home-subroute");
 if(type==="favorites")renderFavorites();
 else if(type==="me")renderMe();
 else if(typeof openPanel==="function")openPanel(type);
 else throw Error("没有可用的页面："+type);
 if(!mountDestination())throw Error("页面容器未就绪");
}
function applyRoute(type,tab=tabFor(type)){
 if(!knownRoutes.has(type))return false;
 activeRoute=type;
 setTabSelection(tab);
 try{
  if(type==="home")showHome();
  else if(type==="chat")showChat();
  else showPanelRoute(type);
  return true;
 }catch(error){
  console.warn("[砚屿导航] 无法打开页面",type,error);
  activeRoute="home";setTabSelection("home");showHome();
  return false;
 }
}
function routeState(type,tab){
 const rootRoute=type==="home";
 const panelRoute=type!=="home"&&type!=="chat";
 return {...(history.state||{}),
  xyIslandRoot:rootRoute,
  xyIslandPage:panelRoute?type:type==="chat"?"chat":false,
  xyIslandChat:type==="chat",
  xyOverlay:panelRoute,xyHubChild:false,
  xyAppRoute:type,xyAppTab:tab
 };
}
function navigate(type){
 if(type==="call"){startCall();return}
 if(!knownRoutes.has(type))return;
 if(type===activeRoute){
  if(type==="home")root.querySelector("#xyPearlScroll")?.scrollTo({top:0,behavior:"smooth"});
  else if(type==="favorites")renderFavorites();
  else if(type==="toolhub"&&history.state?.xyHubChild){
   window.xyPanelNavigation?.reset?.();
   history.replaceState({...history.state,xyHubChild:false},"");
   applyRoute("toolhub","toolhub");
  }
  return;
 }
 const tab=primaryRoutes.has(type)?type:tabFor(type);
 // A main-tab switch leaves a nested Tool Hub page behind; the Back
 // destination should be the hub itself, not an orphaned child overlay.
 if(history.state?.xyHubChild){
  history.replaceState({...history.state,xyHubChild:false,xyAppRoute:activeRoute,xyIslandPage:activeRoute},"");
 }
 window.xyPanelNavigation?.reset?.();
 const previous=history.state||{};
 history.pushState({...routeState(type,tab),xyFromRoute:previous.xyAppRoute||activeRoute},"");
 if(!applyRoute(type,tab))history.back();
 // Switching to the chat tab should not automatically open the keyboard.
}
function startCall(){
 navigate("chat");
 const call=window.AevrenCall;
 if(call?.ring&&call?.answer){
  try{
   call.ring(undefined,{nativeAccepted:true});
   Promise.resolve(call.answer()).catch(e=>console.warn("[砚屿导航] 语音接通失败",e));
  }catch(e){
   console.warn("[砚屿导航] 通话失败",e);
   openPanel("voice");
  }
 }else if(typeof openPanel==="function")openPanel("voice");
}
root.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-xy-home-route]");
 if(button&&root.contains(button))navigate(button.dataset.xyHomeRoute);
});
appTabs.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-xy-home-route]");
 if(button&&appTabs.contains(button))navigate(button.dataset.xyHomeRoute);
});
routeHost.addEventListener("click",event=>{
 const nameSave=event.target.closest?.("[data-xy-my-save]");
 if(nameSave){
  const input=routeHost.querySelector("#xyMyName");
  const message=routeHost.querySelector("#xyMyStatus");
  try{
   const name=window.xyTavernMacros?.setName?.(input?.value);
   if(message)message.textContent="已保存："+name;
   if(input)input.value=name;
   const label=routeHost.querySelector(".xy-my-intro strong");
   if(label)label.textContent=name;
   const avatar=routeHost.querySelector(".xy-my-avatar");
   if(avatar)avatar.textContent=Array.from(name)[0]||"毛";
  }catch(error){if(message)message.textContent=String(error?.message||error)}
  return;
 }
 const sticker=event.target.closest?.("[data-xy-sticker-library]");
 if(sticker){
  if(window.xyStickerShelf?.open)window.xyStickerShelf.open();
  return;
 }
 const link=event.target.closest?.("[data-xy-subroute]");
 if(!link)return;
 const type=link.dataset.xySubroute;
 navigate(type);
 if(link.hasAttribute("data-xy-tool-favorites")){
  document.querySelector("#xyHubSectionsDisclosure")?.setAttribute("open","");
  document.querySelector('#xyToolHub [data-hub-filter="favorite"]')?.click();
 }
});
routeHost.addEventListener("keydown",event=>{
 if(event.key==="Enter"&&event.target?.id==="xyMyName"){
  event.preventDefault();
  routeHost.querySelector("[data-xy-my-save]")?.click();
 }
});
function enterChatFromDestination(){navigate("chat");return true}
function open(asReturn=false){
 if(asReturn){applyRoute("home","home");return}
 navigate("home");
}
function close(){navigate("chat")}
function returnHome(){navigate("home")}
window.addEventListener("popstate",()=>{
 const state=history.state||{};
 const route=state.xyAppRoute||(state.xyIslandRoot?"home":null);
 if(!route)return;
 // Tool Hub's own child-back handler has already restored its parent.
 if(state.xyHubChild)return;
 window.xyPanelNavigation?.reset?.();
 applyRoute(route,state.xyAppTab||tabFor(route));
});
// The persistent Home tab replaces the old duplicate header Home button.
document.getElementById("xyIslandReturn")?.remove();
window.xyIslandHome={
 open,close,arrive:()=>{},replay:()=>navigate("home"),navigate,
 enterChatFromDestination,
 nativeBack(){
  if(activeRoute==="home")return true;
  if(history.length>1)history.back();else navigate("home");
  return true;
 },
 panBy:()=>{},activeRoute:()=>activeRoute
};
document.documentElement.classList.add("xy-shell-tabs");
const initial=history.state||{};
if(!initial.xyAppRoute){
 history.replaceState({...routeState("home","home"),xyFromRoute:null},"");
 applyRoute("home","home");
}else applyRoute(initial.xyAppRoute,initial.xyAppTab||tabFor(initial.xyAppRoute));
// IndexedDB sticker metadata may finish loading after the first favorites view.
void window.xyStickerShelf?.ready?.()?.then(()=>{
 if(activeRoute==="favorites")renderFavorites();
}).catch(()=>{});
})();