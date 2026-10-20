const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function buildHub(fetchImpl) {
  const db = new Map();
  const endpoints = [
    {id:'a',name:'Primary',base:'https://primary.example/v1',key:'KEY_A',model:'same',models:['same']},
    {id:'b',name:'Backup',base:'https://backup.example/v1',key:'KEY_B',model:'different',models:['same','different']},
    {id:'c',name:'Other',base:'https://other.example/v1',key:'KEY_C',model:'other-only'}
  ];
  const currentChat = {id:1,xyApiChoice:{endpointId:'a',model:'same'}};
  const context = {
    window:{AevrenApiCompat:{completeChatEndpoint:base=>base+'/chat/completions'}},
    document:{querySelector:()=>null},
    endpoints,
    store:{get:(k,def)=>db.get(k)??def,set:(k,value)=>db.set(k,value)},
    openPanel:()=>{},
    renderMessages:()=>{},
    chat:()=>currentChat,
    save:()=>{},
    performance:{now:()=>Date.now()},
    fetch:fetchImpl,
    Date,URL,Error,Number,String,Map,Set,Array,Math,JSON
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','api-hub.js'),'utf8'),context);
  return {hub:context.window.xyApiHub,db,endpoints,currentChat};
}
function mockResponse(status,usage=12){
  return {ok:status>=200&&status<300,status,
    clone(){return {json:async()=>({usage:{total_tokens:usage}})}}};
}
test('fails over only to another channel with the same exact model name',async()=>{
  const requests=[];
  const {hub,endpoints,db}=buildHub(async(url,options)=>{
    requests.push({url,key:options.headers.Authorization,model:JSON.parse(options.body).model});
    return mockResponse(url.includes('primary')?429:200);
  });
  const answer=await hub.sendChat(endpoints[0],{model:'same',messages:[]});
  assert.equal(answer.routeId,'b');
  assert.deepEqual(requests.map(x=>x.key),['Bearer KEY_A','Bearer KEY_B']);
  assert.deepEqual(requests.map(x=>x.model),['same','same']);
  const stats=db.get('xy.apiHub.stats.v1');
  assert.equal(stats.length,2);
  assert.equal(stats[1].tokens,12);
  assert.equal(JSON.stringify(stats).includes('KEY_A'),false);
});
test('never substitutes a different model after a failure',async()=>{
  const requests=[];
  const {hub,endpoints}=buildHub(async(url)=>{
    requests.push(url);
    return mockResponse(503);
  });
  const answer=await hub.sendChat(endpoints[2],{model:'other-only',messages:[]});
  assert.equal(answer.res.status,503);
  assert.equal(requests.length,1);
});
test('respects each chat model selection instead of changing the global default',()=>{
  const {hub,endpoints,currentChat}=buildHub(async()=>mockResponse(200));
  assert.equal(hub.resolveEndpoint(currentChat).id,'a');
  assert.equal(hub.resolveEndpoint(currentChat).model,'same');
  currentChat.xyApiChoice={endpointId:'b',model:'different'};
  assert.equal(hub.resolveEndpoint(currentChat).model,'different');
  assert.equal(endpoints[0].model,'same');
});
test('does not retry invalid parameters or authorization failures',async()=>{
  for(const status of [400,401,403,422]){
    const urls=[];
    const {hub,endpoints}=buildHub(async(url)=>{urls.push(url);return mockResponse(status)});
    const answer=await hub.sendChat(endpoints[0],{model:'same',messages:[]});
    assert.equal(answer.res.status,status);
    assert.equal(urls.length,1);
  }
});
test('preserves configured route order and supports sticky tool rounds',async()=>{
  const calls=[];
  const {hub,endpoints,db}=buildHub(async(url)=>{calls.push(url);return mockResponse(200)});
  db.set('xy.apiHub.routes.v1',{same:['b','a']});
  const answer=await hub.sendChat(endpoints[0],{model:'same',messages:[]},'b');
  assert.equal(answer.routeId,'b');
  assert.equal(calls.length,1);
  assert.match(calls[0],/backup/);
});

test('model controls live only in a compact, initially closed settings disclosure',()=>{
  let removed=0,created=0,section=null;
  const db=new Map();
  const currentChat={id:1};
  const endpoints=[{id:'a',name:'Primary',base:'https://primary.example/v1',key:'KEY_A',model:'same',models:['same']}];
  const values=new Map();
  const listener={};
  const list={insertAdjacentElement:(_position,element)=>{section=element}};
  const body={querySelector:selector=>selector==='#endpointList'?list:selector==='#xyApiHubPanel'?section:null};
  const doc={
    querySelector(selector){
      if(selector==='#xyModelQuickSwitch')return {remove:()=>{removed++}};
      if(selector==='#panelBody')return body;
      if(selector==='#xyApiHubPanel')return section;
      return null;
    },
    createElement(tag){
      created++;assert.equal(tag,'details');
      return {tagName:tag,open:false,addEventListener:(type,fn)=>listener[type]=fn,
        querySelector(selector){
          if(!values.has(selector))values.set(selector,{checked:false,value:'',textContent:'',innerHTML:''});
          return values.get(selector);
        }};
    }
  };
  const ctx={
    window:{AevrenApiCompat:{completeChatEndpoint:base=>base+'/chat/completions'}},
    document:doc,endpoints,
    store:{get:(key,def)=>db.get(key)??def,set:(key,value)=>db.set(key,value)},
    openPanel:()=>{},
    renderMessages:()=>{},chat:()=>currentChat,save:()=>{},
    requestAnimationFrame:fn=>fn(),performance:{now:()=>Date.now()},
    fetch:async()=>mockResponse(200),Date,URL,Error,Number,String,Map,Set,Array,Math,JSON
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','api-hub.js'),'utf8'),ctx);
  assert.equal(removed,1);
  ctx.openPanel('settings');
  assert.equal(created,1);
  assert.equal(section.tagName,'details');
  assert.equal(section.open,false);
  assert.match(section.innerHTML,/^<summary class="xy-hub-summary">/);
  assert.match(section.innerHTML,/id="xyHubCurrent"/);
  assert.equal(values.get('#xyHubCount').textContent,'1 个模型');
  listener.click({target:{closest:()=>({
    dataset:{ep:'a',model:'same'},
    classList:{contains:()=>false}
  })}});
  assert.equal(currentChat.xyApiChoice.model,'same');
  assert.equal(section.open,false);
});
