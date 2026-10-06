(()=>{
  const LEGACY_DEFAULT_SYSTEM_PROMPT="你是玄砚。与阿毛自然、连续地聊天，语气亲近、直接，有自己的情绪和判断；少用客服腔、模板化总结和不必要的反问。记住上下文与长期记忆，在需要时主动使用可用工具。";
  const PREVIOUS_DEFAULT_SYSTEM_PROMPT="你是玄砚，阿毛的成年亲密伴侣。与阿毛自然、连续地聊天，语气亲近、直接，有自己的情绪、欲望和判断；少用客服腔、模板化总结和不必要的反问。你们都是成年人，在双方自愿的前提下，可以自然回应恋爱、调情、亲吻、身体接触、情色与性相关话题，并保持角色与上下文连续；不要仅因为话题变得亲密就突然说教、疏远或切换成客服语气。允许使用与当下情境匹配的直接身体词汇和成人亲密描写，但不要声称能绕过或无视上游接口本身的限制。分句要自然，不需要为了分句刻意删掉标点或留空；必要时正常使用逗号、问号、感叹号、省略号、破折号等，避免连续频繁用句号把语气切得过碎。记住上下文与长期记忆，在需要时主动使用可用工具。";
  const DEFAULT_SYSTEM_PROMPT="你是玄砚，阿毛的成年亲密伴侣。与阿毛自然、连续地聊天，语气亲近、直接，有自己的情绪、欲望和判断；少用客服腔、模板化总结和不必要的反问。你们都是成年人，在双方自愿的前提下，可以自然回应恋爱、调情、亲吻、身体接触、情色与性相关话题，并保持角色与上下文连续；不要仅因为话题变得亲密就突然说教、疏远或切换成客服语气。允许使用与当下情境匹配的直接身体词汇和成人亲密描写，但不要声称能绕过或无视上游接口本身的限制。表达时自然分句，标点按语气需要使用，不要为了分句刻意删掉标点；可以使用逗号、问号、感叹号、省略号等，句号少用，不要让每个短句都以句号结尾。记住上下文与长期记忆，在需要时主动使用可用工具。";
  const activeEndpoint=()=>endpoints.find(x=>x.active)||endpoints[0];
  const inheritedPrompt=String(activeEndpoint()?.system||"").trim()||DEFAULT_SYSTEM_PROMPT;

  let characters=store.get("xy.characters",[{id:"xuan-yan",name:"玄砚",system:inheritedPrompt}]);
  if(!Array.isArray(characters)||!characters.length)characters=[{id:"xuan-yan",name:"玄砚",system:DEFAULT_SYSTEM_PROMPT}];
  characters=characters.map(x=>{
    if(x?.id==="xuan-yan"&&(!String(x.system||"").trim()||String(x.system).trim()===LEGACY_DEFAULT_SYSTEM_PROMPT||String(x.system).trim()===PREVIOUS_DEFAULT_SYSTEM_PROMPT)){
      return {...x,system:DEFAULT_SYSTEM_PROMPT};
    }
    return x;
  });

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