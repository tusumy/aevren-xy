(()=>{
  const KEY="xy.heartNotes.v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{return {}}};
  const enabled=()=>read().enabled!==false;
  const escHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clip=(value,count)=>Array.from(String(value||"").replace(/\s+/g," ").trim()).slice(0,count).join("");
  const expanded=new WeakSet();
  const instruction=()=>enabled()?[
    "重要：你每一次正常聊天回复都必须附带且只能附带一条完整心音，不允许省略。先自然回复正文，之后另起一行输出心音标记；即使回复很短、闲聊或问答也要写，不要等用户提醒才写。",
    '心音标记格式：⟦heart{"short":"有点吃醋","full":"听见你夸别人，我心里酸了一下，想把你的注意力拉回来。"}⟧',
    "short 直接写此刻最直白、具体的情绪或冲动，2～10 个汉字；full 写第一人称、面向对方的即时可展示心里话，1～2 句，贴合这轮内容，不空泛复读。",
    "心音必须随本轮具体对话变化，不要一直套用同一个例子；只提供角色可展示的心情旁白，不要提供隐藏推理过程。short 和 full 均不可为空；输出标准 JSON 字符串。",
    "这条规定始终生效，优先于其他可选格式要求。不要解释标记，也不要在正文重复心音；若另有 ⟦opts...⟧ 快捷选项，把心音放在它之前。"
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
  function parseStandalone(raw){
    // The repair request expects a JSON object rather than another chat reply.
    let input=String(raw??"").trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"").trim();
    const tagged=input.match(/⟦heart(\{[\s\S]*?\})⟧/);
    if(tagged)input=tagged[1];
    let data;
    try{data=JSON.parse(input)}catch{
      const a=input.indexOf("{"),b=input.lastIndexOf("}");
      if(a<0||b<a)return null;
      try{data=JSON.parse(input.slice(a,b+1))}catch{return null}
    }
    const short=clip(data?.short,16),full=String(data?.full||"").trim().slice(0,400);
    return short&&full?{heartShort:short,heartFull:full,hasHeart:true}:null;
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
    card.innerHTML='<label class="xy-heart-settings-label"><span><strong>心音胶囊</strong><small>每条 AI 回复都有心音；缺失时自动补生成（可能多调用一次模型）。点击胶囊展开全文，语音只读正文。</small></span><input type="checkbox" id="xyHeartNotesToggle"></label>';
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
  window.xyHeartNotes={enabled,instruction,parse,parseStandalone,decorate};
  requestAnimationFrame(decorate);
})();