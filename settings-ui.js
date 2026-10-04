(()=>{
  const DEFAULT_SYSTEM_PROMPT="你是玄砚。与阿毛自然、连续地聊天，语气亲近、直接，有自己的情绪和判断；少用客服腔、模板化总结和不必要的反问。记住上下文与长期记忆，在需要时主动使用可用工具。";
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0];
  const inheritedPrompt=String(activeEndpoint()?.system||"").trim()||DEFAULT_SYSTEM_PROMPT;

  let characters=store.get("xy.characters",[{id:"xuan-yan",name:"玄砚",system:inheritedPrompt}]);
  if(!Array.isArray(characters)||!characters.length)characters=[{id:"xuan-yan",name:"玄砚",system:DEFAULT_SYSTEM_PROMPT}];

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
    const ch=currentCharacter();
    document.querySelectorAll(".speaker").forEach(x=>x.textContent=ch.name);
    const name=document.querySelector(".presence strong");
    if(name)name.textContent=ch.name;
    updateMemoryCount();
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
  const sendButton=document.querySelector("#sendBtn");
  if(sendButton)sendButton.onclick=send;

  const baseNewChat=document.querySelector("#newChat")?.onclick;
  if(baseNewChat)document.querySelector("#newChat").onclick=()=>{
    baseNewChat();
    const c=chat();
    if(c){c.characterId=defaultCharacterId;save()}
    refreshCharacterLabels();
  };

  function renderMemoryPanel(){
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="MEMORY";
    document.querySelector("#panelTitle").textContent="记忆";
    const body=document.querySelector("#panelBody"),ch=currentCharacter();
    const scoped=allMemories.map((m,i)=>({m,i})).filter(x=>x.m.characterId===ch.id);
    body.innerHTML=`<p class="setting-note">当前角色：${esc(ch.name)}。记忆会按需召回，也会从这个角色的旧聊天里找相关片段。</p>${scoped.map(({m,i})=>`<div class="memory-card"><span class="tag">${esc(m.tag||"手动")}</span><p>${esc(m.text)}</p><button class="icon-btn char-del-memory" data-i="${i}" title="删除">×</button></div>`).join("")}<button class="panel-action" id="charAddMemory">＋ 写下一条 ${esc(ch.name)} 的记忆</button>`;
    document.querySelector("#panel").classList.add("open");
    document.querySelector("#scrim").classList.add("show");
    updateMemoryCount();
  }

  function renderCharacters(){
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="CHARACTERS";
    document.querySelector("#panelTitle").textContent="角色";
    const body=document.querySelector("#panelBody"),active=currentCharacter();
    body.innerHTML=`<p class="setting-note">角色和 API 已分开。每个聊天会记住自己的角色，每个角色也有自己的长期记忆。</p><div id="characterList">${characters.map((x,i)=>`<div class="character-card ${x.id===active.id?"active":""}"><div><strong>${esc(x.name)}</strong><small>${memoriesFor(x.id).length} 条记忆 · ${x.id===active.id?"当前聊天正在使用":"点击使用即可切换"}</small></div><div class="character-actions"><button class="use-character" data-i="${i}">${x.id===active.id?"使用中":"使用"}</button><button class="edit-character" data-i="${i}">✎</button><button class="delete-character" data-i="${i}">×</button></div></div>`).join("")}</div><button class="panel-action" id="addCharacter">＋ 新增角色</button><div class="endpoint-form" id="characterForm" hidden><input id="characterName" placeholder="角色名称"><textarea id="characterSystem" rows="9" placeholder="系统提示词"></textarea><button class="panel-action" id="saveCharacter">保存角色</button><div class="fetch-status" id="characterStatus"></div></div>`;
    document.querySelector("#panel").classList.add("open");
    document.querySelector("#scrim").classList.add("show");
  }

  function decorateSettings(){
    const sys=document.querySelector("#endpointSystem");
    if(sys)sys.style.display="none";
    const note=document.querySelector("#panelBody > .setting-note");
    if(note)note.textContent="这里仅管理 API 通道。角色与记忆在侧栏中单独管理；API Key 只保存在当前浏览器本地。";
  }

  const baseOpenPanel=openPanel;
  openPanel=function(type){
    if(type==="characters"){renderCharacters();return}
    if(type==="memory"){renderMemoryPanel();return}
    baseOpenPanel(type);
    if(type==="settings")decorateSettings();
  };

  document.addEventListener("click",e=>{
    if(e.target.id==="addEndpoint"||e.target.classList.contains("edit-endpoint"))requestAnimationFrame(()=>document.querySelector("#endpointForm")?.scrollIntoView({behavior:"smooth",block:"start"}));

    if(e.target.id==="charAddMemory"){
      const ch=currentCharacter(),text=prompt("想让"+ch.name+"记住什么？");
      if(text){allMemories.unshift({text,tag:"手动",characterId:ch.id});memories=allMemories;save();renderMemoryPanel();renderChats()}
      return;
    }

    if(e.target.classList.contains("char-del-memory")){
      allMemories.splice(Number(e.target.dataset.i),1);
      memories=allMemories;save();renderMemoryPanel();renderChats();return;
    }

    if(e.target.id==="addCharacter"){
      const f=document.querySelector("#characterForm");
      f.hidden=false;f.dataset.edit="";
      document.querySelector("#characterName").value="";
      document.querySelector("#characterSystem").value="";
      f.scrollIntoView({behavior:"smooth",block:"start"});return;
    }

    if(e.target.classList.contains("use-character")){
      const x=characters[Number(e.target.dataset.i)],c=chat();
      if(!x||!c)return;
      c.characterId=x.id;defaultCharacterId=x.id;persistCharacters();save();syncPrompt();renderMessages();renderCharacters();return;
    }

    if(e.target.classList.contains("edit-character")){
      const i=Number(e.target.dataset.i),x=characters[i],f=document.querySelector("#characterForm");
      if(!x||!f)return;
      f.hidden=false;f.dataset.edit=String(i);
      document.querySelector("#characterName").value=x.name;
      document.querySelector("#characterSystem").value=x.system||"";
      f.scrollIntoView({behavior:"smooth",block:"start"});return;
    }

    if(e.target.classList.contains("delete-character")){
      const i=Number(e.target.dataset.i);
      if(characters.length===1)return;
      const removed=characters[i];
      characters.splice(i,1);
      if(defaultCharacterId===removed.id)defaultCharacterId=characters[0].id;
      chats.forEach(c=>{if(c.characterId===removed.id)c.characterId=defaultCharacterId});
      persistCharacters();save();syncPrompt();renderMessages();renderCharacters();return;
    }

    if(e.target.id==="saveCharacter"){
      const f=document.querySelector("#characterForm"),edit=f.dataset.edit,name=document.querySelector("#characterName").value.trim()||"未命名角色",system=document.querySelector("#characterSystem").value.trim();
      if(edit!==""){
        const old=characters[Number(edit)];
        characters[Number(edit)]={...old,name,system};
      }else characters.push({id:"char-"+Date.now(),name,system});
      persistCharacters();renderCharacters();return;
    }
  });

  memories=allMemories;
  save();
  syncPrompt();
  renderMessages();
  renderChats();
})();
