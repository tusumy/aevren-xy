(()=>{
  const DEFAULT_THEME={bgColor:'#edf2ed',userBubble:'#d9e7dd',assistantBubble:'#f3f1eb',accent:'#365d4a',bgImage:'',overlay:.22,blur:0,mode:'light',bubbleGlass:false};
  const PRESETS={
    mint:{bgColor:'#edf2ed',userBubble:'#d9e7dd',assistantBubble:'#f3f1eb',accent:'#365d4a',bgImage:'',overlay:.22,blur:0},
    cream:{bgColor:'#f5efe6',userBubble:'#eee1d5',assistantBubble:'#faf5ee',accent:'#745c48',bgImage:'',overlay:.18,blur:0},
    dusk:{bgColor:'#e9e5ee',userBubble:'#ded7e8',assistantBubble:'#f4f0f7',accent:'#55466e',bgImage:'',overlay:.20,blur:0},
    ink:{bgColor:'#e8eceb',userBubble:'#d7dfdd',assistantBubble:'#f0f3f2',accent:'#344a47',bgImage:'',overlay:.20,blur:0}
  };
  const SWATCHES=['#ffffff','#f3f1eb','#d9e7dd','#c7ddd2','#edf2ed','#f0dfd5','#ded7e8','#d7dfdd','#b8ccd1','#365d4a','#745c48','#55466e','#344a47','#222827','#000000','#ff6b6b'];
  const valid=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||'').trim());
  const norm=v=>valid(v)?String(v).trim().toLowerCase():null;
  const getJson=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const savedTheme=getJson('xy.theme',{}),savedBubbles=getJson('xy.bubbleColors',{});
  let theme={...DEFAULT_THEME,...savedTheme};
  if(norm(savedBubbles.userBubble))theme.userBubble=norm(savedBubbles.userBubble);
  if(norm(savedBubbles.assistantBubble))theme.assistantBubble=norm(savedBubbles.assistantBubble);
  const systemScheme=window.matchMedia?.('(prefers-color-scheme: dark)');

  function persist(){
    localStorage.setItem('xy.theme',JSON.stringify(theme));
    localStorage.setItem('xy.bubbleColors',JSON.stringify({userBubble:theme.userBubble,assistantBubble:theme.assistantBubble}));
  }
  function resolvedMode(){return theme.mode==='system'?(systemScheme?.matches?'dark':'light'):theme.mode}
  function backdrop(){let el=document.querySelector('#themeBackdrop');if(!el){el=document.createElement('div');el.id='themeBackdrop';document.body.prepend(el)}return el}
  function rgbaColor(hex,alpha){
    const v=norm(hex)||'#ffffff';
    const r=parseInt(v.slice(1,3),16),g=parseInt(v.slice(3,5),16),b=parseInt(v.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }
  function textFor(hex){
    const v=norm(hex)||'#ffffff';
    const r=parseInt(v.slice(1,3),16),g=parseInt(v.slice(3,5),16),b=parseInt(v.slice(5,7),16);
    const luminance=(r*299+g*587+b*114)/1000;
    return luminance>154?'#2c342f':'#f5f8f6';
  }
  function applyTheme(){
    const root=document.documentElement,mode=resolvedMode();
    root.dataset.themeMode=mode;root.style.colorScheme=mode;
    root.style.setProperty('--theme-bg',theme.bgColor);
    root.style.setProperty('--theme-user-bubble',theme.userBubble);
    root.style.setProperty('--theme-assistant-bubble',theme.assistantBubble);
    root.style.setProperty('--theme-user-text',textFor(theme.userBubble));
    root.style.setProperty('--theme-assistant-text',textFor(theme.assistantBubble));
    root.style.setProperty('--theme-user-glass',rgbaColor(theme.userBubble,.58));
    root.style.setProperty('--theme-assistant-glass',rgbaColor(theme.assistantBubble,.54));
    root.style.setProperty('--theme-accent',theme.accent);
    root.style.setProperty('--theme-overlay',String(theme.overlay));
    root.style.setProperty('--theme-blur',Number(theme.blur||0)+'px');
    const bg=backdrop();
    bg.style.backgroundColor=theme.bgColor;
    bg.style.backgroundImage=theme.bgImage?`url(${JSON.stringify(theme.bgImage)})`:'none';
    document.body.classList.toggle('theme-has-image',!!theme.bgImage);
    document.body.classList.toggle('theme-dark',mode==='dark');
    root.dataset.bubbleGlass=theme.bubbleGlass?'1':'0';
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=mode==='dark'?'#171b19':theme.bgColor;
  }
  const escHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function colorField(label,key){
    const value=theme[key];
    return `<div class="xy-theme-color-row" data-color-row="${key}"><span>${label}</span><div class="xy-theme-color-control"><button type="button" class="xy-theme-color-preview" data-color-preview="${key}" aria-label="${label}" style="background:${value}"></button><input class="xy-theme-color-hex" data-color-input="${key}" value="${value}" maxlength="7" inputmode="text" spellcheck="false"><div class="xy-theme-palette" data-color-palette="${key}" hidden>${SWATCHES.map(c=>`<button type="button" class="xy-theme-swatch" data-color-swatch="${key}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div></div>`;
  }
  function paintRange(el,min,max,value){const pct=Math.max(0,Math.min(100,((Number(value)-min)/(max-min))*100));el?.style.setProperty('--xy-range-pct',pct+'%')}
  function setColor(key,value){const v=norm(value);if(!v)return false;theme[key]=v;applyTheme();return true}

  const blobToDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(blob)});
  const loadImage=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'))};img.src=url});
  const canvasBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  async function compressBackground(file){
    if(!file.type.startsWith('image/'))throw new Error('请选择图片文件');
    const img=await loadImage(file),limit=1920;let scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
    let width=Math.max(1,Math.round(img.naturalWidth*scale)),height=Math.max(1,Math.round(img.naturalHeight*scale));const target=900*1024;
    for(let pass=0;pass<4;pass++){
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
      for(const q of [.88,.78,.68,.58,.48,.4]){let blob=await canvasBlob(canvas,'image/webp',q);if(!blob||blob.type!=='image/webp')blob=await canvasBlob(canvas,'image/jpeg',q);if(blob&&blob.size<=target)return {dataUrl:await blobToDataURL(blob),bytes:blob.size,width,height}}
      width=Math.max(720,Math.round(width*.82));height=Math.max(720,Math.round(height*.82));
    }
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);const blob=await canvasBlob(canvas,'image/jpeg',.38);if(!blob)throw new Error('压缩失败');return {dataUrl:await blobToDataURL(blob),bytes:blob.size,width,height};
  }
  const humanSize=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';

  function themePanel(){
    document.querySelector('#sidebar')?.classList.remove('open');
    const eyebrow=document.querySelector('#panelEyebrow'),title=document.querySelector('#panelTitle'),body=document.querySelector('#panelBody');
    if(eyebrow)eyebrow.textContent='THEME';if(title)title.textContent='主题';if(!body)return;
    body.innerHTML=`<p class="setting-note">气泡颜色以你的设置为基准，并会随浅色/深色模式自动调整明暗；背景图会一直保留。</p>
      <div class="theme-mode-switch"><button data-theme-mode="light" class="${theme.mode==='light'?'active':''}">☀ 浅色</button><button data-theme-mode="dark" class="${theme.mode==='dark'?'active':''}">☾ 深色</button><button data-theme-mode="system" class="${theme.mode==='system'?'active':''}">◐ 跟随系统</button></div>
      <div class="theme-presets"><button data-theme-preset="mint">薄荷</button><button data-theme-preset="cream">奶油</button><button data-theme-preset="dusk">雾紫</button><button data-theme-preset="ink">青墨</button></div>
      <div class="theme-setting-card">${colorField('背景颜色','bgColor')}${colorField('你的气泡','userBubble')}${colorField('我的气泡','assistantBubble')}${colorField('强调色','accent')}</div>
      <div class="theme-setting-card"><label class="theme-stack"><span>气泡磨砂玻璃 <b id="themeBubbleGlassValue">${theme.bubbleGlass?'已开启':'已关闭'}</b></span><input id="themeBubbleGlass" type="checkbox" ${theme.bubbleGlass?'checked':''}></label></div>
      <div class="theme-setting-card"><label class="theme-stack"><span>背景图片 URL</span><input id="themeBgUrl" type="url" placeholder="https://..." value="${theme.bgImage&&!theme.bgImage.startsWith('data:')?escHtml(theme.bgImage):''}"></label><div class="theme-upload-row"><label class="theme-upload-button">从相册选择<input id="themeBgFile" type="file" accept="image/*" hidden></label><button class="theme-small-btn" id="clearThemeImage">清除背景图</button></div><div class="fetch-status" id="themeImageStatus">${theme.bgImage?'已设置背景图':'当前没有背景图'}</div></div>
      <div class="theme-setting-card"><label class="theme-stack"><span>背景遮罩 <b id="themeOverlayValue">${Math.round(theme.overlay*100)}%</b></span><input class="xy-theme-range" id="themeOverlay" type="range" min="0" max="0.85" step="0.05" value="${theme.overlay}"></label><label class="theme-stack"><span>背景模糊 <b id="themeBlurValue">${Number(theme.blur||0)}px</b></span><input class="xy-theme-range" id="themeBlur" type="range" min="0" max="24" step="1" value="${Number(theme.blur||0)}"></label></div>
      <button class="panel-action" id="saveTheme">保存主题</button><button class="theme-reset" id="resetTheme">恢复默认</button>`;
    document.querySelector('#panel')?.classList.add('open');document.querySelector('#scrim')?.classList.add('show');
    bindThemePanel(body);
  }

  function bindThemePanel(body){
    body.querySelectorAll('[data-color-preview]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.colorPreview,p=body.querySelector(`[data-color-palette="${key}"]`);body.querySelectorAll('.xy-theme-palette').forEach(x=>{if(x!==p)x.hidden=true});if(p)p.hidden=!p.hidden}));
    body.querySelectorAll('[data-color-swatch]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.colorSwatch,value=btn.dataset.color;if(setColor(key,value)){const input=body.querySelector(`[data-color-input="${key}"]`),preview=body.querySelector(`[data-color-preview="${key}"]`),p=body.querySelector(`[data-color-palette="${key}"]`);if(input)input.value=theme[key];if(preview)preview.style.background=theme[key];if(p)p.hidden=true}}));
    body.querySelectorAll('[data-color-input]').forEach(input=>{const commit=()=>{const key=input.dataset.colorInput;if(setColor(key,input.value)){input.value=theme[key];const p=body.querySelector(`[data-color-preview="${key}"]`);if(p)p.style.background=theme[key]}else input.value=theme[key]};input.addEventListener('change',commit);input.addEventListener('blur',commit)});
    body.querySelectorAll('[data-theme-mode]').forEach(btn=>btn.addEventListener('click',()=>{theme.mode=btn.dataset.themeMode;persist();applyTheme();themePanel()}));
    body.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.addEventListener('click',()=>{const bgImage=theme.bgImage;theme={...theme,...PRESETS[btn.dataset.themePreset],bgImage};persist();applyTheme();themePanel()}));
    const glass=body.querySelector('#themeBubbleGlass');
    glass?.addEventListener('change',()=>{theme.bubbleGlass=!!glass.checked;persist();applyTheme();const label=body.querySelector('#themeBubbleGlassValue');if(label)label.textContent=theme.bubbleGlass?'已开启':'已关闭'});
    const overlay=body.querySelector('#themeOverlay'),blur=body.querySelector('#themeBlur');
    paintRange(overlay,0,.85,theme.overlay);paintRange(blur,0,24,theme.blur);
    overlay?.addEventListener('input',()=>{theme.overlay=Number(overlay.value);body.querySelector('#themeOverlayValue').textContent=Math.round(theme.overlay*100)+'%';paintRange(overlay,0,.85,theme.overlay);applyTheme()});
    blur?.addEventListener('input',()=>{theme.blur=Number(blur.value);body.querySelector('#themeBlurValue').textContent=theme.blur+'px';paintRange(blur,0,24,theme.blur);applyTheme()});
    body.querySelector('#themeBgUrl')?.addEventListener('change',e=>{const url=e.target.value.trim();theme.bgImage=url;applyTheme()});
    body.querySelector('#themeBgFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0],status=body.querySelector('#themeImageStatus');if(!file)return;if(status)status.textContent='正在压缩背景图…';try{const packed=await compressBackground(file);theme.bgImage=packed.dataUrl;persist();applyTheme();if(status)status.textContent=`已压缩 ${humanSize(file.size)} → ${humanSize(packed.bytes)} · ${packed.width}×${packed.height}`;const url=body.querySelector('#themeBgUrl');if(url)url.value=''}catch(err){if(status)status.textContent=err.message||'图片处理失败'}e.target.value=''});
    body.querySelector('#clearThemeImage')?.addEventListener('click',()=>{theme.bgImage='';applyTheme();const url=body.querySelector('#themeBgUrl');if(url)url.value='';const s=body.querySelector('#themeImageStatus');if(s)s.textContent='当前没有背景图'});
    body.querySelector('#saveTheme')?.addEventListener('click',()=>{persist();applyTheme();const s=body.querySelector('#themeImageStatus');if(s)s.textContent=theme.bgImage?'主题已保存 · 背景图已设置':'主题已保存'});
    body.querySelector('#resetTheme')?.addEventListener('click',()=>{theme={...DEFAULT_THEME};persist();applyTheme();themePanel()});
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){if(type==='theme'){themePanel();return}return previousOpenPanel(type)};
  systemScheme?.addEventListener?.('change',()=>{if(theme.mode==='system')applyTheme()});
  persist();applyTheme();
})();