(()=>{
  const KEY="xy.avatars";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{user:"",characters:{},visible:true}}catch{return {user:"",characters:{},visible:true}}};
  let avatars=read();
  if(!avatars.characters||typeof avatars.characters!=="object")avatars.characters={};
  if(typeof avatars.visible!=="boolean")avatars.visible=true;
  const saveAvatars=()=>localStorage.setItem(KEY,JSON.stringify(avatars));
  const currentCharacter=()=>{try{return window.xyCurrentCharacter?.()||{id:"xuan-yan",name:document.querySelector(".presence strong")?.textContent?.trim()||"玄砚"}}catch{return {id:"xuan-yan",name:"玄砚"}}};
  const charAvatar=()=>avatars.characters[currentCharacter().id]||"";

  const initials=(value,fallback)=>String(value||fallback||"?").trim().slice(0,1);
  function avatarNode(src,label,kind){
    const node=document.createElement("div");
    node.className="xy-msg-avatar "+kind;
    node.setAttribute("aria-label",label);
    if(src){
      node.style.backgroundImage=`url("${String(src).replace(/"/g,"%22")}")`;
      node.classList.add("has-image");
    }else node.textContent=initials(label,kind==="user"?"我":"砚");
    return node;
  }

  function decorateMessages(){
    const box=document.querySelector("#messages");if(!box)return;
    box.querySelectorAll(".xy-msg-avatar").forEach(x=>x.remove());
    box.querySelectorAll(".message.xy-has-avatar,.message.xy-avatar-continuation").forEach(x=>x.classList.remove("xy-has-avatar","xy-avatar-continuation"));
    document.documentElement.dataset.showAvatars=avatars.visible?"1":"0";
    if(!avatars.visible)return;
    const ch=currentCharacter(),assistantSrc=charAvatar(),userSrc=avatars.user||"";
    const groups=new Map();
    box.querySelectorAll(".message[data-message]").forEach(row=>{
      const key=row.dataset.message+":"+row.classList.contains("assistant");
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    });
    groups.forEach(rows=>{
      const first=rows[0];if(!first)return;
      const isAssistant=first.classList.contains("assistant");
      const src=isAssistant?assistantSrc:userSrc;
      const label=isAssistant?ch.name:"我";
      const node=avatarNode(src,label,isAssistant?"assistant":"user");
      first.classList.add("xy-has-avatar");
      if(isAssistant)first.insertAdjacentElement("afterbegin",node);
      else first.appendChild(node);
      if(isAssistant&&rows.length>1)rows.slice(1).forEach(row=>row.classList.add("xy-avatar-continuation"));
    });
  }

  const loadImage=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("头像读取失败"))};
    img.src=url;
  });
  async function packAvatar(file){
    if(!file)throw new Error("请选择图片");
    if(file.type&&!file.type.startsWith("image/"))throw new Error("请选择图片文件");
    const img=await loadImage(file),size=320;
    const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext("2d",{alpha:false});
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    const sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
    ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
    return canvas.toDataURL("image/webp",.84);
  }

  function renderAvatarPanel(){
    document.querySelector("#sidebar")?.classList.remove("open");
    const ch=currentCharacter(),body=document.querySelector("#panelBody");
    const eyebrow=document.querySelector("#panelEyebrow"),title=document.querySelector("#panelTitle");
    if(eyebrow)eyebrow.textContent="AVATAR";if(title)title.textContent="头像";if(!body)return;
    const user=avatars.user||"",role=charAvatar();
    body.innerHTML=`
      <p class="setting-note">头像只保存在当前设备，不会写进仓库。角色头像按角色分别保存。</p>
      <div class="xy-avatar-visibility"><span><strong>显示聊天头像</strong><small>关闭后恢复无头像排版</small></span><input id="xyAvatarVisible" type="checkbox" ${avatars.visible?"checked":""}></div>
      <div class="xy-avatar-setting">
        <div class="xy-avatar-preview ${user?"has-image":""}" id="xyUserAvatarPreview" ${user?`style="background-image:url('${user.replace(/'/g,"%27")}')"`:""}>${user?"":"我"}</div>
        <div class="xy-avatar-setting-copy"><strong>我的头像</strong><span>显示在你的消息旁边</span></div>
        <button type="button" class="xy-avatar-pick" data-avatar-pick="user">选择图片</button>
        <input class="xy-avatar-file" type="file" id="xyUserAvatarFile" accept="image/*">
        <button type="button" class="xy-avatar-clear" data-avatar-clear="user">清除</button>
      </div>
      <div class="xy-avatar-setting">
        <div class="xy-avatar-preview ${role?"has-image":""}" id="xyRoleAvatarPreview" ${role?`style="background-image:url('${role.replace(/'/g,"%27")}')"`:""}>${role?"":initials(ch.name,"砚")}</div>
        <div class="xy-avatar-setting-copy"><strong>${esc(ch.name)}的头像</strong><span>显示在回复旁边</span></div>
        <button type="button" class="xy-avatar-pick" data-avatar-pick="role">选择图片</button>
        <input class="xy-avatar-file" type="file" id="xyRoleAvatarFile" accept="image/*">
        <button type="button" class="xy-avatar-clear" data-avatar-clear="role">清除</button>
      </div>`;
    document.querySelector("#panel")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show");

    const bind=(id,kind)=>{
      const input=body.querySelector(id),button=body.querySelector('[data-avatar-pick="'+kind+'"]');if(!input||!button)return;
      button.addEventListener("click",()=>input.click());
      input.addEventListener("change",async()=>{
        const file=input.files?.[0];if(!file)return;
        try{
          const packed=await packAvatar(file);
          if(kind==="user")avatars.user=packed;else avatars.characters[currentCharacter().id]=packed;
          saveAvatars();renderAvatarPanel();renderMessages();requestAnimationFrame(decorateMessages);
        }catch(err){alert(err.message||"头像处理失败")}
      });
    };
    bind("#xyUserAvatarFile","user");bind("#xyRoleAvatarFile","role");
    body.querySelector("#xyAvatarVisible")?.addEventListener("change",e=>{
      avatars.visible=!!e.target.checked;saveAvatars();renderMessages();requestAnimationFrame(decorateMessages);
    });
    body.querySelectorAll("[data-avatar-clear]").forEach(btn=>btn.addEventListener("click",()=>{
      if(btn.dataset.avatarClear==="user")avatars.user="";
      else delete avatars.characters[currentCharacter().id];
      saveAvatars();renderAvatarPanel();renderMessages();requestAnimationFrame(decorateMessages);
    }));
  }

  const priorOpenPanel=openPanel;
  openPanel=function(type){if(type==="avatar"){renderAvatarPanel();return}return priorOpenPanel(type)};

  const sidebar=document.querySelector(".sidebar-bottom");
  if(sidebar&&!sidebar.querySelector('[data-panel="avatar"]')){
    const btn=document.createElement("button");btn.className="nav-btn";btn.dataset.panel="avatar";btn.innerHTML="◉ <span>头像</span>";
    const themeBtn=sidebar.querySelector('[data-panel="theme"]');
    sidebar.insertBefore(btn,themeBtn||sidebar.firstChild);btn.onclick=()=>openPanel("avatar");
  }

  const priorRender=renderMessages;
  renderMessages=function(){const result=priorRender();requestAnimationFrame(decorateMessages);return result};
  document.addEventListener("click",e=>{
    if(e.target.closest(".use-character")||e.target.id==="saveCharacter")requestAnimationFrame(decorateMessages);
  });

  decorateMessages();
})();