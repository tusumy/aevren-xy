/* 砚屿 · MCP tool activity: bounded, redacted previews with no server dependency. */
(()=>{
  "use strict";
  const SECRET_KEY=/(?:api[-_]?key|secret|password|credential|authorization|cookie|session|private|access[-_]?token|refresh[-_]?token|auth|(?:^|[-_])(?:key|token)(?:$|[-_]))/i;
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const mask=value=>String(value??"")
    .replace(/\bBearer\s+[^\s,;"']+/gi,"Bearer [已隐藏]")
    .replace(/\bsk-[a-zA-Z0-9_-]{10,}\b/g,"[已隐藏]")
    .replace(/([?&](?:api_?key|token|secret|password|authorization)=)[^&#\s]+/gi,"$1[已隐藏]")
    .replace(/\b((?:api[-_ ]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;"']+/gi,"$1[已隐藏]")
    .replace(/data:(?:image|audio|application)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi,"[媒体数据已隐藏]");

  function redact(value,depth=0){
    if(value==null||typeof value==="number"||typeof value==="boolean")return value;
    if(typeof value==="string")return mask(value.slice(0,1800));
    if(depth>=4)return "[内容已折叠]";
    if(Array.isArray(value)){
      const list=value.slice(0,12).map(item=>redact(item,depth+1));
      if(value.length>12)list.push("…另有 "+(value.length-12)+" 项");
      return list;
    }
    if(typeof value==="object"){
      const out={};
      const keys=Object.keys(value).slice(0,24);
      for(const key of keys)out[key]=SECRET_KEY.test(key)?"[已隐藏]":redact(value[key],depth+1);
      if(Object.keys(value).length>24)out["…"]="其余字段已折叠";
      return out;
    }
    return String(value);
  }
  function preview(value){
    if(value==null)return "";
    let source=value;
    if(typeof value==="string"&&/^[\[{]/.test(value.trim())){
      try{source=JSON.parse(value)}catch{}
    }
    let result="";
    try{result=typeof source==="string"?mask(source):JSON.stringify(redact(source),null,2)}
    catch{result="[无法预览结果]"}
    const LIMIT=850;
    return result.length>LIMIT?result.slice(0,LIMIT)+"…":result;
  }
  const statusOf=step=>step.status==="error"?"失败":step.status==="done"?"完成":"执行中";
  function render(steps,live=false){
    if(!Array.isArray(steps)||!steps.length)return "";
    const failures=steps.filter(s=>s?.status==="error").length;
    const running=steps.some(s=>s?.status==="running");
    const state=running?"执行中":failures?failures+" 项失败":"已完成";
    const items=steps.slice(0,24).map((step,i)=>{
      const start=Number(step.startedAt)||0,end=Number(step.finishedAt)||0;
      const duration=end&&start?'<small>'+Math.max(0,end-start)+'ms</small>':"";
      const argumentsHtml=step.argsPreview?'<div class="xy-tool-field"><b>调用参数（已隐藏敏感字段）</b><pre>'+esc(step.argsPreview)+'</pre></div>':"";
      const resultHtml=step.resultPreview?'<div class="xy-tool-field"><b>结果摘要</b><pre>'+esc(step.resultPreview)+'</pre></div>':"";
      return '<details class="xy-tool-step"><summary><span class="xy-tool-step-index">'+(i+1)+'</span><span class="xy-tool-step-name">'+esc(step.name||"MCP 工具")+'</span><span class="xy-tool-step-state" data-state="'+esc(step.status||"running")+'">'+statusOf(step)+'</span></summary><div class="xy-tool-step-detail"><small>来源 · '+esc(step.server||"MCP")+'</small>'+duration+argumentsHtml+resultHtml+'</div></details>';
    }).join("");
    return '<details class="xy-tool-trace" '+(live?'open':"")+'><summary><span class="xy-tool-trace-glyph" aria-hidden="true">✦</span><span>工具记录 · '+steps.length+' 步</span><small>'+state+'</small></summary><div class="xy-tool-trace-body">'+items+'</div></details>';
  }
  function renderLive(target,steps){
    const active=typeof chat==="function"?chat():null;
    if(!active||String(active.id)!==String(target?.id))return;
    const bubble=document.querySelector("#messages #typing .bubble");
    if(!bubble)return;
    let root=bubble.querySelector(".xy-tool-live");
    if(!root){root=document.createElement("div");root.className="xy-tool-live";bubble.appendChild(root)}
    root.innerHTML=render(steps,true);
  }
  window.xyToolActivity={preview,renderSaved:steps=>render(steps,false),renderLive};
})();