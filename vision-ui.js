(()=>{
  const active=()=>endpoints.find(x=>x.active)||endpoints[0];
  const vision=ep=>ep?.vision===true;
  function updateBadge(){
    const header=document.querySelector(".presence");if(!header)return;
    let indicator=document.querySelector("#xyVisionIndicator");
    if(!indicator){indicator=document.createElement("span");indicator.id="xyVisionIndicator";indicator.style.cssText="font-size:10px;opacity:.62;white-space:nowrap;margin-left:8px";header.appendChild(indicator)}
    indicator.textContent=vision(active())?"视觉已开":"仅文本";
    indicator.title="视觉开关由用户配置，不代表已自动验证模型能力";
  }
  function injectSettings(){
    const body=document.querySelector("#panelBody");
    if(!body||!body.querySelector("#endpointList"))return;
    for(const el of body.querySelectorAll(".endpoint-card[data-endpoint]")){
      const ep=endpoints[Number(el.dataset.endpoint)];
      const meta=el.querySelector("small");if(meta)meta.textContent+=" · "+(vision(ep)?"视觉已开":"仅文本");
    }
    const form=document.querySelector("#endpointForm");
    if(!form||form.querySelector("#xyVisionSetting"))return;
    const label=document.createElement("label");label.id="xyVisionSetting";label.style.cssText="display:flex;align-items:center;gap:10px;margin:10px 0;font-size:13px;color:#506656";
    label.innerHTML='<input type="checkbox" id="xyVisionToggle"> 启用该模型的图片视觉输入';
    const note=document.createElement("small");note.textContent="手动设置：请确认模型及接口支持图片。不支持时关闭，以免出现请求错误。";note.style.cssText="display:block;font-size:11px;opacity:.68;margin:0 0 9px";
    const submit=form.querySelector("#saveEndpoint");form.insertBefore(label,submit);form.insertBefore(note,submit);
    label.querySelector("input").checked=vision(active());
  }
  document.addEventListener("click",e=>{
    if(e.target.closest?.(".edit-endpoint")){const i=Number(e.target.closest(".edit-endpoint").dataset.i);queueMicrotask(()=>{injectSettings();const input=document.querySelector("#xyVisionToggle");if(input)input.checked=vision(endpoints[i])})}
    if(e.target?.id==="addEndpoint"){queueMicrotask(()=>{injectSettings();const input=document.querySelector("#xyVisionToggle");if(input)input.checked=false})}
    if(e.target?.id==="saveEndpoint"){
      const input=document.querySelector("#xyVisionToggle");const form=document.querySelector("#endpointForm");
      const editing=form?.dataset.edit??"";
      const checked=!!input?.checked;
      queueMicrotask(()=>{const i=editing!==""?Number(editing):endpoints.length-1;if(endpoints[i]){endpoints[i].vision=checked;save();updateBadge()}})
    }
    if(e.target.closest?.(".endpoint-card[data-endpoint]")&&!e.target.closest("button"))queueMicrotask(updateBadge);
  },true);
  const openBefore=openPanel;
  openPanel=function(type){const r=openBefore(type);if(type==="settings")injectSettings();updateBadge();return r};
  window.xyVision={enabled:()=>vision(active()),updateBadge};
  updateBadge();
  // Preview images with a simple full-screen overlay, without adding extra controls to the composer.
  document.addEventListener("click",async e=>{
    const image=e.target.closest?.(".xy-message-image");if(!image)return;
    let src=image.currentSrc||image.src;
    const row=image.closest(".message");const index=Number(row?.dataset.message);
    const m=chat()?.messages?.[index];
    const a=m?.attachments?.find(x=>x.kind==="image"&&(x.previewDataUrl===image.getAttribute("src")||x.dataUrl===image.getAttribute("src")))||m?.attachments?.find(x=>x.kind==="image");
    if(a){await window.xyImagePayload?.hydrate?.([{attachments:[a]}]);src=a.dataUrl||src}
    window.xyOpenImagePreview(src);
  });
  window.xyOpenImagePreview=function(src){
    if(!src)return;
    document.querySelector(".xy-image-fullscreen")?.remove();
    const cover=document.createElement("div");cover.className="xy-image-fullscreen";cover.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px";
    cover.innerHTML='<button type="button" aria-label="关闭预览" style="position:absolute;top:20px;right:20px;color:#fff;background:none;border:0;font-size:32px">×</button>';
    const full=document.createElement("img");full.src=src;full.alt="图片预览";full.style.cssText="max-width:100%;max-height:88vh;object-fit:contain";cover.appendChild(full);
    cover.addEventListener("click",()=>cover.remove());document.body.appendChild(cover);
  };
  const style=document.createElement("style");style.textContent=".xy-message-image{cursor:zoom-in}";document.head.appendChild(style);
})();