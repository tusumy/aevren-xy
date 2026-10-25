const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("real dashboard replaces the island artwork and loads a responsive botanical layout", () => {
  const html=read("index.html"),css=read("pearl-home.css"),scene=read("pearl-florals.svg");
  assert.match(html,/pearl-home\.css\?v=/);
  assert.match(html,/pearl-home\.js\?v=/);
  for(const retired of ["island-art.js","island-home.js","island-locations.js","island-home.css","island-responsive.css","island-cinematic.css"]){
    assert.doesNotMatch(html,new RegExp('(?:src|href)="./'+retired.replaceAll(".","\\.")+'[?]'));
  }
  assert.match(css,/\.xy-pearl-grid\{display:grid/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.xy-pearl-bottom\{/);
  assert.match(css,/data-theme-mode="dark"/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(scene,/<svg[^>]+viewBox="0 0 864 1536"/);
  assert.doesNotMatch(scene,/<image\b|<foreignObject\b|data:image\/|island_splash|xyIslandPaintingData/i);
  assert.match(scene,/<linearGradient\b/);
});

test("Android splash unlocks when the new home has rendered and never uses the island bitmap", () => {
  const main=read("android/app/src/main/java/com/aevren/xy/MainActivity.kt");
  const splash=read("android/app/src/main/java/com/aevren/xy/SeaSplashView.kt");
  assert.match(main,/#xyIslandHome:not\(\[hidden\]\) \.xy-pearl-shell/);
  assert.doesNotMatch(main,/#xyIslandWorld\.has-image/);
  assert.match(splash,/drawFlower\(/);
  assert.doesNotMatch(splash,/island_splash|BitmapFactory|drawBitmap/);
});

function mockHome() {
  const calls={panels:[],focused:0,ring:0,answer:0,replaced:0,pushed:0};
  const cls=()=>({add(){},remove(){},contains(){return false}});
  const withClass=()=>({classList:cls()});
  const app={inert:false};
  const scroll={scrollTo(){}};
  const root={
    hidden:false,innerHTML:"",className:"",id:"",
    setAttribute(){},contains(){return true},
    querySelector(selector){return selector==="#xyPearlScroll"?scroll:null},
    addEventListener(type,callback){if(type==="click")calls.click=callback}
  };
  const header={querySelector(){return null},insertBefore(){}};
  const input={focus(){calls.focused++}};
  const doc={
    body:{appendChild(node){calls.root=node}},
    documentElement:{classList:cls()},
    querySelector(selector){
      if(selector===".app")return app;
      if(selector===".main > header")return header;
      if(selector==="#input")return input;
      if(["#panel","#sidebar","#scrim"].includes(selector))return withClass();
      return null;
    },
    getElementById(){return null},
    createElement(){
      if(!calls.createdRoot){calls.createdRoot=true;return root}
      return {setAttribute(){},addEventListener(){},className:"",textContent:""};
    },
    addEventListener(){}
  };
  const state={xyIslandRoot:false};
  const history={
    state,replaceState(next){this.state=next;calls.replaced++},
    pushState(next){this.state=next;calls.pushed++},
    back(){this.state={xyIslandRoot:true};calls.popstate?.()}
  };
  const w={
    AevrenCall:{ring(){calls.ring++},answer(){calls.answer++}},
    addEventListener(name,listener){if(name==="popstate")calls.popstate=listener}
  };
  const ctx=vm.createContext({
    window:w,document:doc,history,console,Promise,Set,
    openPanel(type){calls.panels.push(type);history.pushState({...history.state,xyOverlay:true})}
  });
  vm.runInContext(read("pearl-home.js"),ctx,{filename:"pearl-home.js"});
  calls.tap=route=>calls.click({target:{closest(){return {dataset:{xyHomeRoute:route}}}}});
  return {calls,app,history,w,root};
}

test("every key dashboard action is interactive and chat return restores home", () => {
  const h=mockHome();
  assert.equal(h.root.hidden,false);
  assert.equal(h.app.inert,true);
  assert.match(h.root.innerHTML,/data-xy-home-route="study"/);
  assert.match(h.root.innerHTML,/data-xy-home-route="groupchat"/);
  assert.match(h.root.innerHTML,/data-xy-home-route="imagine"/);
  assert.match(h.root.innerHTML,/data-xy-home-route="creation"/);
  assert.match(h.root.innerHTML,/data-xy-home-route="journal"/);
  assert.match(h.root.innerHTML,/data-xy-home-route="toolhub"/);
  h.calls.tap("chat");
  assert.equal(h.root.hidden,true);
  assert.equal(h.app.inert,false);
  assert.equal(h.history.state.xyIslandPage,"chat");
  assert.equal(h.calls.focused,1);
  h.history.back();
  assert.equal(h.root.hidden,false);
  assert.equal(h.app.inert,true);
  h.calls.tap("study");
  assert.deepEqual(h.calls.panels,["study"]);
  assert.equal(h.root.hidden,true);
});

test("speech CTA opens the existing native-capable call layer", () => {
  const h=mockHome();
  h.calls.tap("call");
  assert.equal(h.calls.ring,1);
  assert.equal(h.calls.answer,1);
  assert.equal(h.root.hidden,true);
  assert.equal(h.history.state.xyIslandPage,"chat");
  assert.equal(typeof h.w.xyIslandHome.nativeBack,"function");
});
