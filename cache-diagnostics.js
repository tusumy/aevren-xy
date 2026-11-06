(()=>{
  "use strict";
  // Read-only, on-device cache usage telemetry. Never saves prompts, URLs or API keys.
  const KEY="xy.cacheUsage.v1";
  const KEEP=240;
  const AGE_MS=30*24*60*60*1000;

  const num=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
  const first=(...values)=>{for(const value of values){const n=num(value);if(n!==null)return n}return null};
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const format=value=>value===null||value===undefined?"—":Math.round(value).toLocaleString("zh-CN");

  function parseUsage(raw){
    const u=raw&&typeof raw==="object"?raw:null;
    if(!u)return {input:null,output:null,total:null,read:null,write:null};
    const details=u.prompt_tokens_details||u.input_tokens_details||{};
    const writeDetail=u.cache_creation||{};
    const writeBreakdown=num(writeDetail.ephemeral_5m_input_tokens)!==null||num(writeDetail.ephemeral_1h_input_tokens)!==null
      ?(num(writeDetail.ephemeral_5m_input_tokens)||0)+(num(writeDetail.ephemeral_1h_input_tokens)||0):null;
    return {
      input:first(u.prompt_tokens,u.input_tokens),
      output:first(u.completion_tokens,u.output_tokens),
      total:first(u.total_tokens),
      read:first(u.cache_read_input_tokens,details.cached_tokens,u.cached_tokens),
      write:first(u.cache_creation_input_tokens,writeBreakdown)
    };
  }

  function read(){
    try{
      const saved=store.get(KEY,[]);
      if(!Array.isArray(saved))return [];
      const cutoff=Date.now()-AGE_MS;
      return saved.filter(x=>x&&typeof x==="object"&&Number.isFinite(x.at)&&x.at>=cutoff).slice(-KEEP);
    }catch{return []}
  }
  function write(rows){try{store.set(KEY,rows.slice(-KEEP))}catch{}}

  function record(meta,usage){
    if(!meta||!meta.endpointId||!meta.model)return;
    const u=parseUsage(usage);
    const entry={
      at:Date.now(),
      endpointId:String(meta.endpointId),
      model:String(meta.model),
      status:Number(meta.status)||0,
      tools:Math.max(0,Math.trunc(Number(meta.toolCount)||0)),
      input:u.input,output:u.output,total:u.total,read:u.read,write:u.write
    };
    const logs=read();logs.push(entry);write(logs);
    render();
  }

  function render(){
    const panel=document.querySelector("#xyCacheDiagnostics");
    if(!panel)return;
    const selected=window.xyApiHub?.selected?.();
    const endpointId=String(selected?.endpoint?.id||"");
    const model=String(selected?.model||"");
    const all=read();
    const rows=all.filter(x=>x.endpointId===endpointId&&x.model===model);
    const good=rows.filter(x=>x.status>=200&&x.status<300);
    const reported=good.filter(x=>num(x.read)!==null);
    const hits=reported.filter(x=>x.read>0);
    const misses=reported.filter(x=>x.read===0);
    const blind=good.length-reported.length;
    const readTokens=hits.reduce((sum,x)=>sum+x.read,0);
    const writeTokens=good.reduce((sum,x)=>sum+(num(x.write)||0),0);
    const summary=panel.querySelector(".xy-cache-summary small");
    if(summary)summary.textContent=rows.length?`本机记录 ${rows.length} 次 · 缓存可见 ${reported.length} 次`:"免费查看 · 不发起测试请求";
    const title=panel.querySelector("#xyCacheScope");
    if(title)title.textContent=model?`当前：${model} · ${selected.endpoint?.name||"渠道"}`:"尚未选择模型";
    const metrics=panel.querySelector("#xyCacheMetrics");
    if(metrics)metrics.innerHTML=rows.length
      ?`<div><strong>${good.length}</strong><span>成功请求</span></div><div><strong>${hits.length}</strong><span>读缓存命中</span></div><div><strong>${misses.length}</strong><span>报告读缓存为 0</span></div><div><strong>${blind}</strong><span>看不到缓存字段</span></div>`
      :'<p class="xy-cache-empty">这条渠道和模型暂无新记录。从下一次正常聊天开始收集，不会额外调用 API。</p>';
    const note=panel.querySelector("#xyCacheNote");
    if(note)note.textContent=good.length
      ?`已报告读取 ${format(readTokens)} tokens · 写入 ${format(writeTokens)} tokens。仅统计上游明确上报的数字；写入为 0 也可能是字段缺失。冷请求读缓存为 0，不代表通道不支持缓存。`
      :"原有使用量统计没有缓存字段，无法倒推是否命中。失败请求也不会算成缓存未命中。";
    const history=panel.querySelector("#xyCacheHistory");
    if(history)history.innerHTML=rows.slice(-8).reverse().map(x=>{
      const when=new Date(x.at).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
      const result=x.status<200||x.status>=300?`请求失败 HTTP ${x.status||"网络"}`
        :num(x.read)===null?"缓存字段不可见":x.read>0?`读取 ${format(x.read)}`:"报告读取 0";
      const extra=num(x.write)!==null?` · 写入 ${format(x.write)}`:"";
      return `<div class="xy-cache-record"><time>${escapeHtml(when)}</time><span>${escapeHtml(result+extra)}</span><small>${x.tools} 个工具</small></div>`;
    }).join("");
  }

  function inject(){
    const root=document.querySelector("#xyApiHubPanel .xy-hub-content");
    if(!root||root.querySelector("#xyCacheDiagnostics"))return;
    const card=document.createElement("details");
    card.id="xyCacheDiagnostics";
    card.className="xy-cache-diagnostics";
    card.innerHTML='<summary class="xy-cache-summary"><strong>缓存与用量</strong><small>免费查看 · 不发起测试请求</small></summary>'+
      '<div class="xy-cache-content"><p id="xyCacheScope"></p><div id="xyCacheMetrics" class="xy-cache-metrics"></div>'+
      '<p id="xyCacheNote" class="xy-cache-note"></p><div id="xyCacheHistory"></div>'+
      '<p class="xy-cache-footnote">仅在本机保存模型、渠道、状态及 token 计数，不保存消息、密钥或接口地址。不同上游的 token 口径可能不同；这是回执记录，不是缓存能力测试。</p></div>';
    const after=root.querySelector(".xy-hub-channel-panel");
    if(after)after.insertAdjacentElement("afterend",card);
    else root.append(card);
    card.addEventListener("toggle",()=>{if(card.open)render()});
    render();
  }

  const priorOpen=openPanel;
  openPanel=function(type){
    const result=priorOpen(type);
    if(type==="settings")requestAnimationFrame(inject);
    return result;
  };
  window.xyCacheDiagnostics={record,parseUsage,read,render};
})();