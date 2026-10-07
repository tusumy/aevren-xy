(()=>{
  const composer=document.querySelector(".composer");
  const wrap=document.querySelector(".composer-wrap");
  if(!composer||!wrap)return;

  let button=composer.querySelector(".attach");
  if(!button){
    button=document.createElement("button");
    button.type="button";
    button.className="attach";
    composer.prepend(button);
  }
  button.type="button";
  button.textContent="+";
  button.title="添加图片或文件";
  button.setAttribute("aria-label","添加图片或文件");

  let pending=[];
  let busy=0;

  const toast=(text,isError=false)=>{
    document.querySelector(".xy-attachment-toast")?.remove();
    const el=document.createElement("div");
    el.className="xy-attachment-toast"+(isError?" error":"");
    el.textContent=text;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2600);
  };

  const ext=name=>String(name||"").toLowerCase().split(".").pop()||"";
  const textExt=new Set(["txt","md","markdown","json","jsonl","csv","tsv","xml","html","htm","css","js","mjs","cjs","ts","tsx","jsx","py","java","kt","kts","c","h","cpp","hpp","cs","go","rs","rb","php","sh","bash","zsh","fish","sql","yaml","yml","toml","ini","conf","log"]);
  const isTextFile=file=>String(file?.type||"").startsWith("text/")||textExt.has(ext(file?.name));

  const dataUrl=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(reader.error||new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });

  const fileText=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(reader.error||new Error("文件读取失败"));
    reader.readAsText(file);
  });

  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("图片读取失败"))};
    img.src=url;
  });

  const canvasBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));

  async function packImage(file){
    const type=String(file.type||"").toLowerCase();
    if(type==="image/gif"){
      if(file.size>4*1024*1024)throw new Error("GIF 太大了，先压到 4MB 以内");
      return {kind:"image",name:file.name||"image.gif",type:"image/gif",size:file.size,dataUrl:await dataUrl(file)};
    }
    const img=await loadImage(file);
    const maxSide=1800;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||1,img.naturalHeight||1));
    let width=Math.max(1,Math.round(img.naturalWidth*scale));
    let height=Math.max(1,Math.round(img.naturalHeight*scale));
    let quality=.9,blob=null;
    for(let pass=0;pass<5;pass++){
      const canvas=document.createElement("canvas");
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
      for(const q of [quality,.82,.74,.66,.58]){
        blob=await canvasBlob(canvas,"image/jpeg",q);
        if(blob&&blob.size<=1400*1024)break;
      }
      if(blob&&blob.size<=1400*1024)break;
      width=Math.max(720,Math.round(width*.82));
      height=Math.max(720,Math.round(height*.82));
      quality=.78;
    }
    if(!blob)throw new Error("图片压缩失败");
    const packed=new File([blob],(file.name||"image").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
    return {kind:"image",name:packed.name,type:"image/jpeg",size:packed.size,width,height,dataUrl:await dataUrl(packed)};
  }

  async function packFile(file){
    if(file.size>1024*1024)throw new Error(file.name+" 太大了，文本文件先控制在 1MB 内");
    if(!isTextFile(file))throw new Error(file.name+" 目前不能直接读取；先支持图片和文本类文件");
    let text=await fileText(file);
    const maxChars=120000;
    let truncated=false;
    if(text.length>maxChars){text=text.slice(0,maxChars);truncated=true}
    return {kind:"text",name:file.name||"文件",type:file.type||"text/plain",size:file.size,text,truncated};
  }

  let tray=document.querySelector("#xyAttachmentTray");
  if(!tray){
    tray=document.createElement("div");
    tray.id="xyAttachmentTray";
    tray.className="xy-attachment-tray";
    tray.hidden=true;
    wrap.insertBefore(tray,composer);
  }

  function escHtml(s){
    return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }

  function renderTray(){
    tray.hidden=!pending.length&&!busy;
    tray.innerHTML="";
    if(busy){
      const loading=document.createElement("div");
      loading.className="xy-attachment-chip loading";
      loading.textContent="正在处理附件…";
      tray.appendChild(loading);
    }
    pending.forEach((a,i)=>{
      const chip=document.createElement("div");
      chip.className="xy-attachment-chip";
      if(a.kind==="image"&&a.dataUrl){
        const img=document.createElement("img");img.src=a.dataUrl;img.alt="";
        chip.appendChild(img);
      }else{
        const icon=document.createElement("span");icon.className="xy-attachment-file-icon";icon.textContent="▤";chip.appendChild(icon);
      }
      const name=document.createElement("span");name.className="xy-attachment-name";name.textContent=a.name||"附件";chip.appendChild(name);
      const rm=document.createElement("button");rm.type="button";rm.className="xy-attachment-remove";rm.textContent="×";rm.setAttribute("aria-label","移除附件");
      rm.addEventListener("click",()=>{pending.splice(i,1);renderTray()});
      chip.appendChild(rm);
      tray.appendChild(chip);
    });
  }

  let menu=document.querySelector("#xyAttachMenu");
  if(!menu){
    menu=document.createElement("div");
    menu.id="xyAttachMenu";
    menu.className="xy-attach-menu";
    menu.hidden=true;
    menu.innerHTML='<button type="button" data-xy-attach="image"><span>▧</span><b>图片</b><small>相册 / 多选</small></button><button type="button" data-xy-attach="file"><span>▤</span><b>文件</b><small>TXT / MD / JSON / 代码等</small></button>';
    document.body.appendChild(menu);
  }

  const imageInput=document.createElement("input");
  imageInput.type="file";imageInput.accept="image/*";imageInput.multiple=true;imageInput.hidden=true;
  const fileInput=document.createElement("input");
  fileInput.type="file";fileInput.accept="text/*,.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.xml,.html,.htm,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.java,.kt,.kts,.c,.h,.cpp,.hpp,.cs,.go,.rs,.rb,.php,.sh,.sql,.yaml,.yml,.toml,.ini,.conf,.log";fileInput.multiple=true;fileInput.hidden=true;
  document.body.append(imageInput,fileInput);

  function positionMenu(){
    const rect=button.getBoundingClientRect();
    menu.hidden=false;
    const mr=menu.getBoundingClientRect();
    const left=Math.max(10,Math.min(rect.left,window.innerWidth-mr.width-10));
    const top=Math.max(10,rect.top-mr.height-10);
    menu.style.left=Math.round(left)+"px";
    menu.style.top=Math.round(top)+"px";
  }

  button.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    if(menu.hidden)positionMenu();else menu.hidden=true;
  };

  menu.addEventListener("click",e=>{
    const act=e.target.closest?.("[data-xy-attach]")?.dataset.xyAttach;
    if(!act)return;
    menu.hidden=true;
    if(act==="image")imageInput.click();
    else fileInput.click();
  });

  document.addEventListener("click",e=>{
    if(menu.hidden)return;
    if(e.target===button||menu.contains(e.target))return;
    menu.hidden=true;
  });

  async function addFiles(files,kind){
    const list=[...(files||[])].slice(0,6);
    if(!list.length)return;
    busy++;
    renderTray();
    try{
      for(const file of list){
        try{
          const item=kind==="image"?await packImage(file):await packFile(file);
          pending.push(item);
        }catch(error){toast(error?.message||"附件处理失败",true)}
      }
    }finally{
      busy=Math.max(0,busy-1);
      renderTray();
      imageInput.value="";fileInput.value="";
    }
  }

  imageInput.addEventListener("change",()=>addFiles(imageInput.files,"image"));
  fileInput.addEventListener("change",()=>addFiles(fileInput.files,"file"));

  const previousSave=typeof save==="function"?save:null;
  if(previousSave){
    save=function(){
      const hidden=[];
      const visit=value=>{
        if(!value||typeof value!=="object")return;
        if(Array.isArray(value)){value.forEach(visit);return}
        if(value.kind==="image"&&Object.prototype.hasOwnProperty.call(value,"dataUrl")){
          hidden.push([value,"dataUrl",value.dataUrl]);delete value.dataUrl;
        }
        if(value.kind==="text"&&Object.prototype.hasOwnProperty.call(value,"text")){
          hidden.push([value,"text",value.text]);delete value.text;
        }
        Object.keys(value).forEach(k=>visit(value[k]));
      };
      try{
        visit(chats);
        return previousSave();
      }finally{
        for(let i=hidden.length-1;i>=0;i--){const [obj,key,val]=hidden[i];obj[key]=val}
      }
    };
  }

  window.xyAttachmentsBusy=()=>busy>0;
  window.xyAttachmentToast=toast;
  window.xyTakePendingAttachments=()=>{
    if(busy)return null;
    const out=pending;
    pending=[];
    renderTray();
    return out;
  };
  window.xyPeekPendingAttachments=()=>pending;
  window.xyRestorePendingAttachments=items=>{
    if(Array.isArray(items)&&items.length){pending.unshift(...items);renderTray()}
  };

  const oldPicker=document.querySelector("#xyAttachmentPicker");if(oldPicker)oldPicker.remove();
  const oldChip=document.querySelector("#xyAttachmentChip");if(oldChip)oldChip.remove();
  renderTray();
})();