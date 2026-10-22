/* 砚屿归岛：独立场景层，原聊天与所有数据不变。 */
(()=>{
"use strict";
if(document.getElementById("xyIslandHome"))return;
const ASSET="./island-scene.webp.b64", INTRO_KEY="xy.island.introSeen.v1";
const places=[
["swing",165,400,200,84,"秋千·重播","replay"],
["lighthouse",855,473,256,110,"灯塔·工具","toolhub"],
["study",725,654,250,92,"藏书阁","study"],
["home",196,721,300,85,"海边小屋·聊天","chat"],
["garden",288,988,256,100,"小岛·聊天","chat"],
["atelier",865,902,221,96,"画室","imagine"],
["journal",896,1120,233,105,"临海亭·日记","journal"],
["messages",140,1447,180,120,"消息","chat"],
["characters",335,1447,165,120,"角色","characters"],
["island",508,1447,190,120,"砚屿","island"],
["tools",710,1447,160,120,"工具","toolhub"],
["mine",900,1447,153,120,"我的·设置","settings"]
].map(([id,x,y,w,h,name,type])=>({id,x,y,w,h,name,type}));
const originalApp=document.querySelector(".app");
const originalInert=!!originalApp?.inert;
const root=document.createElement("section");
root.id="xyIslandHome";root.setAttribute("aria-label","砚屿·岛屿主页");
root.innerHTML=
'<div class="xy-island-backdrop" aria-hidden="true"></div>'+
'<main class="xy-island-world" id="xyIslandWorld" aria-label="樱花云海中的砚屿">'+
'<img class="xy-island-painting" id="xyIslandPainting" alt="樱花秋千、粉毛绿眸小娃娃、仙侠楼阁、云海瀑布与砚屿岛屿" draggable="false">'+
'<div class="xy-island-foreground" aria-hidden="true"></div><div id="xyIslandPetals" aria-hidden="true"></div>'+
'<div class="xy-island-busy" id="xyIslandLoading" role="status">云海正在散开……</div>'+
'<div class="xy-island-controls"><button type="button" id="xyIslandReplay" aria-label="重播归岛动画">↻ 重播归岛</button><button type="button" id="xyIslandTip" aria-label="查看岛屿操作提示">✦ 怎么逛</button></div>'+
'<button type="button" class="xy-island-skip" id="xyIslandSkip">跳过开场　›</button>'+
'<nav class="xy-island-labels" id="xyIslandLabels" aria-label="岛上功能入口"></nav>'+
'<div class="xy-island-notice" id="xyIslandNotice" aria-live="polite">穿过树叶，去看看秋千……</div>'+
'<div class="xy-island-tooltip" id="xyIslandTooltip" role="status" hidden></div>'+
'</main>';
document.body.appendChild(root);
const world=root.querySelector("#xyIslandWorld"),painting=root.querySelector("#xyIslandPainting"),
backdrop=root.querySelector(".xy-island-backdrop"),spots=root.querySelector("#xyIslandLabels"),
skip=root.querySelector("#xyIslandSkip"),notice=root.querySelector("#xyIslandNotice"),
tooltip=root.querySelector("#xyIslandTooltip");
let introTimers=[],loaded=false,ready=false,toastTimer=0,arrivalTimer=0,exitTimer=0,noticeTimer=0;
let panX=0,panMax=0,gesture=null,suppressClickUntil=0;
let fromIsland=false,routeKind="";
const reduced=!!window.matchMedia?.("(prefers-reduced-motion:reduce)")?.matches;
let seen=false;try{seen=sessionStorage.getItem(INTRO_KEY)==="1"}catch{}
function schedule(fn,ms){introTimers.push(setTimeout(fn,ms))}
function clearTimeline(){introTimers.forEach(clearTimeout);introTimers=[]}
function layout(){
 const width=world.clientWidth,height=world.clientHeight;if(!width||!height)return;
 const scale=Math.max(width/1024,height/1536),dx=(width-1024*scale)/2,dy=(height-1536*scale)/2;
 panMax=Math.max(0, (1024*scale-width)/2);
 setPan(panX);
 places.forEach(p=>{const e=p.el;e.style.left=dx+p.x*scale+"px";e.style.top=dy+p.y*scale+"px";
 e.style.width=p.w*scale+"px";e.style.height=p.h*scale+"px"});
}
places.forEach(p=>{
 const b=document.createElement("button");b.type="button";b.className="xy-island-entry";
 b.dataset.place=p.id;b.setAttribute("aria-label",p.name);b.title=p.name;p.el=b;spots.appendChild(b);
});
for(let i=0;i<14;i++){
 const petal=document.createElement("i");petal.className="xy-island-petal";
 petal.style.setProperty("--left",((i*67+19)%100)+"%");
 petal.style.setProperty("--delay",(-i*.89)+"s");
 petal.style.setProperty("--duration",(8+(i%7)*1.35)+"s");
 root.querySelector("#xyIslandPetals").appendChild(petal);
}
function setPan(value){
 panX=Math.max(-panMax,Math.min(panMax,value));
 root.style.setProperty("--xy-island-pan-x",panX+"px");
}
function notify(s,ms=1900){
 tooltip.textContent=s;tooltip.hidden=false;clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{tooltip.hidden=true},ms);
}
function arrive(){
 clearTimeline();clearTimeout(arrivalTimer);
 ready=true;world.classList.add("is-ready");
 skip.hidden=true;notice.textContent="回来了，岛上的灯还亮着";
 clearTimeout(noticeTimer);notice.hidden=false;
 noticeTimer=setTimeout(()=>{if(ready)notice.hidden=true},1400);
 if(world.classList.contains("is-intro")){
  // Let the animated character dissolve into the stable island instead of snapping away.
  world.classList.add("is-arriving");
  for(const animation of painting.getAnimations()){try{animation.finish()}catch{}}
  arrivalTimer=setTimeout(()=>{
   world.classList.remove("is-intro","is-arriving");
  },580);
 }else world.classList.remove("is-arriving");
 try{sessionStorage.setItem(INTRO_KEY,"1")}catch{}
}
function replay(){
 if(!loaded)return;
 clearTimeline();clearTimeout(arrivalTimer);ready=false;world.classList.remove("is-ready","is-intro","is-arriving");
 void world.offsetWidth;world.classList.add("is-intro");
 skip.hidden=false;notice.hidden=false;clearTimeout(noticeTimer);
 setPan(0);notice.textContent="穿过树叶，去看看秋千……";
 [[1300,"叶子散开了，秋千上有只粉毛小娃娃"],[2550,"小娃娃松开秋千，纵身跃下"],
 [3600,"穿过云海，向砚屿飞去"],[4950,"落在岛上的石阶旁"],
 [6050,"镜头拉远，整座岛慢慢亮起来"]].forEach(([t,s])=>schedule(()=>{notice.textContent=s},t));
 schedule(arrive,6600);
}
function finishExit(){
 clearTimeout(exitTimer);
 root.hidden=true;
 root.classList.remove("is-exiting","is-entering");
 document.documentElement.classList.remove("xy-island-visible");
}
function close(){
 if(root.hidden)return;
 arrive();
 clearTimeout(exitTimer);
 // Render the destination before fading out the island, preventing a black or blank frame.
 if(originalApp)originalApp.inert=originalInert;
 root.classList.remove("is-entering");
 if(reduced){finishExit();return}
 root.classList.add("is-exiting");
 exitTimer=setTimeout(finishExit,440);
}
function open(){
 clearTimeout(exitTimer);
 root.classList.remove("is-exiting");
 root.hidden=false;
 if(originalApp)originalApp.inert=true;
 document.documentElement.classList.add("xy-island-visible");
 if(loaded)arrive();
 layout();
 if(!reduced){
  root.classList.add("is-entering");
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.remove("is-entering")));
 }
}
function navigate(type){
 if(type==="island")return;
 if(type==="replay"){replay();return}
 fromIsland=true;routeKind=type;
 try{
  if(type==="chat"){
   history.pushState({...history.state,xyIslandChat:true},"");
  }else if(typeof openPanel==="function"){
   openPanel(type);
  }else{
   throw Error("Missing destination "+type);
  }
  close();
 }catch(e){
  console.warn("[砚屿归岛] 无法打开",type,e);
  fromIsland=false;routeKind="";open();notify("入口暂时不可用");
 }
}
spots.addEventListener("click",e=>{
 if(Date.now()<suppressClickUntil)return;
 const el=e.target.closest("[data-place]");if(!el||!ready)return;
 const p=places.find(x=>x.id===el.dataset.place);if(p)navigate(p.type);
});
root.querySelector("#xyIslandReplay").addEventListener("click",replay);
root.querySelector("#xyIslandTip").addEventListener("click",()=>notify("点岛上的房屋、灯塔或下方小图标，进入对应页面",2600));
skip.addEventListener("click",arrive);
// Move the complete painted island, hotspots included. Keep the navbar and controls stationary.
world.addEventListener("pointerdown",e=>{
 if(!ready||root.hidden||e.button!==0||e.target.closest(".xy-island-controls,.xy-island-skip"))return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,start:panX,moved:false};
});
world.addEventListener("pointermove",e=>{
 if(!gesture||gesture.id!==e.pointerId)return;
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 if(!gesture.moved&&Math.abs(dx)>9&&Math.abs(dx)>Math.abs(dy)*1.1){
  gesture.moved=true;try{world.setPointerCapture(e.pointerId)}catch{}
 }
 if(gesture.moved){setPan(gesture.start+dx);if(e.cancelable)e.preventDefault()}
});
function finishGesture(){
 if(gesture?.moved)suppressClickUntil=Date.now()+280;
 gesture=null;
}
world.addEventListener("pointerup",finishGesture);
world.addEventListener("pointercancel",finishGesture);
world.addEventListener("lostpointercapture",finishGesture);
world.addEventListener("click",e=>{
 if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}
},true);
// Hardware Back: a panel launched from the island returns to the island rather than chat.
// Nested hub tools still return to their parent hub on the first Back.
window.addEventListener("popstate",()=>{
 if(!fromIsland)return;
 if(history.state?.xyOverlay || history.state?.xyHubChild || history.state?.xyIslandChat)return;
 fromIsland=false;routeKind="";
 document.querySelector("#panel")?.classList.remove("open");
 document.querySelector("#sidebar")?.classList.remove("open");
 document.querySelector("#scrim")?.classList.remove("show");
 open();
});
document.addEventListener("keydown",e=>{
 if(root.hidden||e.key!=="Escape")return;if(!ready)arrive();else close();
});
const header=document.querySelector(".main > header");
if(header&&!document.getElementById("xyIslandReturn")){
 const btn=document.createElement("button");btn.type="button";btn.id="xyIslandReturn";
 btn.className="xy-island-return";btn.textContent="屿";btn.title="回到砚屿岛屿主页";
 btn.setAttribute("aria-label","回到砚屿岛屿主页");
 header.insertBefore(btn,header.querySelector("#memoryBtn")||null);
 btn.addEventListener("click",open);
}
window.addEventListener("resize",layout);
window.xyIslandHome={open,close,replay,arrive};
layout();if(originalApp)originalApp.inert=true;document.documentElement.classList.add("xy-island-visible");
function failed(){
 console.warn("[砚屿归岛] 场景图未加载，已启用备用导航");
 root.classList.add("is-fallback");world.classList.add("has-image");
 root.querySelector("#xyIslandLoading").hidden=true;loaded=true;arrive();
 notice.textContent="砚屿 · 选择一个入口";
}
function setArtwork(encoded){
 painting.addEventListener("load",()=>{
  loaded=true;world.classList.add("has-image");
  backdrop.style.backgroundImage='url("'+painting.src+'")';layout();
  if(seen||reduced)arrive();else replay();
 },{once:true});
 painting.addEventListener("error",failed,{once:true});
 painting.src="data:image/webp;base64,"+encoded.trim();
}
if(typeof window.xyIslandPaintingData==="string"&&window.xyIslandPaintingData.startsWith("data:image/webp;base64,")){setArtwork(window.xyIslandPaintingData.slice("data:image/webp;base64,".length));}
else fetch(ASSET,{cache:"force-cache"}).then(r=>{
 if(!r.ok)throw Error("HTTP "+r.status);return r.text()
}).then(t=>{if(!t.startsWith("UklGR"))throw Error("invalid island image");setArtwork(t)}).catch(failed);
})();
