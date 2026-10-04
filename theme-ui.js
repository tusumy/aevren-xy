(()=>{
  const DEFAULT_THEME={
    bgColor:"#edf2ed",
    userBubble:"#d9e7dd",
    accent:"#365d4a",
    bgImage:"",
    overlay:0.22,
    blur:0
  };
  const PRESETS={
    mint:{bgColor:"#edf2ed",userBubble:"#d9e7dd",accent:"#365d4a",bgImage:"",overlay:0.22,blur:0},
    cream:{bgColor:"#f5efe6",userBubble:"#eee1d5",accent:"#745c48",bgImage:"",overlay:0.18,blur:0},
    dusk:{bgColor:"#e9e5ee",userBubble:"#ded7e8",accent:"#55466e",bgImage:"",overlay:0.2,blur:0},
    ink:{bgColor:"#e8eceb",userBubble:"#d7dfdd",accent:"#344a47",bgImage:"",overlay:0.2,blur:0}
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
      <p class="setting-note">颜色、背景图都只保存在当前浏览器。上传的图片不会写进仓库。</p>
      <div class="theme-presets">
        <button data-theme-preset="mint">薄荷</button>
        <button data-theme-preset="cream">奶油</button>
        <button data-theme-preset="dusk">雾紫</button>
        <button data-theme-preset="ink">青墨</button>
      </div>
      <div class="theme-setting-card">
        <label><span>背景颜色</span><input id="themeBgColor" type="color" value="${esc(theme.bgColor)}"></label>
        <label><span>你的气泡</span><input id="themeBubbleColor" type="color" value="${esc(theme.userBubble)}"></label>
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
    theme.accent=document.querySelector("#themeAccent")?.value||theme.accent;
    theme.overlay=Number(document.querySelector("#themeOverlay")?.value??theme.overlay);
    theme.blur=Number(document.querySelector("#themeBlur")?.value??theme.blur);
    const url=document.querySelector("#themeBgUrl")?.value.trim();
    if(url)theme.bgImage=url;
  }

  function bindThemeInputs(){
    ["themeBgColor","themeBubbleColor","themeAccent","themeOverlay","themeBlur"].forEach(id=>{
      document.querySelector("#"+id)?.addEventListener("input",()=>{
        readControls();
        const ov=document.querySelector("#themeOverlayValue"),bl=document.querySelector("#themeBlurValue");
        if(ov)ov.textContent=Math.round(theme.overlay*100)+"%";
        if(bl)bl.textContent=theme.blur+"px";
        applyTheme();
      });
    });
    document.querySelector("#themeBgUrl")?.addEventListener("change",()=>{readControls();applyTheme()});
    document.querySelector("#themeBgFile")?.addEventListener("change",e=>{
      const file=e.target.files?.[0],status=document.querySelector("#themeImageStatus");
      if(!file)return;
      if(file.size>1.5*1024*1024){if(status)status.textContent="图片太大了，请选 1.5MB 以内的图";e.target.value="";return}
      const reader=new FileReader();
      reader.onload=()=>{theme.bgImage=String(reader.result||"");persist();applyTheme();if(status)status.textContent="已使用本地背景图";const url=document.querySelector("#themeBgUrl");if(url)url.value=""};
      reader.onerror=()=>{if(status)status.textContent="图片读取失败"};
      reader.readAsDataURL(file);
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
