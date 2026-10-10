(()=>{
 const KEY="xy.visionFallback.v1";
 const get=()=>{try{return {...{endpointId:"",auto:true,detail:"balanced"},...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {endpointId:"",auto:true,detail:"balanced"}}};
 const chosen=()=>{const cfg=get();return cfg.mode==="custom"?{...cfg.custom,vision:true}:endpoints.find(e=>String(e.id)===String(cfg.endpointId))};
 const available=()=>{const e=chosen();return !!(e?.base&&e?.model&&e?.vision===true)};
 const modeMap={balanced:"简要描述图片中可见的事物、画面文字和重要细节，勿臆测。",detailed:"细致分析图片的场景、人物动作、物品、布局和可见文字，只描述确实可见的内容；模糊的部分要明确说明。",ocr:"重点逐字提取图像中的可见文字，保留顺序；再简要说明图像内容。"};
 function endpoint(raw){
   const url=String(raw||"").trim().replace(/\/$/,"");
   if(!url)return "";
   if(/\/(?:chat\/completions|responses)$/i.test(url))return url;
   if(/\/v1$/i.test(url))return url+"/chat/completions";
   try{if(new URL(url).pathname==="/")return url+"/v1/chat/completions"}catch{}
   return url;
 }
 function toText(data){
   const content=data?.choices?.[0]?.message?.content??data?.output_text;
   if(typeof content==="string")return content.trim();
   if(Array.isArray(content))return content.map(p=>p?.text||"").join("\n").trim();
   return "";
 }
 async function describe(items){
   const ep=chosen();if(!available())throw new Error("请先在接口设置选择一个支持图片的备用视觉模型");
   const images=(items||[]).filter(a=>a?.kind==="image");
   if(!images.length)return "";
   try{await window.xyImagePayload?.hydrate?.([{attachments:images}])}catch{}
   if(images.some(a=>!a.dataUrl))throw new Error("找不到图片原始内容，请重新选图");
   const parts=[{type:"text",text:(modeMap[get().detail]||modeMap.balanced)+"。你负责独立识图；不要扮演聊天角色，不要编造图外信息。"}];
   images.forEach((a,i)=>{parts.push({type:"text",text:"图片 "+(i+1)});parts.push({type:"image_url",image_url:{url:a.dataUrl}})});
   const head={"Content-Type":"application/json",Accept:"application/json"};
   if(ep.key)head.Authorization="Bearer "+ep.key;
   let url=endpoint(ep.base),payload={model:ep.model,messages:[{role:"user",content:parts}],stream:false};
   if(get().mode==="custom"&&ep.protocol==="gemini"){
     const root=String(ep.base||"").replace(/\/$/,"");
     url=root+"/models/"+encodeURIComponent(ep.model)+":generateContent";
     head["x-goog-api-key"]=ep.key||"";
     delete head.Authorization;
     payload={contents:[{role:"user",parts:parts.map(p=>p.type==="image_url"?{inlineData:{mimeType:p.image_url.url.match(/^data:([^;]+);/)?.[1]||"image/jpeg",data:p.image_url.url.split(",")[1]}}:{text:p.text})}]};
   } else if(get().mode==="custom"&&ep.protocol==="anthropic"){
     url=String(ep.base||"").replace(/\/$/,"")+"/messages";
     head["x-api-key"]=ep.key||"";head["anthropic-version"]="2023-06-01";delete head.Authorization;
     payload={model:ep.model,max_tokens:2048,messages:[{role:"user",content:parts.map(p=>p.type==="image_url"?{type:"image",source:{type:"base64",media_type:p.image_url.url.match(/^data:([^;]+);/)?.[1]||"image/jpeg",data:p.image_url.url.split(",")[1]}}:p)}]};
   }
   const res=await fetch(url,{method:"POST",headers:head,body:JSON.stringify(payload)});
   let data;const raw=await res.text();try{data=JSON.parse(raw)}catch{throw new Error("备用视觉接口未返回 JSON（HTTP "+res.status+"）")}
   if(!res.ok)throw new Error("备用视觉 HTTP "+res.status+"："+String(data?.error?.message||data?.message||"请求失败").slice(0,140));
   const text=toText(data)||(Array.isArray(data?.candidates)?data.candidates[0]?.content?.parts?.map(p=>p.text||"").join("\n"):"")||(Array.isArray(data?.content)?data.content.map(p=>p.text||"").join("\n"):"");
   if(!text)throw new Error("备用视觉模型未返回可用的图片描述");
   const summary=text.slice(0,7000);
   images.forEach((a,i)=>{a.visionDescription=i===0?summary:""});
   return summary;
 }
 function wantsFallback(){return available()&&get().auto}
 function forSend(){return !!window.xyNextVisualFallback || wantsFallback()}
 function sync(){
   const ui=document.querySelector("#xyFallbackSelect");
   if(!ui)return;
   const opts=get(),list=endpoints.filter(e=>e.vision===true);
   ui.replaceChildren();
   const none=document.createElement("option");none.value="";none.textContent="不设置";ui.appendChild(none);
   list.forEach(ep=>{const el=document.createElement("option");el.value=String(ep.id);el.textContent=(ep.name||"接口")+" · "+ep.model;ui.appendChild(el)});
   ui.value=opts.endpointId;
   const mode=document.querySelector("#xyFallbackMode");if(mode)mode.value=opts.mode||"existing";
   for(const [field,value] of Object.entries(opts.custom||{})){const el=document.querySelector("#xyBackup"+field.charAt(0).toUpperCase()+field.slice(1));if(el)el.value=value}
   document.querySelector("#xyBackupCustomFields")?.toggleAttribute("hidden",(opts.mode||"existing")!=="custom");
   document.querySelector("#xyFallbackAuto").checked=!!opts.auto;
   document.querySelector("#xyFallbackDetail").value=opts.detail;
 }
 function renderSettings(){
   const body=document.querySelector("#panelBody"),list=body?.querySelector("#endpointList");
   if(!list||body.querySelector("#xyFallbackPanel"))return;
   const panel=document.createElement("div");panel.id="xyFallbackPanel";panel.style.cssText="margin:16px 0;padding:14px;border:1px solid #aabbb055;border-radius:13px;font-size:12px;color:#526157";
   panel.innerHTML='<strong style="display:block;margin-bottom:8px">备用视觉模型</strong><label style="display:block;margin:8px 0">接口来源 <select id="xyFallbackMode"><option value="existing">已有接口</option><option value="custom">自定义视觉接口</option></select></label><div id="xyBackupCustomFields" hidden style="display:grid;gap:7px;margin:8px 0"><select id="xyBackupProtocol"><option value="openai">OpenAI 兼容</option><option value="gemini">Gemini</option><option value="anthropic">Anthropic</option></select><input id="xyBackupBase" placeholder="Base URL（例：https://api.example.com/v1）"><input id="xyBackupKey" type="password" placeholder="API Key"><input id="xyBackupModel" placeholder="视觉模型名称"></div><p style="font-size:11px;opacity:.78">先给一个真正支持看图的接口开启「视觉」，然后在这里选它。主聊天角色和接口保持不变。</p><select id="xyFallbackSelect" style="width:100%;padding:9px;border:1px solid #bac7bc;border-radius:9px;background:#fff"></select><label style="display:flex;gap:8px;align-items:center;margin:11px 0"><input type="checkbox" id="xyFallbackAuto"> 当前模型仅文本时自动使用备用视觉</label><label style="display:block;margin-bottom:5px">分析方式</label><select id="xyFallbackDetail" style="width:100%;padding:8px;margin-bottom:9px;border:1px solid #bac7bc;border-radius:9px;background:#fff"><option value="balanced">简洁描述</option><option value="detailed">详细分析</option><option value="ocr">文字识别优先</option></select><button id="xyFallbackSave" type="button" style="padding:8px 14px;border-radius:9px;border:1px solid #bac7bc;background:#f8faf8">保存备用视觉设置</button>';
   list.parentElement.insertBefore(panel,list.nextSibling);
   sync();
   panel.querySelector("#xyFallbackMode").onchange=e=>panel.querySelector("#xyBackupCustomFields").hidden=e.target.value!=="custom";
   panel.querySelector("#xyFallbackSave").onclick=()=>{
     const custom={protocol:uiValue("#xyBackupProtocol"),base:uiValue("#xyBackupBase").trim(),key:uiValue("#xyBackupKey").trim(),model:uiValue("#xyBackupModel").trim()};
     const mode=uiValue("#xyFallbackMode");
     if(mode==="custom"&&(!custom.base||!custom.model)){window.xyAttachments?.toast?.("请填写视觉 Base URL 和模型名",true);return}
     localStorage.setItem(KEY,JSON.stringify({mode,custom,endpointId:uiValue("#xyFallbackSelect"),auto:!!panel.querySelector("#xyFallbackAuto").checked,detail:uiValue("#xyFallbackDetail")}));
     window.xyAttachments?.toast?.("备用视觉设置已保存");
   };
 }
 const uiValue=selector=>document.querySelector(selector)?.value||"";
 const oldOpen=openPanel;
 openPanel=function(type){const ret=oldOpen(type);if(type==="settings")renderSettings();return ret};
 document.addEventListener("click",e=>{
   if(e.target.closest?.(".edit-endpoint,.endpoint-card,#saveEndpoint,#addEndpoint"))queueMicrotask(()=>{if(document.querySelector("#xyFallbackPanel"))sync()});
 },true);
 // Explicit use for the next image submission, without changing the selected main model.
 document.addEventListener("click",e=>{
   const button=e.target.closest?.("#xyUseBackupVision");if(!button)return;
   if(!available()){window.xyAttachments?.toast?.("请先在接口设置选好备用视觉模型",true);return}
   window.xyNextVisualFallback=!window.xyNextVisualFallback;
   button.textContent=window.xyNextVisualFallback?"✓ 使用备用视觉":"用备用视觉";
 });
 const oldBadge=window.xyVision?.updateBadge;
 if(oldBadge)window.xyVision.updateBadge=()=>{oldBadge();const label=document.querySelector("#xyVisionIndicator");if(label&&!window.xyVision.enabled()&&available())label.textContent="备用视觉可用"};
 window.xyVisionFallback={available,wantsFallback,forSend,describe,config:get};
})();