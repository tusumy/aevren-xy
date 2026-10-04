(()=>{
  const DEFAULT_THEME={
    bgColor:"#edf2ed",
    userBubble:"#d9e7dd",
    assistantBubble:"#f3f1eb",
    accent:"#365d4a",
    bgImage:"",
    overlay:0.22,
    blur:0
  };
  const PRESETS={
    mint:{bgColor:"#edf2ed",userBubble:"#d9e7dd",assistantBubble:"#f3f1eb",accent:"#365d4a",bgImage:"",overlay:0.22,blur:0},
    cream:{bgColor:"#f5efe6",userBubble:"#eee1d5",assistantBubble:"#faf5ee",accent:"#745c48",bgImage:"",overlay:0.18,blur:0},
    dusk:{bgColor:"#e9e5ee",userBubble:"#ded7e8",assistantBubble:"#f4f0f7",accent:"#55466e",bgImage:"",overlay:0.2,blur:0},
    ink:{bgColor:"#e8eceb",userBubble:"#d7dfdd",assistantBubble:"#f0f3f2",accent:"#344a47",bgImage:"",overlay:0.2,blur:0}
  };

  let theme=store.get("xy.theme",DEFAULT_THEME);
  theme={...DEFAULT_THEME,...theme};

  function persist(){store.set("xy.theme",theme)}
  function backdrop(){
    let el=document.querySelector("#themeBackdrop");
    if(!el){el=document.createElement("div");el.id="themeBackdrop";document.body.prepend(el)}
    return el;
  }
  function applyTheme(){
    const root=document.documentElement.style;
    root.setProperty("--theme-bg",theme.bgColor);
    root.setProperty("--theme-user-bubble",theme.userBubble);
    root.setProperty("--theme-assistant-bubble",theme.assistantBubble);
    root.setProperty("--theme-accent",theme.accent);
    root.setProperty("--theme-overlay",String(theme.overlay));
    root.setProperty("--theme-blur",Number(theme.blur||0)+"px");
    const bg=backdrop();
    bg.style.backgroundColor=theme.bgColor;
    bg.style.backgroundImage=theme.bgImage?`url(${JSON.stringify(theme.bgImage)})`:"none";
    document.body.classList.toggle("theme-has-image",!!theme.bgImage);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute("content",theme.bgColor);
  }

  function themePanel(){
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="THEME";
    document.querySelector("#panelTitle").textContent="主题";
    const body=document.querySelector("#panelBody");
    body.innerHTML=`
      <p class="setting-note">颜色、背景图都只保存在当前浏览器。相册图片会自动压缩后保存，不会写进仓库。</p>
      <div class="theme-presets">
        <button data-theme-preset="mint">薄荷</button>
        <button data-theme-preset="cream">奶油</button>
        <button data-theme-preset="dusk">雾紫</button>
        <button data-theme-preset="ink">青墨</button>
      </div>
      <div class="theme-setting-card">
        <label><span>背景颜色</span><input id="themeBgColor" type="color" value="${esc(theme.bgColor)}"></label>
        <label><span>你的气泡</span><input id="themeBubbleColor" type="color" value="${esc(theme.userBubble)}"></label>
        <label><span>我的气泡</span><input id="themeAssistantBubble" type="color" value="${esc(theme.assistantBubble)}"></label>
        <label><span>强调色</span><input id="themeAccent" type="color" value="${esc(theme.accent)}"></label>
      </div>
      <div class="theme-setting-card">
        <label class="theme-stack"><span>背景图片 URL</span><input id="themeBgUrl" type="url" placeholder="https://..." value="${theme.bgImage&&!theme.bgImage.startsWith("data:")?esc(theme.bgImage):""}"></label>
        <div class="theme-upload-row">
          <label class="theme-upload-button">从相册选择<input id="themeBgFile" type="file" accept="image/*" hidden></label>
          <button class="theme-small-btn" id="clearThemeImage">清除背景图</button>
        </div>
        <div class="fetch-status" id="themeImageStatus">${theme.bgImage?"已设置背景图":"当前没有背景图"}</div>
      </div>
      <div class="theme-setting-card">
        <label class="theme-stack"><span>背景遮罩 <b id="themeOverlayValue">${Math.round(theme.overlay*100)}%</b></span><input id="themeOverlay" type="range" min="0" max="0.85" step="0.05" value="${theme.overlay}"></label>
        <label class="theme-stack"><span>背景模糊 <b id="themeBlurValue">${Number(theme.blur||0)}px</b></span><input id="themeBlur" type="range" min="0" max="24" step="1" value="${Number(theme.blur||0)}"></label>
      </div>
      <button class="panel-action" id="saveTheme">保存主题</button>
      <button class="theme-reset" id="resetTheme">恢复默认</button>`;
    document.querySelector("#panel").classList.add("open");
    document.querySelector("#scrim").classList.add("show");
    bindThemeInputs();
  }

  function readControls(){
    theme.bgColor=document.querySelector("#themeBgColor")?.value||theme.bgColor;
    theme.userBubble=document.querySelector("#themeBubbleColor")?.value||theme.userBubble;
    theme.assistantBubble=document.querySelector("#themeAssistantBubble")?.value||theme.assistantBubble;
    theme.accent=document.querySelector("#themeAccent")?.value||theme.accent;
    theme.overlay=Number(document.querySelector("#themeOverlay")?.value??theme.overlay);
    theme.blur=Number(document.querySelector("#themeBlur")?.value??theme.blur);
    const url=document.querySelector("#themeBgUrl")?.value.trim();
    if(url)theme.bgImage=url;
  }

  const blobToDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsDataURL(blob)});
  const loadImage=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("图片读取失败"))};img.src=url});
  const canvasBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  async function compressBackground(file){
    if(!file.type.startsWith("image/"))throw new Error("请选择图片文件");
    const img=await loadImage(file);
    const limit=1920;
    let scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
    let width=Math.max(1,Math.round(img.naturalWidth*scale)),height=Math.max(1,Math.round(img.naturalHeight*scale));
    const target=900*1024;
    for(let pass=0;pass<4;pass++){
      const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
      for(const quality of [0.88,0.78,0.68,0.58,0.48,0.4]){
        let blob=await canvasBlob(canvas,"image/webp",quality);
        if(!blob||blob.type!=="image/webp")blob=await canvasBlob(canvas,"image/jpeg",quality);
        if(blob&&blob.size<=target)return {dataUrl:await blobToDataURL(blob),bytes:blob.size,width,height};
      }
      width=Math.max(720,Math.round(width*0.82));height=Math.max(720,Math.round(height*0.82));
    }
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
    const blob=await canvasBlob(canvas,"image/jpeg",0.38);if(!blob)throw new Error("压缩失败");
    return {dataUrl:await blobToDataURL(blob),bytes:blob.size,width,height};
  }
  const humanSize=n=>n>=1024*1024?(n/1024/1024).toFixed(1)+"MB":Math.max(1,Math.round(n/1024))+"KB";

  function bindThemeInputs(){
    ["themeBgColor","themeBubbleColor","themeAssistantBubble","themeAccent","themeOverlay","themeBlur"].forEach(id=>{
      document.querySelector("#"+id)?.addEventListener("input",()=>{
        readControls();
        const ov=document.querySelector("#themeOverlayValue"),bl=document.querySelector("#themeBlurValue");
        if(ov)ov.textContent=Math.round(theme.overlay*100)+"%";
        if(bl)bl.textContent=theme.blur+"px";
        applyTheme();
      });
    });
    document.querySelector("#themeBgUrl")?.addEventListener("change",()=>{readControls();applyTheme()});
    document.querySelector("#themeBgFile")?.addEventListener("change",async e=>{
      const file=e.target.files?.[0],status=document.querySelector("#themeImageStatus");
      if(!file)return;
      if(status)status.textContent="正在压缩背景图…";
      try{
        const packed=await compressBackground(file),old=theme.bgImage;
        theme.bgImage=packed.dataUrl;
        try{persist()}catch(err){theme.bgImage=old;throw new Error("本地空间不够，换一张尺寸小一点的图")}
        applyTheme();
        if(status)status.textContent=`已压缩 ${humanSize(file.size)} → ${humanSize(packed.bytes)} · ${packed.width}×${packed.height}`;
        const url=document.querySelector("#themeBgUrl");if(url)url.value="";
      }catch(err){if(status)status.textContent=err.message||"图片处理失败"}
      e.target.value="";
    });
  }

  document.addEventListener("click",e=>{
    const preset=e.target.closest("[data-theme-preset]");
    if(preset){theme={...theme,...PRESETS[preset.dataset.themePreset],bgImage:""};persist();applyTheme();themePanel();return}
    if(e.target.id==="clearThemeImage"){theme.bgImage="";persist();applyTheme();themePanel();return}
    if(e.target.id==="saveTheme"){readControls();persist();applyTheme();const status=document.querySelector("#themeImageStatus");if(status)status.textContent=theme.bgImage?"主题已保存 · 背景图已设置":"主题已保存";return}
    if(e.target.id==="resetTheme"){theme={...DEFAULT_THEME};persist();applyTheme();themePanel();return}
  });

  const previousOpenPanel=openPanel;
  openPanel=function(type){if(type==="theme"){themePanel();return}return previousOpenPanel(type)};
  applyTheme();
})();
