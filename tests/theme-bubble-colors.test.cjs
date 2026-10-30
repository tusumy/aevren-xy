const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("apple light and dark themes never override user/assistant bubble pigment or contrast",()=>{
  const apple=read("theme-apple-glass.css"),themeUI=read("theme-ui.css");
  for(const mode of ["light","dark"]){
    for(const owner of ["user","assistant"]){
      const selector='html[data-xy-palette="apple"][data-theme-mode="'+mode+'"] .'+owner+' .bubble{';
      const start=apple.indexOf(selector);
      assert.notEqual(start,-1,"Apple theme selector missing: "+selector);
      const end=apple.indexOf("}",start);
      const rules=apple.slice(start,end);
      assert.doesNotMatch(rules,/\bbackground\s*:/,"Apple must not lock bubble background "+mode+" "+owner);
      assert.doesNotMatch(rules,/(?:^|;)\s*color\s*:/,"Apple must not lock the bubble text contrast "+mode+" "+owner);
      assert.match(rules,/box-shadow|border/,"Retain Apple glass outline for "+mode+" "+owner);
    }
  }
  for(const varName of ["--theme-user-bubble","--theme-assistant-bubble",
    "--theme-user-glass","--theme-assistant-glass"]){
    assert.ok(themeUI.includes(varName),"Existing theme colors/glass must render "+varName);
  }
  const recipes=read("bubble-glass-recipes.css");
  assert.ok(recipes.includes("--xy-bubble-pigment"),"Bubble material must still use user pigment");
});

test("swatch grid is inline in expanded theme card; never clipped by the next section",()=>{
  const css=read("theme-core.css");
  const section=read("theme-sections.css");
  const start=css.indexOf(".xy-theme-palette{"),end=css.indexOf("}",start);
  assert.notEqual(start,-1);
  const rules=css.slice(start,end);
  assert.match(rules,/position:static/,"Picker must occupy layout space, not overlay next card");
  assert.match(rules,/flex:0 0 100%/);
  assert.match(rules,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(rules,/position:absolute|top:43px|z-index:50/);
  assert.match(css,/\.xy-theme-palette\[hidden\]\{display:none!important\}/);
  assert.match(section,/\.theme-setting-card\.xy-theme-section/);
  assert.match(section,/data-xy-folded="true"/);
});

function mockTheme(storage=new Map()){
  const settings=new Map(),paletteNodes=new Map(),hexNodes=new Map(),previewNodes=new Map();
  const attrs=(key)=>({dataset:{colorPreview:key},style:{},_listeners:{},setAttribute(name,val){this[name]=val},
    addEventListener(name,cb){this._listeners[name]=cb}});
  const colors=["bgColor","userBubble","assistantBubble","accent"];
  for(const key of colors){
    previewNodes.set(key,attrs(key));
    paletteNodes.set(key,{dataset:{colorPalette:key},hidden:true,scrolled:0,scrollIntoView(){this.scrolled++}});
    hexNodes.set(key,{dataset:{colorInput:key},value:"",_listeners:{},addEventListener(name,cb){this._listeners[name]=cb}});
  }
  const swatch={
    dataset:{colorSwatch:"userBubble",color:"#745c48"},_listeners:{},
    addEventListener(name,cb){this._listeners[name]=cb}
  };
  const cardBody={
    innerHTML:"",querySelector(selector){
      const match=selector.match(/^\[data-color-(preview|palette|input)="(.+)"\]$/);
      if(match)return match[1]==="preview"?previewNodes.get(match[2]):match[1]==="palette"?paletteNodes.get(match[2]):hexNodes.get(match[2]);
      return null;
    },
    querySelectorAll(selector){
      if(selector==="[data-color-preview]")return [...previewNodes.values()];
      if(selector==="[data-color-swatch]")return [swatch];
      if(selector==="[data-color-input]")return [...hexNodes.values()];
      if(selector===".xy-theme-palette")return [...paletteNodes.values()];
      return [];
    }
  };
  const root={
    dataset:{},style:{
      props:{},setProperty(k,v){this.props[k]=v},
      getPropertyValue(k){return this.props[k]},
      colorScheme:""
    }
  };
  const classes={add(){},remove(){},toggle(){}};
  const backdrop={style:{},id:"themeBackdrop"};
  const nodes={
    "#panelBody":cardBody,"#panelTitle":{textContent:""},
    "#panelEyebrow":{textContent:""},"#panel":{classList:classes},
    "#scrim":{classList:classes},"#sidebar":{classList:classes},
    "#themeBackdrop":backdrop,
    'meta[name="theme-color"]':{content:""}
  };
  const doc={
    documentElement:root,body:{classList:classes,prepend(node){nodes["#themeBackdrop"]=node}},
    querySelector:sel=>nodes[sel]||null,addEventListener(){},
    createElement:tag=>({style:{},id:""})
  };
  const window={matchMedia:()=>({matches:false,addEventListener(){}}),
    dispatchEvent(){},addEventListener(){}};
  const localStorage={
    getItem:k=>storage.has(k)?storage.get(k):null,
    setItem:(k,v)=>storage.set(k,v)
  };
  // Four previews are enough for the real palette handlers; other settings
  // controls are optional in bindThemePanel.
  const ctx=vm.createContext({
    document:doc,window,localStorage,openPanel(){},console,CustomEvent:class{},
    requestAnimationFrame:cb=>cb(),JSON,String,Number,Math,parseInt,Date,Array,
  });
  vm.runInContext(read("theme-core.js"),ctx,{filename:"theme-core.js"});
  vm.runInContext('openPanel("theme")',ctx);
  return {root,storage,swatch,previewNodes,paletteNodes,hexNodes,ctx,window};
}

test("choosing a bubble swatch updates rendered vars and persists across reloads",()=>{
  const a=mockTheme();
  assert.equal(a.root.dataset.xyPalette,"apple");
  const preview=a.previewNodes.get("userBubble");
  const palette=a.paletteNodes.get("userBubble");
  preview._listeners.click();
  assert.equal(palette.hidden,false);
  assert.equal(preview["aria-expanded"],"true");
  assert.equal(palette.scrolled,1,"Opening a swatch must reveal bottom row without scrolling the whole UI away");
  a.swatch._listeners.click();
  assert.equal(palette.hidden,true);
  assert.equal(preview["aria-expanded"],"false");
  assert.equal(a.root.style.props["--theme-user-bubble"],"#745c48");
  const saved=JSON.parse(a.storage.get("xy.theme"));
  assert.equal(saved.userBubble,"#745c48");
  assert.equal(JSON.parse(a.storage.get("xy.bubbleColors")).userBubble,"#745c48");
  const b=mockTheme(a.storage);
  assert.equal(b.root.style.props["--theme-user-bubble"],"#745c48","Chosen color must survive app restart");
  assert.equal(b.root.dataset.xyPalette,"apple","Saving a color must not change theme preset");
});

test("updated CSS and JS are loaded by Android WebView and all original theme controls remain present",()=>{
  const html=read("index.html");
  for(const file of ["theme-apple-glass.css?v=xy20261030bubble1",
    "theme-core.css?v=xy20261030palette1","theme-core.js?v=xy20261030palette1"]){
      assert.ok(html.includes(file),"Cache-busted resource missing: "+file);
    }
  const core=read("theme-core.js");
  for(const field of ["themeBubbleGlass","themeFontScale","themeBubbleGap","themeBgUrl","clearThemeImage","saveTheme"]){
    assert.ok(core.includes(field),"Unrelated Theme control removed "+field);
  }
  assert.match(core,/theme\[key\]=v;persist\(\);applyTheme\(\)/);
});
