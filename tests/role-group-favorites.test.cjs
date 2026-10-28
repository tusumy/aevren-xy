const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("legacy conversations preserve their original role, and role changes cannot overwrite shared endpoint prompts",()=>{
 const characters=[
   {id:"xuan-yan",name:"玄砚",system:""},
   {id:"role-b",name:"乙角色",system:"乙角色专属提示"}
 ];
 const persisted=new Map([
   ["xy.characters",characters],["xy.defaultCharacter","role-b"],["xy.xuanPromptCleared.v1",true]
 ]);
 const store={get:(k,d)=>persisted.has(k)?persisted.get(k):d,set:(k,v)=>persisted.set(k,v)};
 const chats=[
   {id:1,title:"旧窗口",messages:[]},
   {id:2,title:"已经绑定的窗口",characterId:"role-b",messages:[]}
 ];
 const endpoints=[{id:"endpoint-1",active:true,model:"model-a",system:"用户自定义API系统提示词"}];
 let activeId=1,usedHandler;
 const body={
   innerHTML:"",
   querySelector(){return null},
   querySelectorAll(selector){
     if(selector==="[data-character-use]")return [{
       dataset:{characterUse:"role-b"},addEventListener(type,fn){if(type==="click")usedHandler=fn}
     }];
     return [];
   }
 };
 const noop=()=>{};
 const document={
   querySelector(sel){
     if(sel==="#panelBody")return body;
     if(sel==="#panelEyebrow"||sel==="#panelTitle")return {textContent:""};
     if(sel==="#panel"||sel==="#scrim")return {classList:{add:noop,remove:noop}};
     return null;
   },
   querySelectorAll:()=>[]
 };
 const sandbox={store,chats,endpoints,memories:[],document,window:{},esc:x=>x,
   chat:()=>chats.find(x=>x.id===activeId),save:noop,renderMessages:noop,
   renderChats:noop,showTyping:noop,send:async()=>{},openPanel:noop,
   requestAnimationFrame:fn=>fn(),Date,Array,JSON,String,Number,console};
 const ctx=vm.createContext(sandbox);
 vm.runInContext(read("settings-ui.js"),ctx,{filename:"settings-ui.js"});
 assert.equal(chats[0].characterId,"xuan-yan","Unbound legacy conversations must not inherit the latest global role");
 assert.equal(chats[1].characterId,"role-b");
 assert.equal(endpoints[0].system,"用户自定义API系统提示词");
 assert.equal(sandbox.window.xyCurrentCharacter().id,"xuan-yan");
 vm.runInContext('openPanel("characters")',ctx);
 usedHandler();
 assert.equal(chats[0].characterId,"role-b","Use binds the current window");
 assert.equal(chats[1].characterId,"role-b","Other window unchanged");
 assert.equal(endpoints[0].system,"用户自定义API系统提示词","Role prompts never overwrite API settings");
 activeId=2;
 assert.equal(sandbox.window.xyCurrentCharacter().id,"role-b");
 assert.equal(sandbox.window.xyActiveCharacterPrompt(),"乙角色专属提示");
 assert.equal(persisted.get("xy.defaultCharacter"),"role-b","Role changes do not rewrite the global default");
 const app=read("app.js");
 assert.ok(app.includes("characterId:owner"),"New chats must snapshot characterId before saving");
 assert.ok(app.includes("window.xyActiveCharacterPrompt"),"Fallback API sender must use its own role");
 assert.ok(read("api-compat.js").includes("const currentRole=window.xyCurrentCharacter?.()"));
});

