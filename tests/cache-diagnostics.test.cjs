const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const source=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function build(fetchImpl){
  const db=new Map();
  const endpoints=[{id:"ep1",name:"Test route",base:"https://example.invalid/v1",key:"SECRET",model:"claude-test",models:["claude-test"]}];
  const ctx={
    window:{AevrenApiCompat:{completeChatEndpoint:base=>base+"/chat/completions"}},
    document:{querySelector:()=>null},
    endpoints,
    store:{get:(k,fallback)=>db.has(k)?db.get(k):fallback,set:(k,v)=>db.set(k,v)},
    openPanel:()=>{},requestAnimationFrame:()=>{},renderMessages:()=>{},
    chat:()=>({id:1}),save:()=>{},
    performance:{now:()=>Date.now()},
    fetch:fetchImpl,
    Date,URL,Error,Number,String,Map,Set,Array,Math,JSON
  };
  vm.runInNewContext(source("api-hub.js"),ctx);
  vm.runInNewContext(source("cache-diagnostics.js"),ctx);
  return {ctx,db,endpoints,diagnostics:ctx.window.xyCacheDiagnostics};
}

test("Anthropic and OpenAI cache read/write fields are parsed without inventing missing zeros",()=>{
  const {diagnostics}=build(async()=>{});
  const anth=diagnostics.parseUsage({
    input_tokens:100,output_tokens:20,cache_creation_input_tokens:1200,cache_read_input_tokens:0
  });
  assert.equal(anth.read,0);
  assert.equal(anth.write,1200);
  assert.equal(anth.input,100);
  const openai=diagnostics.parseUsage({
    prompt_tokens:300,completion_tokens:12,prompt_tokens_details:{cached_tokens:260}
  });
  assert.equal(openai.read,260);
  assert.equal(openai.write,null);
  const unknown=diagnostics.parseUsage({prompt_tokens:400,completion_tokens:13});
  assert.equal(unknown.read,null);
  assert.equal(unknown.write,null);
  assert.equal(diagnostics.parseUsage(null).read,null);
});

test("real conversation receipts are recorded locally; no test request or secrets stored",async()=>{
  let requests=0;
  const usage={input_tokens:14,output_tokens:7,cache_read_input_tokens:900,cache_creation_input_tokens:0};
  const {ctx,endpoints,diagnostics,db}=build(async(url,opts)=>{
    requests++;
    assert.equal(opts.headers.Authorization,"Bearer SECRET");
    return {ok:true,status:200,clone(){return {json:async()=>({usage})}}};
  });
  await ctx.window.xyApiHub.sendChat(endpoints[0],{model:"claude-test",messages:[],tools:[{type:"function"}]});
  assert.equal(requests,1);
  const records=diagnostics.read();
  assert.equal(records.length,1);
  assert.equal(records[0].read,900);
  assert.equal(records[0].tools,1);
  assert.equal(records[0].write,0);
  assert.equal(records[0].endpointId,"ep1");
  const raw=JSON.stringify(db.get("xy.cacheUsage.v1"));
  assert.doesNotMatch(raw,/SECRET|example\\.invalid|messages|Authorization/);
});

test("missing usage and failed requests remain unknown rather than false cache misses",async()=>{
  const {ctx,endpoints,diagnostics}=build(async()=>({ok:false,status:503,clone(){throw Error("should not parse")}}));
  await ctx.window.xyApiHub.sendChat(endpoints[0],{model:"claude-test",messages:[]});
  const rows=diagnostics.read();
  assert.equal(rows.length,1);
  assert.equal(rows[0].status,503);
  assert.equal(rows[0].read,null);
});

test("MCP tools are emitted in stable order without modifying the saved list",()=>{
  const server={id:"s1",enabled:true,url:"https://example.invalid/mcp",name:"MCP",tools:[
    {name:"zeta",description:"z",inputSchema:{type:"object",properties:{}}},
    {name:"alpha",description:"a",inputSchema:{type:"object",properties:{}}}
  ]};
  const ctx={
    window:{},mcps:[server],openPanel:()=>{},requestAnimationFrame:()=>{},
    save:()=>{},mcpTools:()=>({out:[],map:{}}),callMcpTool:async()=>{},
    Array,String,Date,Object,JSON,Map,Set,Number,Error,Promise,Math
  };
  vm.runInNewContext(source("mcp-runtime.js"),ctx);
  const first=ctx.mcpTools().out.map(x=>x.function.name);
  server.tools.reverse();
  const second=ctx.mcpTools().out.map(x=>x.function.name);
  assert.deepEqual(Array.from(first),["mcp_0_alpha","mcp_0_zeta"]);
  assert.deepEqual(Array.from(second),Array.from(first));
  assert.equal(server.tools[0].name,"alpha");
});
