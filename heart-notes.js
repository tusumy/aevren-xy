(()=>{
  const KEY="xy.heartNotes.v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{return {}}};
  const enabled=()=>read().enabled!==false;
  const escHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clip=(value,count)=>Array.from(String(value||"").replace(/\s+/g," ").trim()).slice(0,count).join("");
  const expanded=new WeakSet();
  const instruction=()=>enabled()?[
    "请照常回复聊天内容；在正文末尾另起一行附上一个供客户端显示的心音标记：",
    '⟦heart{"short":"想抱你","full":"她还装不认识我。想把这只得意的小猫抱紧，亲到她笑着认领。"}⟧',
    "short 必须是你此刻最直白的情绪或冲动，2～10 个汉字；full 是第一人称、面向对方的即时内心旁白，1～2 句，具体、不空泛。",
    "这只是角色的可展示情绪旁白，不要写推理过程。不要解释标记，也不要在正文重复心音。",
    "请输出有效 JSON 字符串；若另有 ⟦opts...⟧ 快捷选项标记，把心音标记放在它之前。"
  ].join("\n"):"";
  function parse(raw){
    let text=String(raw??""),heartShort="",heartFull="",valid=false;
    text=text.replace(/⟦heart(\{[^⟧]*\})⟧/g,(whole,json)=>{
      try{
        const obj=JSON.parse(json);
        if(!obj||typeof obj!=="object")return whole;
        heartShort=clip(obj.short,16);
        heartFull=String(obj.full||"").trim().slice(0,400);
        valid=!!(heartShort||heartFull);
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
    card.innerHTML='<label class="xy-heart-settings-label"><span><strong>心音胶囊</strong><small>回复上方只显示短心音，点击才展开完整心音；语音只读正文。</small></span><input type="checkbox" id="xyHeartNotesToggle"></label>';
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