const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("all existing and injected Theme settings have foldable groups", () => {
  const source=read("theme-sections.js");
  const addonSources=[
    ["glass-recipes.js",".xy-glass-card"],
    ["html-card-appearance.js",".xy-html-glass-settings"],
    ["bubble-glass-recipes.js",".xy-bubble-glass-card"]
  ];
  for(const [file,selector] of addonSources){
    assert.ok(read(file).includes(selector.slice(1)), "Addon card class missing from "+file);
    assert.ok(source.includes(selector), "Accordion does not recognize "+file);
  }
  for(const label of [
    "玻璃材质","HTML / 状态卡片材质","聊天气泡皮肤","气泡玻璃材质",
    "气泡与背景颜色","气泡与文字设置","背景图片","背景遮罩与模糊"
  ]){
    assert.ok(source.includes(label), "Missing fold section "+label);
  }
  assert.match(source, /new MutationObserver\(onChange\)/);
  assert.match(source, /card\.prepend\(toggle\)/);
  assert.match(source, /aria-expanded/);
  const css=read("theme-sections.css");
  assert.ok(css.includes('data-xy-folded="true"'));
  assert.ok(css.includes(" > :not(.xy-theme-section-toggle)"));
  const html=read("index.html");
  assert.ok(html.includes("theme-sections.js?v="));
  assert.ok(html.includes("theme-sections.css?v="));
  assert.ok(html.includes("theme-core.js?v=xy20261030palette1"));
});

test("fold controller defaults detail cards shut; toggles keep original card nodes and persist across rerenders", () => {
  const keys={};
  const cache=new Map();
  const localStorage={
    getItem:k=>cache.has(k)?cache.get(k):null,
    setItem:(k,v)=>cache.set(k,v)
  };
  let observer;
  const glassNode={id:"glassChoice",listeners:["existing-listener"]};
  const makeCard=(cls)=>({
    dataset:{},children:[glassNode],_click:null,
    matches(sel){return sel==="."+cls},
    classList:{add(){}},
    querySelector(sel){
      if(sel===".xy-theme-section-title")return this._title;
      return null;
    },
    prepend(node){this.children.unshift(node)}
  });
  const glass=makeCard("xy-glass-card");
  const html=makeCard("xy-html-glass-settings");
  const cards=[glass,html];
  const body={
    querySelector(selector){
      if(selector==="#themeBubbleGlass")return {};
      return null;
    },
    querySelectorAll(selector){
      return selector===".theme-setting-card:not([data-xy-theme-section])"?
        cards.filter(c=>!c.dataset.xyThemeSection):[];
    }
  };
  const createElement=tag=>{
    if(tag==="button"){
      const el={
        type:"",className:"",attributes:{},_click:null,
        setAttribute(k,v){this.attributes[k]=v},
        querySelector(){return {textContent:""}},
        addEventListener(name,fn){if(name==="click")this._click=fn}
      };
      return el;
    }
    return {append(){},setAttribute(){},addEventListener(){}};
  };
  const document={
    getElementById:id=>id==="panelBody"?body:null,
    createElement
  };
  const FakeMutationObserver=class{
    constructor(fn){observer=fn}
    observe(){}
  };
  const ctx=vm.createContext({document,localStorage,MutationObserver:FakeMutationObserver,JSON,Array});
  vm.runInContext(read("theme-sections.js"),ctx);
  assert.equal(glass.dataset.xyFolded,"true");
  assert.equal(html.dataset.xyFolded,"true");
  assert.equal(glass.children[1],glassNode,"Original content and listeners must not be replaced");
  assert.equal(glass.children[0].attributes["aria-expanded"],"false");
  glass.children[0]._click();
  assert.equal(glass.dataset.xyFolded,"false");
  assert.equal(glass.children[0].attributes["aria-expanded"],"true");
  const saved=JSON.parse(cache.get("xy.theme.sections.expanded.v1"));
  assert.equal(saved["glass-app"],true);
  const nextCard=makeCard("xy-bubble-glass-card");
  cards.push(nextCard);
  observer();
  assert.equal(nextCard.dataset.xyFolded,"true","Addon card must fold when dynamically inserted");
  assert.equal(nextCard.dataset.xyThemeSection,"glass-bubble");
  assert.equal(glass.children.length,2,"Repeated observers must not duplicate controls");
});

test("apple preset wallpaper and customized background are never forced by gradient",()=>{
  const apple=read("theme-apple-glass.css");
  const core=read("theme-core.js");
  const home=read("pearl-home.css");
  assert.ok(apple.includes('[data-theme-mode="light"][data-xy-custom-background="0"] #themeBackdrop'));
  assert.ok(apple.includes('[data-theme-mode="dark"][data-xy-custom-background="0"] #themeBackdrop'));
  assert.ok(!apple.includes("#themeBackdrop::after"),"Theme overlay should use the native adjustable slider");
  assert.ok(core.includes("root.dataset.xyCustomBackground=customBackground?'1':'0'"));
  assert.ok(core.includes("!!theme.bgImage"));
  assert.ok(core.includes("norm(theme.bgColor)!==norm(baseColor)"));
  assert.ok(core.includes("--xy-theme-custom-bg-image"));
  assert.ok(home.includes('html[data-xy-custom-background="1"] #xyIslandHome'));
  assert.ok(home.includes("--xy-theme-custom-bg-image"));
});
