const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","call-core.js"),"utf8");

function fakeCall(){
 let time=0,nextTimer=1,observer=null,cancelled=0,recognizeCalls=0;
 const timers=new Map(),nodes=new Map(),chat={id:3,messages:[]};
 const classes=()=>({add(){},remove(){},toggle(){}});
 const element=tag=>({
   tag,hidden:false,style:{},classList:classes(),innerHTML:"",textContent:"",value:"",
   children:[],scrollHeight:0,scrollTop:0,
   setAttribute(){},append(...els){this.children.push(...els)},appendChild(el){this.children.push(el)},
   querySelector(sel){
     if(sel==="span")return this.children.find(x=>x.tag==="span")||
       (this.children[0]||(this.children[0]=element("span")));
     if(sel==="input"||sel==="button")return this[sel]||(this[sel]=element(sel));
     return null;
   }
 });
 const overlay=element("overlay");
 for(const sel of [".xy-call-card",".xy-call-avatar",".xy-call-name",".xy-call-status",
   ".xy-call-time",".xy-call-transcript",".xy-call-answer",".xy-call-hangup",
   ".xy-call-fallback",".xy-call-push",".xy-call-mode"])nodes.set(sel,element(sel));
 overlay.querySelector=sel=>nodes.get(sel)||null;
 nodes.get(".xy-call-fallback").input=element("input");
 nodes.get(".xy-call-fallback").button=element("button");
 nodes.get(".xy-call-avatar").children=[element("span")];
 nodes.get(".xy-call-push").children=[element("span")];
 nodes.get(".xy-call-mode").children=[element("span")];
 let divCount=0;
 const doc={
   createElement:tag=>tag==="div"&&divCount++===0?overlay:element(tag),
   body:{appendChild(){}},querySelector(){return null}
 };
 const setTimeoutFake=(fn,delay=0)=>{
   const id=nextTimer++;timers.set(id,{fn,at:time+delay});return id;
 };
 function advance(ms){
   const end=time+ms;
   for(let loops=0;loops<150;loops++){
     const pending=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,t])=>t.at<=end);
     if(!pending){time=end;return}
     time=pending[1].at;timers.delete(pending[0]);pending[1].fn();
   }
   throw Error("timer loop");
 }
 const win={
   xyCurrentCharacter:()=>({id:"person-1",name:"玄砚"}),
   AevrenVoice:{
     hasNativeRecognition:()=>true,
     onRecognitionProgress:cb=>{observer=cb},
     cancelNativeRecognition:()=>{cancelled++},
     recognizeNativeOnce:()=>{recognizeCalls++;return new Promise(()=>{})},
     isSpeaking:()=>false,hasNativeCapture:()=>false
   },
   AevrenApiCompat:{
     send:async({text})=>{
       chat.messages.push({role:"user",text});
       chat.messages.push({role:"assistant",text:"听见了"});
     }
   }
 };
 const ctx=vm.createContext({
   document:doc,window:win,navigator:{vibrate(){}},
   chat:()=>chat,save(){},renderChats(){},renderMessages(){},
   setTimeout:setTimeoutFake,clearTimeout:id=>timers.delete(id),
   setInterval:()=>1,clearInterval(){},Date,Math,Number,String,
   Blob,Promise,JSON,console
 });
 vm.runInContext(source,ctx,{filename:"call-core.js"});
 return {win,nodes,chat,advance,get observer(){return observer},
   get cancelled(){return cancelled},get recognizeCalls(){return recognizeCalls}};
}

test("native recognizer stuck at starting falls back to usable manual and typed input",async()=>{
 const h=fakeCall();
 h.win.AevrenCall.ring();
 await h.win.AevrenCall.answer();
 assert.equal(h.nodes.get(".xy-call-mode").hidden,false);
 assert.equal(h.nodes.get(".xy-call-push").hidden,true);
 h.advance(450);
 assert.equal(h.recognizeCalls,1);
 h.advance(9000);
 assert.equal(h.nodes.get(".xy-call-push").hidden,false);
 assert.equal(h.nodes.get(".xy-call-fallback").hidden,false);
 assert.equal(h.nodes.get(".xy-call-mode").children[0].textContent,"重试自动识别");
 assert.match(h.nodes.get(".xy-call-status").textContent,/没有响应/);
 h.advance(40000);
 assert.equal(h.recognizeCalls,1,"No infinite STT loop");
 h.nodes.get(".xy-call-fallback").input.value="你能听见吗？";
 h.nodes.get(".xy-call-fallback").button.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.chat.messages[0]?.text,"你能听见吗？");
 assert.equal(h.chat.messages[1]?.text,"听见了");
 assert.equal(h.nodes.get(".xy-call-fallback").hidden,false);
});

test("manual switch works immediately and can retry automatic speech",async()=>{
 const h=fakeCall();
 h.win.AevrenCall.ring();await h.win.AevrenCall.answer();
 const switcher=h.nodes.get(".xy-call-mode");
 switcher.onclick();
 assert.equal(h.nodes.get(".xy-call-fallback").hidden,false);
 assert.equal(h.nodes.get(".xy-call-push").hidden,false);
 switcher.onclick();
 assert.equal(h.nodes.get(".xy-call-fallback").hidden,true);
 assert.equal(switcher.children[0].textContent,"改用按键说话");
 h.advance(450);assert.equal(h.recognizeCalls,1);
 h.observer?.({stage:"state",detail:"ready"});
 h.advance(9000);
 assert.equal(h.nodes.get(".xy-call-push").hidden,true,"Ready event clears startup watchdog");
 switcher.onclick();
 assert.equal(h.nodes.get(".xy-call-fallback").hidden,false);
 assert.ok(h.cancelled>=2);
});

test("call startup watchdog and manual controls do not modify original call semantics",()=>{
 new vm.Script(source,{filename:"call-core.js"});
 for(const token of ["xy-call-mode","modeBtn.onclick","nativeReadyTimer=setTimeout",
   "nativeTimeouts>=2","else if(!forceRecordedStt&&SpeechRecognition)startListening()",
   "acceptBtn.onclick=answer;hangupBtn.onclick=hangup;","pushBtn.onclick="]){
   assert.ok(source.includes(token),"Missing "+token);
 }
});
