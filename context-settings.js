(()=>{
  const KEY="xy.contextMessageLimit";
  if(localStorage.getItem(KEY)==null)localStorage.setItem(KEY,"40");

  function inject(type){
    if(type!=="settings")return;
    requestAnimationFrame(()=>{
      const body=document.querySelector("#panelBody");
      if(!body||body.querySelector("#xyContextMessageLimit"))return;
      const current=String(localStorage.getItem(KEY)||"40");
      const card=document.createElement("div");
      card.className="setting-card";
      card.innerHTML="<label>带给模型的最近消息</label><select id='xyContextMessageLimit' class='model-select'><option value='20'>20 条</option><option value='40'>40 条</option><option value='80'>80 条</option><option value='160'>160 条</option><option value='0'>全部</option></select><p class='setting-note'>这里只控制每轮真正发给模型的上下文长度；聊天记录本身仍然全部保存在本地，不会删掉。</p>";
      body.appendChild(card);
      const select=card.querySelector("#xyContextMessageLimit");
      select.value=["20","40","80","160","0"].includes(current)?current:"40";
      select.addEventListener("change",()=>localStorage.setItem(KEY,select.value));
    });
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){
    const r=previousOpenPanel(type);
    inject(type);
    return r;
  };
})();