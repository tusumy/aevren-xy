(()=>{
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0]||null;
  let characters=store.get("xy.characters",[{id:"xuan-yan",name:"玄砚",system:""}]);
  if(!Array.isArray(characters)||!characters.length)characters=[{id:"xuan-yan",name:"玄砚",system:""}];
  characters=characters.map(x=>({id:String(x?.id||Date.now()),name:String(x?.name||"角色"),system:String(x?.system||"")}));

  const resetKey="xy.xuanPromptCleared.v1";
  if(!store.get(resetKey,false)){
    characters=characters.map(x=>x.id==="xuan-yan"?{...x,system:""}:x);
    store.set(resetKey,true);
  }

  let defaultCharacterId=store.get("xy.defaultCharacter",characters[0].id);
  if(!characters.some(x=>x.id===defaultCharacterId))defaultCharacterId=characters[0].id;

  const legacyCharacterId=characters.some(x=>x.id==="xuan-yan")?"xuan-yan":characters[0].id;
  let allMemories=(Array.isArray(memories)?memories:[]).map(m=>({...m,characterId:m.characterId||legacyCharacterId}));
  memories=allMemories;

  const persistCharacters=()=>{store.set("xy.characters",characters);store.set("xy.defaultCharacter",defaultCharacterId)};
  const findCharacter=id=>characters.find(x=>x.id===id)||characters[0];
  const currentCharacter=()=>findCharacter(chat()?.characterId||defaultCharacterId);
  const memoriesFor=id=>allMemories.filter(m=>m.characterId===id);
  window.xyCurrentCharacter=currentCharacter;

  chats.forEach(c=>{if(!c.characterId)c.characterId=defaultCharacterId});
  persistCharacters();

  const baseSave=save;
  save=function(){
    const visible=memories;
    memories=allMemories;
    baseSave();
    memories=visible;
    persistCharacters();
  };

  function updateMemoryCount(){
    const badge=document.querySelector("#memoryCount"),ch=currentCharacter();
    if(badge&&ch)badge.textContent=memoriesFor(ch.id).length;
  }

  function syncPrompt(){
    const ep=activeEndpoint(),ch=currentCharacter();
    if(ep&&ch)ep.system=ch.system||"";
  }

  function refreshCharacterLabels(){
    const ch=currentCharacter();if(!ch)return;
    document.querySelectorAll(".speaker").forEach(x=>x.textContent=ch.name);
    const name=document.querySelector(".presence strong");if(name)name.textContent=ch.name;
    updateMemoryCount();
  }

  function characterPanel(editId=""){
    document.querySelector("#sidebar")?.classList.remove("open");
    const body=document.querySelector("#panelBody"),eyebrow=document.querySelector("#panelEyebrow"),title=document.querySelector("#panelTitle");
    if(!body)return;if(eyebrow)eyebrow.textContent="CHARACTER";if(title)title.textContent="角色";
    const active=currentCharacter()?.id;
    body.innerHTML=`
      <p class="setting-note">角色提示词完全由你自己填写；默认角色不再内置玄砚提示词。</p>
      <div id="xyCharacterList">${characters.map((x,i)=>`
        <div class="character-card ${x.id===active?"active":""}" data-character-card="${esc(x.id)}">
          <strong>${esc(x.name)}</strong>
          <small>${x.system?"已设置角色提示词":"未设置角色提示词"}</small>
          <div class="character-actions">
            <button type="button" class="use-character" data-character-use="${esc(x.id)}">使用</button>
            <button type="button" data-character-edit="${esc(x.id)}">✎</button>
            ${characters.length>1?`<button type="button" data-character-delete="${esc(x.id)}">×</button>`:""}
          </div>
        </div>`).join("")}</div>
      <button class="panel-action" id="xyAddCharacter">＋ 新角色</button>
      <div class="endpoint-form" id="xyCharacterForm" ${editId?"":"hidden"}>
        <input id="xyCharacterName" placeholder="角色名字">
        <textarea id="xyCharacterSystem" rows="8" placeholder="角色提示词（可留空）"></textarea>
        <button class="panel-action" id="saveCharacter">保存角色</button>
      </div>`;
    document.querySelector("#panel")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show");

    const form=body.querySelector("#xyCharacterForm");
    if(editId){
      const x=findCharacter(editId);
      form.dataset.edit=editId;
      body.querySelector("#xyCharacterName").value=x?.name||"";
      body.querySelector("#xyCharacterSystem").value=x?.system||"";
    }

    body.querySelector("#xyAddCharacter")?.addEventListener("click",()=>{
      form.hidden=false;form.dataset.edit="";
      body.querySelector("#xyCharacterName").value="";
      body.querySelector("#xyCharacterSystem").value="";
      body.querySelector("#xyCharacterName").focus();
    });
    body.querySelectorAll("[data-character-edit]").forEach(btn=>btn.addEventListener("click",()=>characterPanel(btn.dataset.characterEdit)));
    body.querySelectorAll("[data-character-use]").forEach(btn=>btn.addEventListener("click",()=>{
      const id=btn.dataset.characterUse,c=chat();if(!characters.some(x=>x.id===id))return;
      if(c)c.characterId=id;defaultCharacterId=id;save();syncPrompt();renderMessages();renderChats();characterPanel();
    }));
    body.querySelectorAll("[data-character-delete]").forEach(btn=>btn.addEventListener("click",()=>{
      const id=btn.dataset.characterDelete;if(characters.length<=1)return;
      characters=characters.filter(x=>x.id!==id);
      if(defaultCharacterId===id)defaultCharacterId=characters[0].id;
      chats.forEach(c=>{if(c.characterId===id)c.characterId=defaultCharacterId});
      allMemories=allMemories.filter(m=>m.characterId!==id);memories=allMemories;
      save();renderMessages();renderChats();characterPanel();
    }));
    body.querySelector("#saveCharacter")?.addEventListener("click",()=>{
      const name=body.querySelector("#xyCharacterName")?.value.trim()||"未命名角色";
      const system=body.querySelector("#xyCharacterSystem")?.value.trim()||"";
      const edit=form.dataset.edit||"";
      if(edit){
        const i=characters.findIndex(x=>x.id===edit);if(i>=0)characters[i]={...characters[i],name,system};
      }else{
        const id="role-"+Date.now();characters.push({id,name,system});defaultCharacterId=id;
        const c=chat();if(c)c.characterId=id;
      }
      save();syncPrompt();renderMessages();renderChats();characterPanel();
    });
  }

  const baseRenderChats=renderChats;
  renderChats=function(){baseRenderChats();updateMemoryCount()};

  const baseRenderMessages=renderMessages;
  renderMessages=function(){baseRenderMessages();refreshCharacterLabels()};

  const baseShowTyping=showTyping;
  showTyping=function(){baseShowTyping();refreshCharacterLabels()};

  const baseSend=send;
  send=async function(){
    syncPrompt();
    const full=allMemories,ch=currentCharacter(),query=document.querySelector("#input")?.value.trim()||"";
    const selected=ch&&window.xySelectMemories?window.xySelectMemories(ch,query):ch?memoriesFor(ch.id):full;
    memories=Array.isArray(selected)?selected:ch?memoriesFor(ch.id):full;
    try{return await baseSend()}
    finally{memories=full;updateMemoryCount()}
  };
  const sendButton=document.querySelector("#sendBtn");if(sendButton)sendButton.onclick=send;

  const previousOpenPanel=openPanel;
  openPanel=function(type){if(type==="characters"){characterPanel();return}return previousOpenPanel(type)};

  document.querySelector("#newChat")?.addEventListener("click",()=>requestAnimationFrame(()=>{
    const c=chat();if(c&&!c.characterId){c.characterId=defaultCharacterId;save()}refreshCharacterLabels();
  }));

  syncPrompt();refreshCharacterLabels();save();
})();