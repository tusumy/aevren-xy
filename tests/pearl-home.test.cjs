const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("design preview stays intact with four space cards and five nav tabs", () => {
  const html=read("index.html");
  const css=read("pearl-home.css");
  const theme=read("theme-core.js");
  assert.ok(html.includes("pearl-home.css?v="));
  assert.ok(html.includes("pearl-home.js?v="));
  assert.ok(html.includes("theme-curated.css?v="));
  for(const retired of ["island-art.js","island-home.js","island-locations.js","island-home.css","island-responsive.css","island-cinematic.css"]){
    assert.ok(!html.includes('"./'+retired+'?'),"old island must not be loaded: "+retired);
  }
  assert.ok(css.includes(".xy-pearl-hero{"));
  assert.ok(!css.includes(".xy-pearl-looks{"),"home must not style a preview theme picker");
  assert.ok(css.includes(".xy-pearl-spaces{"));
  assert.ok(css.includes(".xy-pearl-moment{"));
  assert.ok(css.includes("min-height:98px"));
  assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
  assert.ok(css.includes("grid-template-columns:repeat(5,minmax(0,1fr))"));
  for(const look of ["apple","mist","rose","night"])assert.ok(theme.includes(look+":{"),"missing preset "+look);
  assert.ok(css.includes('data-xy-palette="mist"'));
  assert.ok(css.includes('data-xy-palette="rose"'));
  assert.ok(css.includes('data-xy-palette="night"'));
  assert.ok(css.includes('data-theme-mode="dark"'));
  assert.ok(!css.includes("pearl-florals.svg"));
});

test("Android splash unlocks when the new home has rendered and never uses the island bitmap", () => {
  const main=read("android/app/src/main/java/com/aevren/xy/MainActivity.kt");
  const splash=read("android/app/src/main/java/com/aevren/xy/SeaSplashView.kt");
  assert.match(main,/#xyIslandHome:not\(\[hidden\]\) \.xy-pearl-shell/);
  assert.doesNotMatch(main,/#xyIslandWorld\.has-image/);
  assert.match(splash,/RadialGradient/);
  assert.doesNotMatch(splash,/drawFlower\(/);
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
    querySelectorAll(){return []},
    addEventListener(type,callback){if(type==="click")calls.click=callback}
  };
  const header={querySelector(){return null},insertBefore(){}};
  const input={focus(){calls.focused++}};
  const doc={
    body:{appendChild(node){calls.root=node}},
    documentElement:{classList:cls(),dataset:{xyPalette:"apple"}},
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

test("home includes hero, chat, call, four smaller space tools and all five tabs", () => {
 const h=mockHome();
 assert.equal(h.root.hidden,false);
 assert.equal(h.app.inert,true);
 for(const word of ["我们的空间","继续我们的对话","语音通话","Keep exploring","今天也有好多话想跟你说"]){
   assert.ok(h.root.innerHTML.includes(word),"missing "+word);
 }
 assert.equal((h.root.innerHTML.match(/class="xy-pearl-tile"/g)||[]).length,4);
 assert.equal((h.root.innerHTML.match(/class="xy-pearl-tab(?: is-active)?"/g)||[]).length,5);
 assert.equal((h.root.innerHTML.match(/class="xy-pearl-look"/g)||[]).length,0);
  assert.ok(!h.root.innerHTML.includes("data-xy-look"),"preview theme selector must not exist on home");
 for(const route of ["study","imagine","creation","groupchat","journal","toolhub","settings","call"]){
   assert.ok(h.root.innerHTML.includes('data-xy-home-route="'+route+'"'),"missing "+route);
 }
 h.calls.tap("chat");
 assert.equal(h.root.hidden,true);
 assert.equal(h.history.state.xyIslandPage,"chat");
 assert.equal(h.calls.focused,1);
 h.history.back();
 assert.equal(h.root.hidden,false);
 h.calls.tap("study");
 assert.deepEqual(h.calls.panels,["study"]);
});

test("More retains all previously available tools and routes", () => {
  const hub=read("tool-hub.js");
  for(const id of ["study","creation","groupchat","journal","imagine","voice","mcp","settings","theme","avatar","memory"]){
    assert.ok(hub.includes('id:"'+id+'"'),"Missing Tool Hub item: "+id);
  }
  const home=mockHome();
  home.calls.tap("creation");
  assert.deepEqual(home.calls.panels,["creation"]);
  home.history.back();
  home.calls.tap("imagine");
  assert.deepEqual(home.calls.panels,["creation","imagine"]);
});

test("palette buttons belong in Appearance settings, never on the home page", () => {
  const h=mockHome();
  assert.ok(!h.root.innerHTML.includes("xy-pearl-looks"));
  assert.ok(!h.root.innerHTML.includes("data-xy-look"));
  const theme=read("theme-core.js");
  const themeCss=read("theme-curated.css");
  for(const name of ["青苹果","雾薄荷","樱雾","墨绿夜"]){
    assert.ok(theme.includes(name),"Missing appearance setting: "+name);
    assert.ok(!h.root.innerHTML.includes(name),"Theme palette leaked onto home: "+name);
  }
  assert.ok(theme.includes("xy-theme-curated"));
  assert.ok(themeCss.includes(".xy-theme-curated"));
  assert.ok(theme.includes("window.xyThemePresets="));
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
