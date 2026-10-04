(()=>{
  const IDS=["themeBgColor","themeBubbleColor","themeAssistantBubble","themeAccent"];
  const SWATCHES=["#ffffff","#f3f1eb","#d9e7dd","#c7ddd2","#edf2ed","#f0dfd5","#ded7e8","#d7dfdd","#b8ccd1","#365d4a","#745c48","#55466e","#344a47","#222827","#000000","#ff6b6b"];
  const valid=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||"").trim());
  const norm=v=>valid(v)?String(v).trim().toLowerCase():null;
  const inThemePanel=()=>document.querySelector("#panel")?.classList.contains("open")&&document.querySelector("#panelTitle")?.textContent.trim()==="主题";

  function applyToNative(native,value){
    const v=norm(value);if(!native||!v||!inThemePanel())return;
    native.value=v;
    native.dispatchEvent(new Event("input",{bubbles:true}));
    native.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function build(native){
    if(!inThemePanel()||!native||native.dataset.xyCustomColor==="1")return;
    native.dataset.xyCustomColor="1";
    native.disabled=true;
    native.classList.add("xy-native-color-hidden");

    const wrap=document.createElement("div");
    wrap.className="xy-color-control";
    wrap.dataset.for=native.id;
    const top=document.createElement("div");top.className="xy-color-top";
    const preview=document.createElement("button");preview.type="button";preview.className="xy-color-preview";
    const hex=document.createElement("input");hex.type="text";hex.inputMode="text";hex.autocapitalize="off";hex.spellcheck=false;hex.maxLength=7;hex.className="xy-color-hex";hex.placeholder="#RRGGBB";
    const palette=document.createElement("div");palette.className="xy-color-palette";palette.hidden=true;

    const sync=()=>{const v=norm(native.value)||"#ffffff";preview.style.background=v;preview.setAttribute("aria-label","当前颜色 "+v);hex.value=v};
    SWATCHES.forEach(color=>{
      const b=document.createElement("button");b.type="button";b.className="xy-color-swatch";b.style.background=color;b.title=color;
      b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(!inThemePanel())return;applyToNative(native,color);sync();palette.hidden=true});
      palette.appendChild(b);
    });
    preview.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(!inThemePanel())return;palette.hidden=!palette.hidden});
    hex.addEventListener("input",e=>{e.stopPropagation();if(!inThemePanel())return;const v=norm(hex.value);if(v){applyToNative(native,v);sync()}});
    hex.addEventListener("change",e=>{e.stopPropagation();if(!inThemePanel())return;const v=norm(hex.value);if(v){applyToNative(native,v);sync()}else sync()});

    top.append(preview,hex);wrap.append(top,palette);native.parentElement?.appendChild(wrap);sync();
  }

  function upgrade(){
    if(!inThemePanel())return;
    IDS.forEach(id=>{
      const native=document.getElementById(id);if(!native)return;
      const oldHex=native.parentElement?.querySelector('.theme-hex-input[data-for="'+id+'"]');if(oldHex)oldHex.style.display="none";
      build(native);
    });
  }

  document.addEventListener("click",e=>{
    if(!inThemePanel())return;
    if(!e.target.closest?.(".xy-color-control"))document.querySelectorAll("#panelBody .xy-color-palette").forEach(x=>x.hidden=true);
  });
  const panel=document.getElementById("panelBody");
  if(panel)new MutationObserver(()=>requestAnimationFrame(upgrade)).observe(panel,{childList:true,subtree:true});
  upgrade();
})();