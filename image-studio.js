(()=>{
"use strict";
const CONFIG_KEY="xy.imageStudio.config.v1";
const HISTORY_KEY="xy.imageStudio.history.v1";
const $=(sel,root=document)=>root.querySelector(sel);
const defaultConfig={mode:"existing",endpointId:"",base:"",key:"",model:"",size:"1024x1024"};
let promptDraft="",working=false,lastImage=null,referenceFile=null;
const loadConfig=()=>{try{return {...defaultConfig,...JSON.parse(localStorage.getItem(CONFIG_KEY)||"{}")}}catch{return {...defaultConfig}}};
const readHistory=()=>{try{const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(h)?h.filter(x=>x&&x.mediaKey).slice(0,24):[]}catch{return []}};
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function imageEndpoint(raw,reference=false){
  let input=String(raw||"").trim().replace(/\/+$/,"");
  if(!/^https?:\/\//i.test(input))throw new Error("接口地址必须以 http:// 或 https:// 开头");
  const url=new URL(input);
  if(!url.hostname)throw new Error("接口地址无效");
  // Respect custom gateway roots, but replace known chat/image method suffixes.
  let path=url.pathname.replace(/\/+$/,"");
  path=path.replace(/\/(?:chat\/completions|responses|images\/(?:generations|edits))$/i,"");
  if(!/\/v1$/i.test(path))path+=(path?"/v1":"/v1");
  url.pathname=path+(reference?"/images/edits":"/images/generations");
  url.search="";
  url.hash="";
  return url.toString();
}
const openEndpoints=()=>typeof endpoints!=="undefined"&&Array.isArray(endpoints)?endpoints:[];
function selectedConfig(root){
  const mode=$("#xyImagineSource",root).value;
  const cfg={mode,endpointId:$("#xyImagineEndpoint",root).value,base:$("#xyImagineBase",root).value.trim(),
    key:$("#xyImagineKey",root).value.trim(),model:$("#xyImagineModel",root).value.trim(),size:$("#xyImagineSize",root).value};
  const ep=openEndpoints().find(x=>String(x.id)===cfg.endpointId);
  if(mode==="existing"&&!ep)throw new Error("先选择一个已经配置的接口");
  if(mode==="existing"&&String(ep?.protocol||"openai")!=="openai")throw new Error("这个接口不是 OpenAI 兼容模式。请在自定义图像接口填写支持生图的地址。");
  const base=mode==="existing"?String(ep.base||""):cfg.base;
  const key=mode==="existing"?String(ep.key||""):cfg.key;
  if(!base)throw new Error("请填写接口地址");
  if(!cfg.model)throw new Error("请填写支持图片生成的模型名称");
  const url=imageEndpoint(base,!!referenceFile);
  return {cfg,key,url};
}
function setStatus(root,message,isError=false){
  if(!root?.isConnected)return;
  const host=$("#xyImagineStatus",root);
  if(host){host.textContent=message;host.dataset.error=isError?"1":"0";}
}
function updateMode(root){
  const custom=$("#xyImagineCustom",root);
  const existing=$("#xyImagineExisting",root);
  const customMode=$("#xyImagineSource",root).value==="custom";
  custom.hidden=!customMode;existing.hidden=customMode;
}
function persist(root){
  const config={mode:$("#xyImagineSource",root).value,endpointId:$("#xyImagineEndpoint",root).value,
   base:$("#xyImagineBase",root).value.trim(),key:$("#xyImagineKey",root).value.trim(),
   model:$("#xyImagineModel",root).value.trim(),size:$("#xyImagineSize",root).value};
  localStorage.setItem(CONFIG_KEY,JSON.stringify(config));
}
function dataUrlOfBlob(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("读取生成图片失败"));
    reader.readAsDataURL(blob);
  });
}
async function resultImage(json){
  const part=json?.data?.[0]||json?.images?.[0]||null;
  if(!part)throw new Error(json?.error?.message||"接口没有返回图片，请检查模型与请求格式");
  const encoded=part.b64_json||part.b64||part.image_base64;
  if(typeof encoded==="string"&&encoded.length){
    const mime=encoded.startsWith("UklGR")?"image/webp":encoded.startsWith("/9j/")?"image/jpeg":"image/png";
    return {src:"data:"+mime+";base64,"+encoded,persistable:true};
  }
  const url=part.url||part.image_url;
  if(typeof url==="string"&&/^https?:\/\//i.test(url)){
    try{
      const res=await fetch(url);
      if(!res.ok)throw new Error("无法下载图片");
      const blob=await res.blob();
      if(!blob.type.startsWith("image/")||blob.size>18*1024*1024)throw new Error("图片格式或大小不受支持");
      return {src:await dataUrlOfBlob(blob),persistable:true};
    }catch{
      // Some providers host returned URLs without CORS. Preview still works,
      // but the image cannot be archived locally from a cross-origin URL.
      return {src:url,persistable:false};
    }
  }
  throw new Error("接口响应没有 b64_json 或图片 URL");
}
async function archiveImage(src,prompt,model,size){
  const item={kind:"image",name:"砚屿生图",type:src.slice(5,src.indexOf(";")),dataUrl:src};
  await window.xyImagePayload?.archive?.([item]);
  if(!item.mediaKey)throw new Error("本机图像存储不可用");
  const entry={id:"imagine-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
    mediaKey:item.mediaKey,prompt:prompt.slice(0,800),model,size,at:Date.now()};
  const history=[entry,...readHistory()].slice(0,24);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  return entry;
}
function updateResult(root,src,message){
  if(!root?.isConnected)return;
  const area=$("#xyImagineResult",root),img=$("#xyImaginePreview",root);
  area.hidden=false;
  img.src=src;
  const note=$("#xyImagineResultNote",root);
  note.textContent=message;
  setStatus(root,message);
}
async function showGallery(root){
  if(!root?.isConnected)return;
  const list=$("#xyImagineGallery",root),history=readHistory();
  list.replaceChildren();
  $("#xyImagineGalleryCount",root).textContent=history.length+" 张";
  if(!history.length){
    const empty=document.createElement("p");
    empty.className="xy-imagine-empty";
    empty.textContent="画册还空着，第一张画从这里开始。";
    list.append(empty);return;
  }
  for(const item of history){
    const card=document.createElement("button");
    card.type="button";card.className="xy-imagine-thumb";
    const image=document.createElement("img");
    image.loading="lazy";image.alt="生成作品："+item.prompt.slice(0,50);
    const caption=document.createElement("span");caption.textContent=item.prompt||"未命名作品";
    card.append(image,caption);list.append(card);
    card.addEventListener("click",()=>{if(image.getAttribute("src"))window.xyOpenImagePreview?.(image.src)});
    (async()=>{
      const holder={attachments:[{kind:"image",mediaKey:item.mediaKey}]};
      try{await window.xyImagePayload?.hydrate?.([holder])}catch{}
      if(root.isConnected&&card.isConnected&&holder.attachments[0].dataUrl)image.src=holder.attachments[0].dataUrl;
      else if(card.isConnected)card.classList.add("is-missing");
    })();
  }
}
async function generate(root){
  if(working)return;
  const prompt=$("#xyImaginePrompt",root).value.trim();
  if(!prompt){setStatus(root,"先写想画什么。",true);$("#xyImaginePrompt",root).focus();return}
  if(prompt.length>4000){setStatus(root,"提示词请控制在 4000 字以内。",true);return}
  let selected;
  try{selected=selectedConfig(root);persist(root)}catch(err){setStatus(root,err.message,true);return}
  const {cfg,key,url}=selected;
  working=true;
  const button=$("#xyImagineGenerate",root),old=button.textContent;
  button.disabled=true;button.textContent="正在生成…";
  setStatus(root,"已提交生成请求，请稍候。结果会留在本机画册中。");
  try{
    let options;
    if(referenceFile){
      // Reference editing uses the OpenAI-compatible images/edits contract.
      const form=new FormData();
      form.append("model",cfg.model);form.append("prompt",prompt);
      form.append("size",cfg.size);form.append("image",referenceFile,referenceFile.name||"reference.png");
      options={method:"POST",body:form,headers:{Accept:"application/json"}};
    }else{
      options={method:"POST",body:JSON.stringify({model:cfg.model,prompt,size:cfg.size,n:1}),
        headers:{"Content-Type":"application/json",Accept:"application/json"}};
    }
    if(key)options.headers.Authorization="Bearer "+key;
    const res=await fetch(url,options);
    const raw=await res.text();
    let json;
    try{json=JSON.parse(raw)}catch{throw new Error("接口返回了非 JSON 内容（HTTP "+res.status+"）")}
    if(!res.ok){
      const explanation=String(json?.error?.message||json?.message||"请求失败").slice(0,260);
      throw new Error("HTTP "+res.status+" · "+explanation);
    }
    const result=await resultImage(json);
    lastImage=result.src;
    let msg="生成完成。";
    if(result.persistable){
      try{await archiveImage(result.src,prompt,cfg.model,cfg.size);
        msg="生成完成，已保存到本机画册。";
      }catch(err){msg="生成完成，但本机保存失败："+String(err?.message||err)}
    }else msg="生成完成。图片来自外部链接，无法自动永久保存，请尽快另存。";
    updateResult(root,result.src,msg);
    await showGallery(root);
  }catch(err){
    setStatus(root,"生成失败："+String(err?.message||err)+
      (/Failed to fetch|NetworkError/i.test(String(err))?"。可能是接口跨域、网络或地址限制。":""),true);
  }finally{
    working=false;
    if(button.isConnected){button.disabled=false;button.textContent=old}
  }
}
function initReference(root){
  const picker=$("#xyImagineReference",root),label=$("#xyImagineReferenceName",root);
  picker.addEventListener("change",()=>{
    const f=picker.files?.[0];
    if(!f)return;
    if(!f.type.startsWith("image/")||f.size>10*1024*1024){
      picker.value="";setStatus(root,"参考图必须是 10MB 以内的图片。",true);return;
    }
    referenceFile=f;label.textContent=f.name;
    $("#xyImagineClearReference",root).hidden=false;
  });
  $("#xyImagineClearReference",root).onclick=()=>{
    referenceFile=null;picker.value="";label.textContent="不使用参考图";
    $("#xyImagineClearReference",root).hidden=true;
  };
}
function open(){
  referenceFile=null;
  document.querySelector("#sidebar")?.classList.remove("open");
  const body=$("#panelBody"),panel=$("#panel");
  if(!body||!panel)return;
  $("#panelEyebrow").textContent="AEVREN · ATELIER";
  $("#panelTitle").textContent="生图工作台";
  body.innerHTML='<div class="xy-imagine" id="xyImageStudio">'+
    '<div class="xy-imagine-hero"><span>IMAGINE · CREATE</span><h2>给想象一个形状。</h2><p>写下画面，让图像模型为你作画。</p></div>'+
    '<label class="xy-imagine-field" for="xyImaginePrompt"><strong>画面描述</strong><textarea id="xyImaginePrompt" rows="4" maxlength="4000" placeholder="例如：窗边的浅色花束，日光穿过薄纱，温柔而细腻的插画…"></textarea></label>'+
    '<div class="xy-imagine-row"><label class="xy-imagine-field" for="xyImagineSize"><strong>画面比例</strong><select id="xyImagineSize"><option value="1024x1024">方形 · 1:1</option><option value="1536x1024">横向 · 3:2</option><option value="1024x1536">竖向 · 2:3</option><option value="1024x768">横向 · 4:3（依模型支持）</option><option value="720x1280">手机 · 9:16（依模型支持）</option></select></label>'+
    '<label class="xy-imagine-field" for="xyImagineModel"><strong>图像模型</strong><input id="xyImagineModel" placeholder="例如：gpt-image-1"></label></div>'+
    '<div class="xy-imagine-ref"><label class="xy-imagine-ref-select" for="xyImagineReference">＋ 添加参考图</label><input type="file" id="xyImagineReference" accept="image/*" hidden><span id="xyImagineReferenceName">不使用参考图</span><button type="button" id="xyImagineClearReference" hidden aria-label="移除参考图">×</button></div>'+
    '<details class="xy-imagine-config" id="xyImagineConfig"><summary><span>生成接口设置<small>可使用已有接口，也能单独填图像接口</small></span><i aria-hidden="true">⌄</i></summary>'+
    '<div class="xy-imagine-config-body"><label class="xy-imagine-field" for="xyImagineSource"><strong>接口来源</strong><select id="xyImagineSource"><option value="existing">已有聊天接口</option><option value="custom">自定义图像接口</option></select></label>'+
    '<div id="xyImagineExisting"><label class="xy-imagine-field" for="xyImagineEndpoint"><strong>选择接口</strong><select id="xyImagineEndpoint"></select></label></div>'+
    '<div id="xyImagineCustom" hidden><label class="xy-imagine-field" for="xyImagineBase"><strong>Base URL</strong><input id="xyImagineBase" placeholder="https://api.example.com/v1"></label><label class="xy-imagine-field" for="xyImagineKey"><strong>API Key</strong><input id="xyImagineKey" type="password" autocomplete="off" placeholder="仅保存在本机"></label></div>'+
    '<p>接口需支持 OpenAI 兼容的 images/generations；参考图使用 images/edits。普通聊天模型不一定支持生图。</p>'+
    '<button type="button" id="xyImagineSaveConfig" class="xy-imagine-save-config">保存接口设置</button></div></details>'+
    '<button type="button" id="xyImagineGenerate" class="xy-imagine-generate">✦ 开始生成</button>'+
    '<p id="xyImagineStatus" class="xy-imagine-status" role="status" aria-live="polite">每次点击生成才会向你选择的接口发送请求。</p>'+
    '<section id="xyImagineResult" class="xy-imagine-result" hidden><h3>本次作品</h3><img id="xyImaginePreview" alt="本次生成的图像"><p id="xyImagineResultNote"></p><button type="button" id="xyImagineShowFull">查看大图</button></section>'+
    '<section class="xy-imagine-history"><div class="xy-imagine-history-head"><h3>我的画册</h3><span id="xyImagineGalleryCount">0 张</span></div><div id="xyImagineGallery" class="xy-imagine-gallery"></div><p class="xy-imagine-gallery-note">画册图片保存在本机，清理应用数据可能丢失；接口和尺寸需由服务商支持。</p></section>'+
    '</div>';
  panel.classList.add("open");
  $("#scrim")?.classList.add("show");
  const root=$("#xyImageStudio",body),cfg=loadConfig();
  $("#xyImaginePrompt",root).value=promptDraft;
  $("#xyImaginePrompt",root).addEventListener("input",e=>{promptDraft=e.target.value});
  $("#xyImagineModel",root).value=cfg.model;
  $("#xyImagineSize",root).value=cfg.size;
  $("#xyImagineSource",root).value=cfg.mode;
  $("#xyImagineBase",root).value=cfg.base;
  $("#xyImagineKey",root).value=cfg.key;
  const endpointSelect=$("#xyImagineEndpoint",root);
  for(const ep of openEndpoints()){
    const opt=document.createElement("option");opt.value=String(ep.id);
    opt.textContent=(ep.name||"接口")+" · "+(ep.model||"未设模型");
    endpointSelect.append(opt);
  }
  if(!endpointSelect.options.length){
    const opt=document.createElement("option");opt.value="";opt.textContent="没有已配置的接口";
    endpointSelect.append(opt);
  }
  endpointSelect.value=cfg.endpointId||String(openEndpoints().find(x=>x.active)?.id||openEndpoints()[0]?.id||"");
  updateMode(root);
  $("#xyImagineSource",root).addEventListener("change",()=>updateMode(root));
  $("#xyImagineSaveConfig",root).addEventListener("click",()=>{
    try{persist(root);setStatus(root,"图像接口设置已保存在本机。");$("#xyImagineConfig",root).open=false}
    catch(err){setStatus(root,"保存失败："+err.message,true)}
  });
  initReference(root);
  $("#xyImagineGenerate",root).addEventListener("click",()=>generate(root));
  $("#xyImagineShowFull",root).addEventListener("click",()=>{if(lastImage)window.xyOpenImagePreview?.(lastImage)});
  showGallery(root);
}
function installQuickEntry(){
  const menu=$("#xyAttachMenu");
  if(!menu||menu.querySelector('[data-attach="imagine"]'))return;
  const button=document.createElement("button");button.type="button";button.dataset.attach="imagine";
  button.innerHTML="<span>✧</span><b>生图</b><small>快速打开画室</small>";
  menu.insertBefore(button,menu.querySelector('[data-attach="call"]'));
  menu.addEventListener("click",e=>{
    if(!e.target.closest('[data-attach="imagine"]'))return;
    e.preventDefault();e.stopImmediatePropagation();
    menu.hidden=true;
    openPanel("imagine");
  },true);
}
installQuickEntry();
window.xyImageStudio={open,imageEndpoint};
})();