test("group API binding resolves a distinct endpoint and model for each participant, without switching global active route",()=>{
 const endpoints=[
   {id:"ep-one",name:"一号",base:"https://one.example/v1",model:"model-one",key:"k1",system:"",active:true},
   {id:"ep-two",name:"二号",base:"https://two.example/v1",model:"model-two",key:"k2",system:"",active:false}
 ];
 const chars=[{id:"a",name:"甲",system:"甲专属"},{id:"b",name:"乙",system:"乙专属"}];
 const group={id:"g1",title:"角色群聊",characterIds:["a","b"],bookId:"",
   apiBindings:{a:{endpointId:"ep-two",model:"model-two-custom"}},messages:[]};
 const classes={add(){},remove(){}};
 const panel={classList:classes};
 let events={};
 const host={
   innerHTML:"",
   addEventListener(name,fn){events[name]=fn},
   querySelector(sel){
     if(sel==="#xyGinput")return {value:"嗨大家"};
     if(sel==="#xyGmessages")return {scrollTo(){}};
     return null;
   },
   querySelectorAll(){return []}
 };
 const C={
   chars:()=>chars,group:id=>id===group.id?group:null,book:()=>null,books:()=>[],
   names:ids=>ids.map(id=>chars.find(c=>c.id===id)?.name).join("、"),
   saveGroup(){},id:()=>Math.random().toString(36),esc:x=>String(x).replaceAll('"',"&quot;")
 };
 const headers={};
 const calls=[];
 const document={
   querySelector(sel){
     if(sel==="#panelBody")return host;
     if(sel==="#panel")return panel;
     if(sel==="#panelTitle"||sel==="#panelEyebrow")return {textContent:""};
     if(sel==="#sidebar"||sel==="#scrim")return {classList:classes};
     return null;
   }
 };
 const sandbox={window:{xyCreative:C,xyEnsureOverlayHistory:()=>{},
   AevrenApiCompat:{completeChatEndpoint:base=>base+"/chat/completions"},
   xyIsCharacterSystem:()=>false},
   endpoints,document,openPanel(){},fetch:async(url,opts)=>{
     calls.push({url,payload:JSON.parse(opts.body),headers:opts.headers});
     return {ok:true,json:async()=>({choices:[{message:{content:"收到"}}]})};
   },Error,JSON,Date,Number,String,console,confirm:()=>true};
 vm.runInNewContext(read("creation-group.js"),sandbox,{filename:"creation-group.js"});
 const api=sandbox.window.xyCreativeGroup;
 assert.equal(api.endpointFor(group,chars[0]).endpoint.id,"ep-two");
 assert.equal(api.endpointFor(group,chars[0]).model,"model-two-custom");
 assert.equal(api.endpointFor(group,chars[1]).endpoint.id,"ep-one");
 assert.equal(api.endpointFor(group,chars[1]).model,"model-one");
 api.open("g1");
 assert.ok(host.innerHTML.includes('data-g-api-endpoint="a"'));
 assert.ok(host.innerHTML.includes('data-g-api-endpoint="b"'));
 assert.ok(host.innerHTML.includes("角色 API 绑定"));
 const choose=events.change({target:{dataset:{gApiEndpoint:"b"},value:"ep-two"}});
 assert.equal(group.apiBindings.b.endpointId,"ep-two");
 assert.equal(endpoints[0].active,true,"Group selection never switches global API");
 group.apiBindings.b={endpointId:"ep-one",model:"model-b-custom"};
 const bad={...group,apiBindings:{a:{endpointId:"deleted"}}};
 assert.throws(()=>api.endpointFor(bad,chars[0]),/接口已删除/);
 // Sending a group reply resolves the endpoint of each turn independently.
 events.click({preventDefault(){},target:{closest(){return {dataset:{g:"send"}}}}});
 return new Promise(resolve=>setTimeout(resolve,25)).then(()=>{
   assert.equal(calls.length,2);
   assert.equal(calls[0].url,"https://two.example/v1/chat/completions");
   assert.equal(calls[0].payload.model,"model-two-custom");
   assert.equal(calls[1].url,"https://one.example/v1/chat/completions");
   assert.equal(calls[1].payload.model,"model-b-custom");
   assert.equal(endpoints[0].active,true);
   assert.equal(group.messages.filter(m=>m.role==="assistant").length,2);
 });
});

test("sentence favorites persist separately from role memories, dedupe and are reachable from home/tools",()=>{
 const data=new Map(),listeners={};
 const localStorage={
   getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)
 };
 const body={innerHTML:"",addEventListener(type,fn){listeners[type]=fn},contains:()=>true,querySelectorAll:()=>[]};
 const classes={add(){},remove(){}};
 const title={textContent:""},eye={textContent:""};
 const panel={classList:classes};
 const document={
   querySelector(sel){
     if(sel==="#panel")return panel;
     if(sel==="#panelBody")return body;
     if(sel==="#panelEyebrow")return eye;
     if(sel==="#panelTitle")return title;
     return null;
   }
 };
 const window={dispatchEvent(){},xyEnsureOverlayHistory(){}};
 const ctx=vm.createContext({window,document,localStorage,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},
   Date,Math,JSON,String,Number,console,openPanel(){},navigator:{},alert(){},confirm(){return true}});
 vm.runInContext(read("quote-favorites.js"),ctx,{filename:"quote-favorites.js"});
 const quoted=window.xyQuoteFavorites;
 assert.ok(quoted);
 const one=quoted.collect("好好生活。",{chatId:"12",messageIndex:3,role:"assistant",characterId:"role-1",characterName:"角色甲",title:"小屋"});
 assert.equal(one.added,true);
 assert.equal(quoted.count(),1);
 const dupe=quoted.collect("好好生活。",{chatId:"12",messageIndex:3,role:"assistant",characterId:"role-1"});
 assert.equal(dupe.added,false);
 quoted.collect("好好生活。",{chatId:"13",messageIndex:2});
 assert.equal(quoted.count(),2,"Same phrase in another chat remains distinct");
 assert.ok(data.has("xy.quoteFavorites.v1"));
 assert.ok(!data.has("xy.memories"),"A quote favorite must never alter persona memory");
 vm.runInContext('openPanel("quotes")',ctx);
 assert.equal(title.textContent,"句子收藏");
 assert.ok(body.innerHTML.includes("原对话"));
 assert.ok(body.innerHTML.includes("工具收藏"));
 const actions=read("message-actions.js");
 assert.ok(actions.includes('data-context-act="favorite-one"'));
 assert.ok(actions.includes("quoteUnits(messageText(m))"));
 const home=read("pearl-home.js"),hub=read("tool-hub.js");
 assert.ok(home.includes('type=window.xyQuoteFavorites?"quotes":"toolhub"'));
 assert.ok(hub.includes('id:"quotes"'));
});
