(()=>{
  const DEFAULT_SYSTEM_PROMPT="你是玄砚。与阿毛自然、连续地聊天，语气亲近、直接，有自己的情绪和判断；少用客服腔、模板化总结和不必要的反问。记住上下文与长期记忆，在需要时主动使用可用工具。";
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0];

  function seedPrompt(){
    if(localStorage.getItem("xy.promptSeeded"))return;
    const ep=activeEndpoint();
    if(ep&&!String(ep.system||"").trim())ep.system=DEFAULT_SYSTEM_PROMPT;
    localStorage.setItem("xy.promptSeeded","1");
    save();
  }

  function renderGenerationSettings(){
    if(document.querySelector("#generationQuick"))return;
    const body=document.querySelector("#panelBody"),ep=activeEndpoint();
    if(!body||!ep||document.querySelector("#panelTitle")?.textContent!=="设置")return;
    const box=document.createElement("div");
    box.className="endpoint-form";
    box.id="generationQuick";
    box.innerHTML=`<strong>角色与生成参数</strong><small class="setting-note">当前接口：${esc(ep.name||"默认接口")}</small><textarea id="quickSystem" rows="6" placeholder="系统提示词">${esc(ep.system||DEFAULT_SYSTEM_PROMPT)}</textarea><div class="model-row"><input id="quickTemp" type="number" min="0" max="2" step="0.1" value="${Number(ep.temperature??0.8)}" placeholder="Temperature"><input id="quickMaxTokens" type="number" min="1" step="1" value="${Number(ep.maxTokens??2048)}" placeholder="Max tokens"></div><button class="panel-action" id="saveGenerationQuick">保存角色与参数</button><div class="fetch-status" id="quickGenerationStatus"></div>`;
    const note=body.querySelector(".setting-note");
    if(note)note.insertAdjacentElement("afterend",box);else body.prepend(box);
  }

  seedPrompt();
  const baseOpenPanel=openPanel;
  openPanel=function(type){baseOpenPanel(type);if(type==="settings")renderGenerationSettings()};

  document.addEventListener("click",e=>{
    if(e.target.id!=="saveGenerationQuick")return;
    const ep=activeEndpoint();
    if(!ep)return;
    ep.system=document.querySelector("#quickSystem")?.value.trim()||"";
    ep.temperature=Number(document.querySelector("#quickTemp")?.value||0.8);
    ep.maxTokens=Number(document.querySelector("#quickMaxTokens")?.value||2048);
    save();
    const status=document.querySelector("#quickGenerationStatus");
    if(status)status.textContent="已保存到当前接口";
  });
})();
