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
  const waiters=[];
  const wake=()=>{if(busy)return;while(waiters.length)waiters.shift()?.()};

  const toast=(text,isError=false)=>{
    document.querySelector(".xy-attachment-toast")?.remove();
    const node=document.createElement("div");
    node.className="xy-attachment-toast"+(isError?" error":"");
    node.textContent=String(text||"");
    document.body.appendChild(node);
    setTimeout(()=>node.remove(),2800);
  };

  const ext=name=>String(name||"").toLowerCase().split(".").pop()||"";
  const textExt=new Set(["txt","md","markdown","json","jsonl","csv","tsv","xml","html","htm","css","js","mjs","cjs","ts","tsx","jsx","py","java","kt","kts","c","h","cpp","hpp","cs","go","rs","rb","php","sh","bash","zsh","fish","sql","yaml","yml","toml","ini","conf","log"]);
  const isText=file=>String(file?.type||"").startsWith("text/")||textExt.has(ext(file?.name));

  const readText=file=>new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error||new Error("文件读取失败"));r.readAsText(file);
  });
  const dataUrl=blob=>new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error||new Error("图片读取失败"));r.readAsDataURL(blob);
  });
  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("图片读取失败"))};
    img.src=url;
  });
  const toBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));

  async function encodeCanvas(img,maxSide,targetBytes){
    let scale=Math.min(1,maxSide/Math.max(img.naturalWidth||1,img.naturalHeight||1));
    let width=Math.max(1,Math.round(img.naturalWidth*scale));
    let height=Math.max(1,Math.round(img.naturalHeight*scale));
    let blob=null;
    for(let pass=0;pass<5;pass++){
      const canvas=document.createElement("canvas");
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
      for(const q of [.88,.78,.68,.58,.48]){
        blob=await toBlob(canvas,"image/jpeg",q);
        if(blob&&blob.size<=targetBytes)return {blob,width,height};
      }
      width=Math.max(480,Math.round(width*.82));
      height=Math.max(480,Math.round(height*.82));
    }
    if(!blob)throw new Error("图片压缩失败");
    return {blob,width,height};
  }

  async function packImage(file){
    if(String(file.type||"").toLowerCase()==="image/gif"){
      if(file.size>1200*1024)throw new Error("GIF 先控制在 1.2MB 内");
      const raw=await dataUrl(file);
      return {kind:"image",name:file.name||"image.gif",type:"image/gif",size:file.size,dataUrl:raw,previewDataUrl:raw};
    }
    const img=await loadImage(file);
    const full=await encodeCanvas(img,1024,220*1024);
    const preview=await encodeCanvas(img,240,28*1024);
    const name=(file.name||"image").replace(/\.[^.]+$/,"")+".jpg";
    return {
      kind:"image",name,type:"image/jpeg",size:full.blob.size,
      width:full.width,height:full.height,
      dataUrl:await dataUrl(full.blob),
      previewDataUrl:await dataUrl(preview.blob)
    };
  }

  async function packText(file){
    if(file.size>768*1024)throw new Error(file.name+" 太大了，文本文件先控制在 768KB 内");
    if(!isText(file))throw new Error(file.name+" 暂时不支持直接读取");
    let text=await readText(file),truncated=false;
    if(text.length>90000){text=text.slice(0,90000);truncated=true}
    return {kind:"text",name:file.name||"文件",type:file.type||"text/plain",size:file.size,text,truncated};
  }

  let tray=document.querySelector("#xyAttachmentTray");
  if(!tray){
    tray=document.createElement("div");
    tray.id="xyAttachmentTray";
    tray.className="xy-attachment-tray";
    tray.hidden=true;
  }
  if(tray.parentElement!==composer)composer.prepend(tray);

  function render(){
    tray.hidden=!pending.length&&!busy;
    window.xyVoiceRefreshComposer?.();
    tray.innerHTML="";
    if(busy){
      const loading=document.createElement("div");
      loading.className="xy-attachment-chip loading";
      loading.textContent="正在处理附件…";
      tray.appendChild(loading);
    }
    pending.forEach((a,i)=>{
      const chip=document.createElement("div");
      chip.className="xy-attachment-chip "+(a.kind==="image"?"image":"file");
      if(a.kind==="image"){
        const img=document.createElement("img");
        img.src=a.previewDataUrl||a.dataUrl||"";
        img.alt="";
        chip.appendChild(img);
      }else{
        const icon=document.createElement("span");
        icon.className="xy-attachment-file-icon";
        icon.textContent=a.kind==="audio"?"◖":"▤";
        chip.appendChild(icon);
      }
      const name=document.createElement("span");
      name.className="xy-attachment-name";
      name.textContent=a.name||"附件";
      chip.appendChild(name);
      const remove=document.createElement("button");
      remove.type="button";
      remove.className="xy-attachment-remove";
      remove.textContent="×";
      remove.onclick=()=>{pending.splice(i,1);render()};
      chip.appendChild(remove);
      tray.appendChild(chip);
    });
  }

  let menu=document.querySelector("#xyAttachMenu");
  if(!menu){
    menu=document.createElement("div");
    menu.id="xyAttachMenu";
    menu.className="xy-attach-menu";
    menu.hidden=true;
    menu.innerHTML='<button type="button" data-attach="image"><span>▧</span><b>图片</b><small>相册 / 多选</small></button><button type="button" data-attach="file"><span>▤</span><b>文件</b><small>文本 / Markdown / JSON / 代码</small></button><button type="button" data-attach="call"><span>☎</span><b>语音通话</b><small>与角色通话</small></button>';
    document.body.appendChild(menu);
  }

  const imageInput=document.createElement("input");
  imageInput.type="file";imageInput.accept="image/*";imageInput.multiple=true;imageInput.hidden=true;
  const fileInput=document.createElement("input");
  fileInput.type="file";fileInput.accept="text/*,.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.xml,.html,.htm,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.java,.kt,.kts,.c,.h,.cpp,.hpp,.cs,.go,.rs,.rb,.php,.sh,.sql,.yaml,.yml,.toml,.ini,.conf,.log";fileInput.multiple=true;fileInput.hidden=true;
  document.body.append(imageInput,fileInput);

  const positionMenu=()=>{
    const current=window.xyCurrentCharacter?.();
    const label=menu.querySelector('[data-attach="call"] small');
    if(label)label.textContent="和"+String(current?.name||document.querySelector(".presence strong")?.textContent||"角色").trim()+"通话";
    menu.hidden=false;
    const br=button.getBoundingClientRect(),mr=menu.getBoundingClientRect();
    menu.style.left=Math.max(10,Math.min(br.left,innerWidth-mr.width-10))+"px";
    menu.style.top=Math.max(10,br.top-mr.height-10)+"px";
  };

  button.onclick=e=>{e.preventDefault();e.stopPropagation();menu.hidden?positionMenu():menu.hidden=true};
  menu.onclick=e=>{
    const type=e.target.closest?.("[data-attach]")?.dataset.attach;
    if(!type)return;
    menu.hidden=true;
    if(type==="call"){
      if(window.AevrenCall?.nativeIncomingCall){
        const result=window.AevrenCall.nativeIncomingCall();
        if(result?.ok){
          if(result.fullScreenAllowed===false)toast("来电已发出；锁屏全屏来电权限还没开启");
        }else if(result?.error==="notification_permission_requested"){
          toast("先允许砚屿发送来电通知，再点一次语音通话");
        }else if(window.AevrenCall?.ring){
          window.AevrenCall.ring({source:"composer"});
        }else toast("通话功能还没准备好",true);
      }else if(window.AevrenCall?.ring)window.AevrenCall.ring({source:"composer"});
      else toast("通话功能还没准备好",true);
      return;
    }
    (type==="image"?imageInput:fileInput).click();
  };
  document.addEventListener("click",e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==button)menu.hidden=true});

  async function add(files,kind){
    const list=[...(files||[])].slice(0,6);
    if(!list.length)return;
    busy++;
    render();
    try{
      for(const file of list){
        try{
          const item=kind==="image"?await packImage(file):await packText(file);
          if(item.kind==="image")await window.xyImagePayload?.archive?.([item]);
          pending.push(item);
        }catch(error){toast(error?.message||"附件处理失败",true)}
      }
    }finally{
      busy=Math.max(0,busy-1);
      render();
      if(!busy)wake();
      imageInput.value="";fileInput.value="";
    }
  }
  imageInput.onchange=()=>add(imageInput.files,"image");
  fileInput.onchange=()=>add(fileInput.files,"text");

  const stripPayload=a=>{
    if(!a||typeof a!=="object")return a;
    return {
      kind:a.kind,name:a.name,type:a.type,size:a.size,width:a.width,height:a.height,mediaKey:a.mediaKey||"",
      duration:Number(a.duration||0),format:a.format||"",
      localAudioKey:a.localAudioKey||"",transcript:a.transcript||"",transcriptError:a.transcriptError||"",
      truncated:!!a.truncated,previewDataUrl:a.previewDataUrl||""
    };
  };
  const previousSave=typeof save==="function"?save:null;
  if(previousSave){
    save=function(){
      // Only remove large attachment payloads while serializing.
      // Never touch message.text or variants[].text: these are the chat history.
      const hidden=[];
      const visit=value=>{
        if(!value||typeof value!=="object")return;
        if(Array.isArray(value)){value.forEach(visit);return}
        if(Array.isArray(value.attachments)){
          for(const attachment of value.attachments){
            if(!attachment||typeof attachment!=="object")continue;
            for(const key of ["dataUrl","text"]){
              if(Object.prototype.hasOwnProperty.call(attachment,key)){
                hidden.push([attachment,key,attachment[key]]);
                delete attachment[key];
              }
            }
          }
        }
        Object.keys(value).forEach(key=>{
          if(key!=="attachments")visit(value[key]);
        });
      };
      try{
        visit(chats);
        return previousSave();
      }finally{
        for(let i=hidden.length-1;i>=0;i--){const [obj,key,val]=hidden[i];obj[key]=val}
      }
    };
  }

  window.xyAttachments={
    busy:()=>busy>0,
    wait:()=>busy?new Promise(resolve=>waiters.push(resolve)):Promise.resolve(),
    take:()=>{if(busy)return null;const out=pending;pending=[];render();return out},
    peek:()=>pending,
    restore:items=>{if(Array.isArray(items)&&items.length){pending.unshift(...items);render()}},
    stripPayload,
    stripMessagePayloads:messages=>{
      for(const m of messages||[])if(Array.isArray(m?.attachments))m.attachments=m.attachments.map(stripPayload);
    },
    toast
  };

  document.querySelector("#xyAttachmentPicker")?.remove();
  document.querySelector("#xyAttachmentChip")?.remove();
  render();
})();