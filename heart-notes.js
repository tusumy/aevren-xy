(()=>{
  const KEY="xy.heartNotes.v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{return {}}};
  const enabled=()=>read().enabled!==false;
  const escHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clip=(value,count)=>Array.from(String(value||"").replace(/\s+/g," ").trim()).slice(0,count).join("");
  const expanded=new WeakSet();
  const instruction=()=>enabled()?[
    "请照常自然回复聊天。心音是完全可选的：只有你此刻确实有一句具体、真实、未在正文说出的情绪或想法，才在正文末尾另起一行附加心音标记；没有就只回复正文，绝对不要为了格式或每轮打卡硬写心音。",
    "允许连续很多轮没有心音，也允许情绪强烈时自然出现；由当前交流决定，不按概率、不按固定频率出现。不要用套话、重复正文或凑数的想抱你代替真正的心音。",
    '仅在需要心音时，格式为：⟦heart{"short":"有点吃醋","full":"刚听见你夸别人，我心里酸了一下，想把你的注意力拉回来。"}⟧',
    "short 用2～10个汉字写最直白的瞬间心情；full 用第一人称、面向对方写1～2句具体的可展示心音。两项都要有内容，使用有效 JSON 字符串。",
    "心音只是角色的可展示旁白，不是推理过程。不解释标记，不在正文重复心音；若有 ⟦opts...⟧ 快捷选项，把心音放在它之前。"
  ].join("\n"):"";
  function parse(raw){
    let text=String(raw??""),heartShort="",heartFull="",valid=false;
    text=text.replace(/⟦heart(\{[^⟧]*\})⟧/g,(whole,json)=>{
      try{
        const obj=JSON.parse(json);
        if(!obj||typeof obj!=="object")return whole;
        const short=clip(obj.short,16);
        const full=String(obj.full||"").trim().slice(0,400);
        if(short&&full){heartShort=short;heartFull=full;valid=true}
        return "";
      }catch{return whole}
    });
    // Remove incomplete end markers rather than showing implementation text in chat.
    text=text.replace(/\n?⟦heart(?:\{[^⟧]*)?$/,"").trim();
    return {text,heartShort,heartFull,hasHeart:valid};
  }
  const markText=(m)=>typeof m?.heartShort==="string"&&m.heartShort.trim()||typeof m?.heartFull==="string"&&m.heartFull.trim();
  function decorate(){
    if(!enabled())return;
    const c=typeof chat==="function"?chat():null,box=document.querySelector("#messages");
    if(!c||!box)return;
    (c.messages||[]).forEach((m,index)=>{
      if(m?.role!=="assistant"||!markText(m))return;
      const row=box.querySelector('.message.assistant[data-message="'+index+'"][data-part="0"]');
      const stack=row?.querySelector(".message-stack");
      if(!stack||stack.querySelector(".xy-heart-note"))return;
      const short=clip(m.heartShort,16)||"心音",full=m.heartFull||m.heartShort;
      const open=expanded.has(m);
      const wrap=document.createElement("div");
      wrap.className="xy-heart-note";
      wrap.innerHTML='<button type="button" class="xy-heart-pill" aria-expanded="'+open+'" aria-label="展开或收起心音"><span class="xy-heart-dot">♡</span><span class="xy-heart-brief">'+escHtml(short)+'</span><span class="xy-heart-angle">'+(open?"⌃":"⌄")+'</span></button><div class="xy-heart-detail" '+(open?"":"hidden")+'>'+escHtml(full)+'</div>';
      stack.insertBefore(wrap,stack.querySelector(".bubble")||stack.firstChild);
      wrap.querySelector("button").addEventListener("click",()=>{
        if(expanded.has(m))expanded.delete(m);else expanded.add(m);
        const show=expanded.has(m);
        wrap.querySelector(".xy-heart-detail").hidden=!show;
        wrap.querySelector("button").setAttribute("aria-expanded",String(show));
        wrap.querySelector(".xy-heart-angle").textContent=show?"⌃":"⌄";
      });
    });
  }
  function settingsUI(){
    const body=document.querySelector("#panelBody");
    if(!body||body.querySelector("#xyHeartNotesToggle"))return;
    const card=document.createElement("section");
    card.className="setting-card xy-heart-setting";
    card.innerHTML='<label class="xy-heart-settings-label"><span><strong>心音胶囊</strong><small>有想说的心音才出现；点击短胶囊展开完整心音，语音只读正文。</small></span><input type="checkbox" id="xyHeartNotesToggle"></label>';
    body.appendChild(card);
    const input=card.querySelector("input");
    input.checked=enabled();
    input.addEventListener("change",()=>{
      localStorage.setItem(KEY,JSON.stringify({enabled:input.checked}));
      renderMessages();
    });
  }
  const priorRender=renderMessages;
  renderMessages=function(){
    const ret=priorRender();
    requestAnimationFrame(decorate);
    return ret;
  };
  const priorPanel=openPanel;
  openPanel=function(type){
    const ret=priorPanel(type);
    if(type==="settings")requestAnimationFrame(settingsUI);
    return ret;
  };
  window.xyHeartNotes={enabled,instruction,parse,decorate};
  requestAnimationFrame(decorate);
})();