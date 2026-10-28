const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("homepage decoration drops the flower while preserving the chosen layout",()=>{
 const css=read("pearl-home.css"),js=read("pearl-home.js"),html=read("index.html");
 assert.ok(css.includes("#xyIslandHome .xy-pearl-ambient::after"));
 assert.ok(!css.includes("data:image/svg+xml"),"No large repeating floral illustration");
 assert.ok(!js.includes('>✳</span>'),"No oversized asterisk flower");
 assert.ok(js.includes('>✧</span>'),"Use a quieter accent on the moment card");
 for(const region of ["xy-pearl-hero","xy-pearl-spaces","xy-pearl-moment","xy-pearl-bottom"]){
   assert.ok(js.includes(region),"Keep existing section "+region);
 }
 assert.equal((js.match(/description:"/g)||[]).length,4,"Keep four space cards");
 assert.ok(html.includes("pearl-home.css?v=xy20261028soft1"));
});

test("importer has on-device binary storage, size/type gates and three independent scopes",()=>{
 const js=read("font-import.js"),css=read("font-import.css"),html=read("index.html");
 new vm.Script(js,{filename:"font-import.js"});
 assert.ok(js.includes("indexedDB.open(DB_NAME,1)"));
 assert.ok(js.includes('new FontFace(family'));
 assert.ok(js.includes('window.indexedDB'));
 assert.ok(js.includes("25*1024*1024"));
 assert.ok(js.includes("ttf|otf|woff|woff2"));
 for(const v of ['value="all"','value="chat"','value="title"'])assert.ok(js.includes(v));
 for(const route of ['data-xy-import-font-scope="all"','data-xy-import-font-scope="chat"','data-xy-import-font-scope="title"'])assert.ok(css.includes(route));
 for(const element of ["xyFontImportFile","xyFontImportSelect","xyFontImportScope","xyFontDefault","xyFontDelete","xyFontImportPreview"])assert.ok(js.includes(element));
 assert.ok(js.includes("card.className=\"theme-setting-card xy-font-import-card\""),"Use existing theme folding structure");
 assert.ok(html.includes("font-import.js?v=xy20261028fonts1"));
 assert.ok(html.includes("font-import.css?v=xy20261028fonts1"));
 assert.ok(!js.includes("fetch("),"Font blobs must not be sent to network endpoints");
});

test("font import is applied, persists and respects selected scope, without replacing existing theme setting",async()=>{
 const content=read("font-import.js"),data=new Map(),storage=new Map(),events={};
 const nextTick=()=>new Promise(resolve=>setImmediate(resolve));
 const root={dataset:{},style:{p:{},setProperty(k,v){this.p[k]=v},removeProperty(k){delete this.p[k]}}};
 const files={faces:new Set(),add(x){this.faces.add(x)},delete(x){this.faces.delete(x)}};
 const makeInput=(id,value="")=>({id,value,disabled:false,style:{},textContent:"",dataset:{},replaceChildren(){this.options=[];this.value=""},append(o){this.options.push(o)},addEventListener(){}});
 const parts={
   xyFontImportSelect:makeInput("xyFontImportSelect"),
   xyFontImportScope:makeInput("xyFontImportScope","chat"),
   xyFontDelete:makeInput("xyFontDelete"),
   xyFontImportCurrent:makeInput("xyFontImportCurrent"),
   xyFontImportPreview:makeInput("xyFontImportPreview"),
   xyFontImportStatus:makeInput("xyFontImportStatus")
 };
 const card={
   className:"",innerHTML:"",setAttribute(){},
   querySelector(sel){return parts[sel.replace("#","")]||null}
 };
 let mounted=false;
 const body={
   contains(){return true},
   querySelector(sel){
     if(sel==="#themeBubbleGlass")return {};
     if(sel===".xy-font-import-card")return mounted?card:null;
     if(sel==="#xyFontImportStatus")return mounted?parts.xyFontImportStatus:null;
     return parts[sel.replace("#","")]||null;
   },
   append(node){assert.equal(node,card);mounted=true},
   addEventListener(type,handler){events[type]=handler}
 };
 const db={
   objectStoreNames:{contains(){return true}},
   createObjectStore(){},
   close(){},
   transaction(_name,_mode){
     const tx={};
     tx.objectStore=()=>({
       getAll(){
         const req={};
         queueMicrotask(()=>{req.result=Array.from(data.values());req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});
         return req;
       },
       put(rec){
         const req={};queueMicrotask(()=>{data.set(rec.id,rec);req.result=rec.id;req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req;
       },
       delete(id){
         const req={};queueMicrotask(()=>{data.delete(id);req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req;
       }
     });
     return tx;
   }
 };
 let lastReq;
 const indexedDB={open(){const req={result:db};lastReq=req;queueMicrotask(()=>req.onsuccess?.());return req}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 class FakeFontFace{
   constructor(family,src){this.family=family;this.src=src}
   async load(){return this}
 }
 const context={
   document:{documentElement:root,getElementById:id=>id==="panelBody"?body:null,fonts:files,
     createElement:tag=>tag==="section"?card:{value:"",textContent:""}},
   window:{indexedDB},indexedDB,localStorage,FontFace:FakeFontFace,
   URL:{createObjectURL:()=> "blob:font-test",revokeObjectURL(){}},
   MutationObserver:class{observe(){}},
   console,Promise,JSON,Date,Math,Map,Set
 };
 vm.runInNewContext(content,context,{filename:"font-import.js"});
 await nextTick();await nextTick();
 assert.ok(mounted,"Appearance panel should have a font import card");
 const font={name:"sample.ttf",size:2550,type:"font/ttf"};
 await events.change({target:{id:"xyFontImportFile",files:[font],value:"sample.ttf"}});
 await nextTick();await nextTick();await nextTick();
 assert.equal(data.size,1,"Binary must be saved to IndexedDB");
 assert.equal(root.dataset.xyImportFontScope,"chat");
 const active=JSON.parse(storage.get("xy.user.font.selection.v1"));
 assert.equal(active.scope,"chat");
 assert.ok(active.id,"selected font identifier must persist");
 assert.ok(root.style.p["--xy-import-font-family"].includes("XYImportedFont_"));
 assert.ok(!storage.has("sample.ttf"),"Never store raw font in localStorage");
 parts.xyFontImportSelect.value=active.id;
 parts.xyFontImportScope.value="title";
 await events.click({target:{closest(){return {id:"xyFontUse"}}}});
 await nextTick();await nextTick();
 assert.equal(root.dataset.xyImportFontScope,"title");
 assert.equal(JSON.parse(storage.get("xy.user.font.selection.v1")).scope,"title");
 await events.click({target:{closest(){return {id:"xyFontDefault"}}}});
 assert.equal(root.dataset.xyImportFontScope,undefined);
 assert.equal(data.size,1,"Reset restores system font without deleting imported binary");
});
