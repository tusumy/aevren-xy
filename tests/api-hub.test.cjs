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
