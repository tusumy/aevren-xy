/* 砚屿 · shared application scene, separate from the chat wallpaper.
   Keep legacy images by reference until one of the wallpapers is changed. */
(()=>{
  "use strict";
  const KEY="xy.appBackground.v1";
  const defaults={imageMode:"legacy",image:"",colorMode:"legacy",color:"",overlay:.56,blur:0,chatFollow:false};
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  // Large data-URL wallpapers can make JSON.parse expensive on Android.
  // Read only when the theme actually changes, not on every slider frame.
  let cachedTheme=read("xy.theme",{});
  const chatTheme=()=>cachedTheme;
  const refreshTheme=()=>{cachedTheme=read("xy.theme",{})};
  const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||""))?v:null;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
  const imageCss=v=>v?`url(${JSON.stringify(v)})`:"none";
  const tint=(color,alpha)=>{
    const c=hex(color)||"#edf2ed";
    return "rgba("+[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(",")+","+clamp(alpha,0,1)+")";
  };
  let state={...defaults,...read(KEY,{})};
  state.imageMode=state.imageMode==="custom"?"custom":"legacy";
  state.colorMode=state.colorMode==="custom"?"custom":"legacy";
  state.overlay=clamp(state.overlay,0,.85);
  state.blur=clamp(state.blur,0,18);
  state.chatFollow=!!state.chatFollow;
  let lastChatImage=chatTheme().bgImage||"";
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn("[砚屿背景] 保存失败",e)}}
  function resolvedImage(){return state.imageMode==="custom"?state.image||"":chatTheme().bgImage||""}
  function resolvedColor(){return hex(state.colorMode==="custom"?state.color:chatTheme().bgColor)||"#edf2ed"}
  // A legacy home picture remains the application picture when the user
  // changes only the chat picture. Copy only at that moment, not on every boot.
  function freezeLegacyIfNeeded(){
    const nextImage=chatTheme().bgImage||"";
    let changed=false;
    if(state.imageMode==="legacy"&&nextImage!==lastChatImage){
      state.imageMode="custom";state.image=lastChatImage;changed=true;
    }
    lastChatImage=nextImage;
    if(changed)persist();
  }
  function ensureScene(){
    let scene=document.getElementById("xyAppBackdrop");
    if(!scene){
      scene=document.createElement("div");scene.id="xyAppBackdrop";
      scene.setAttribute("aria-hidden","true");
      document.body.appendChild(scene);
    }
    return scene;
  }
  function shadeForNight(color){
    // The original image/color stays saved unchanged. Only the night-mode
    // presentation is shaded, otherwise light wallpapers + white text clash.
    const base=hex(color)||"#edf2ed",night="#152820",amount=.84;
    const rgb=[1,3,5].map(i=>Math.round(parseInt(base.slice(i,i+2),16)*(1-amount)+parseInt(night.slice(i,i+2),16)*amount));
    return "#"+rgb.map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  function apply(){
    ensureScene();
    const root=document.documentElement,color=resolvedColor(),image=resolvedImage();
    const night=root.dataset.themeMode==="dark";
    const shownColor=night?shadeForNight(color):color;
    root.style.setProperty("--xy-app-bg-color",shownColor);
    root.style.setProperty("--xy-app-bg-image",imageCss(image));
    root.style.setProperty("--xy-app-bg-blur",state.blur+"px");
    // Even with no image, dark mode needs a dark physical surface, not the
    // user's light custom color peeking through a nearly transparent veil.
    root.style.setProperty("--xy-app-bg-overlay",
      tint(night?"#0e1913":color,night?(image?Math.max(.68,state.overlay):.12):(image?state.overlay:.12)));
    root.dataset.xyAppHasImage=image?"1":"0";
    root.dataset.xyChatFollowsApp=state.chatFollow?"1":"0";
    const chatBackdrop=document.getElementById("themeBackdrop");
    if(chatBackdrop){
      const theme=chatTheme();
      const chatImage=state.chatFollow?image:(theme.bgImage||"");
      chatBackdrop.style.backgroundImage=imageCss(chatImage);
      chatBackdrop.style.backgroundColor=state.chatFollow?color:(hex(theme.bgColor)||"#edf2ed");
      document.body.classList.toggle("theme-has-image",!!chatImage);
    }
  }
  function escape(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function status(card,message){const el=card.querySelector("#xyAppBgStatus");if(el)el.textContent=message}
  function mountSettings(){
    const body=document.querySelector("#panelBody");
    if(!body||!body.querySelector("#themeBgUrl"))return;
    const chatCard=body.querySelector("#themeBgUrl").closest(".theme-setting-card");
    if(!chatCard)return;
    const chatLabel=chatCard.querySelector(".theme-stack span");
    if(chatLabel)chatLabel.textContent="聊天背景图片 URL";
    let chatHint=chatCard.querySelector(".xy-chat-bg-hint");
    if(!chatHint){chatHint=document.createElement("p");chatHint.className="xy-chat-bg-hint";chatHint.textContent="聊天壁纸独立保存；开启跟随时，会暂时显示应用背景。";chatCard.prepend(chatHint)}
    chatCard.classList.toggle("xy-chat-bg-follow",state.chatFollow);
    if(body.querySelector("#xyAppBgSettings"))return;
    const section=document.createElement("section");
    section.className="theme-setting-card xy-app-bg-settings";section.id="xyAppBgSettings";
    section.innerHTML=
      '<p class="xy-app-bg-title">应用背景</p>'+
      '<p class="xy-app-bg-help">首页、朋友圈、收藏、工具、设置共用同一张背景；应用底色默认随主题改变，设置后独立保存。</p>'+
      '<label class="theme-stack"><span>应用背景图片 URL</span><input type="url" id="xyAppBgUrl" placeholder="https://..." value="'+escape(resolvedImage().startsWith("data:")?"":resolvedImage())+'"></label>'+
      '<div class="theme-upload-row"><label class="theme-upload-button">从相册选择<input id="xyAppBgFile" type="file" accept="image/*" hidden></label><button type="button" class="theme-small-btn" id="xyAppBgClear">移除应用背景图</button></div>'+
      '<label class="xy-app-bg-color"><span>应用底色</span><input type="color" id="xyAppBgColor" value="'+escape(resolvedColor())+'"></label>'+
      '<label class="theme-stack"><span>图片遮罩 <b id="xyAppBgOverlayLabel">'+Math.round(state.overlay*100)+'%</b></span><input class="xy-theme-range" id="xyAppBgOverlay" type="range" min="0" max="0.85" step="0.05" value="'+state.overlay+'"></label>'+
      '<label class="theme-stack"><span>背景模糊 <b id="xyAppBgBlurLabel">'+state.blur+'px</b></span><input class="xy-theme-range" id="xyAppBgBlur" type="range" min="0" max="18" step="1" value="'+state.blur+'"></label>'+
      '<label class="xy-app-follow"><input id="xyChatFollowAppBg" type="checkbox" '+(state.chatFollow?"checked":"")+'><span>聊天背景跟随应用背景</span></label>'+
      '<p id="xyAppBgStatus" class="xy-app-bg-help" role="status">'+(resolvedImage()?"应用背景图已设置":"目前使用主题底色")+'</p>';
    chatCard.before(section);
    section.querySelector("#xyAppBgUrl").addEventListener("change",event=>{
      const image=event.target.value.trim();
      state.imageMode="custom";state.image=image;persist();apply();
      status(section,image?"已更新应用背景图":"应用背景图已清除");
    });
    section.querySelector("#xyAppBgFile").addEventListener("change",async event=>{
      const file=event.target.files?.[0];if(!file)return;
      const helper=window.xyThemeBackgroundTools;
      if(!helper?.compress){status(section,"背景图片处理功能尚未就绪");return}
      status(section,"正在压缩并保存应用背景…");
      try{
        const packed=await helper.compress(file);
        state.imageMode="custom";state.image=packed.dataUrl;
        persist();apply();
        section.querySelector("#xyAppBgUrl").value="";
        status(section,"已保存 "+helper.size(packed.bytes)+" · "+packed.width+"×"+packed.height);
      }catch(error){status(section,error?.message||"图片保存失败")}
      finally{event.target.value=""}
    });
    section.querySelector("#xyAppBgClear").addEventListener("click",()=>{
      state.imageMode="custom";state.image="";persist();apply();
      section.querySelector("#xyAppBgUrl").value="";
      status(section,"已移除应用背景图片，保留底色");
    });
    section.querySelector("#xyAppBgColor").addEventListener("input",event=>{
      if(!hex(event.target.value))return;
      state.colorMode="custom";state.color=event.target.value;persist();apply();
    });
    const overlay=section.querySelector("#xyAppBgOverlay");
    const blur=section.querySelector("#xyAppBgBlur");
    overlay.addEventListener("input",()=>{
      state.overlay=clamp(overlay.value,0,.85);
      section.querySelector("#xyAppBgOverlayLabel").textContent=Math.round(state.overlay*100)+"%";
      apply();
    });
    blur.addEventListener("input",()=>{
      state.blur=clamp(blur.value,0,18);
      section.querySelector("#xyAppBgBlurLabel").textContent=state.blur+"px";
      apply();
    });
    for(const el of [overlay,blur])el.addEventListener("change",persist);
    section.querySelector("#xyChatFollowAppBg").addEventListener("change",event=>{
      state.chatFollow=event.target.checked;persist();apply();
      chatCard.classList.toggle("xy-chat-bg-follow",state.chatFollow);
    });
  }
  window.addEventListener("xy-theme-changed",()=>{
    refreshTheme();freezeLegacyIfNeeded();apply();
    // Theme preset and light/dark toggles rebuild their panel synchronously.
    queueMicrotask(mountSettings);
  });
  window.addEventListener("storage",event=>{
    if(event.key==="xy.theme"){refreshTheme();freezeLegacyIfNeeded();apply()}
    if(event.key===KEY){state={...defaults,...read(KEY,{})};apply()}
  });
  const beforeOpenPanel=openPanel;
  openPanel=function(type){
    const result=beforeOpenPanel.apply(this,arguments);
    if(type==="theme")mountSettings();
    return result;
  };
  apply();
  window.xyAppBackground={get:()=>({...state,image:resolvedImage(),color:resolvedColor()}),apply};
})();
