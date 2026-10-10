(()=>{
  const PREF="xy.memoryPrefs.v1",SUM="xy.memorySummaries.v1";
  const preference=()=>({...{automatic:true,referenceHistory:true},...store.get(PREF,{})});
  const character=()=>window.xyCurrentCharacter?.()||{id:"xuan-yan",name:"玄砚"};
  const currentMemories=()=>memories.filter(m=>!m.characterId||m.characterId===character().id);
  const summaries=()=>store.get(SUM,{});
  const summaryFor=id=>String(summaries()[id]||"").trim();
  const summarize=()=>{
    const list=currentMemories().slice(0,12);
    return list.length?list.map(m=>String(m.text||"").trim()).filter(Boolean).join("\n").slice(0,1400):
      "还没有保存的记忆。你可以在聊天里说“记住：……”，或手动添加。";
  };
  const secret=/密码|密钥|API.?Key|验证码|身份证|银行卡|信用卡|家庭住址|医疗|诊断|病史|病历|体检|处方|政治倾向|宗教/i;
  const simplified=s=>String(s||"").replace(/[\s，。！？,.!?]/g,"").toLowerCase();
  function autoRemember(raw){
    if(!preference().automatic||!Array.isArray(memories))return;
    const value=String(raw||"").trim();
    if(value.length<5||value.length>200||secret.test(value))return;
    let match=value.match(/^(?:请你|帮我|你要|务必)?(?:记住|记一下|记得|以后记得)[：:\s，]*(.{4,150})$/);
    let fact=match?match[1]:/^(?:我喜欢|我不喜欢|我偏好|我讨厌|以后(?:请|不要|别|尽量))/.test(value)?value:"";
    fact=fact.replace(/[。！!]+$/,"").trim();
    if(!fact||secret.test(fact)||currentMemories().some(m=>simplified(m.text)===simplified(fact)))return;
    memories.unshift({text:fact,tag:"偏好",source:"自动记录",characterId:character().id,createdAt:Date.now()});
    save();renderChats();
  }
  const capture=()=>autoRemember(document.querySelector("#input")?.value||"");
  document.addEventListener("click",e=>{if(e.target.closest?.("#sendBtn"))capture()},true);
  document.addEventListener("keydown",e=>{
    if(e.target?.id==="input"&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing)capture();
  },true);
  const originalSelect=window.xySelectMemories;
  if(typeof originalSelect==="function")window.xySelectMemories=(ch,query)=>{
    const id=ch?.id||character().id;
    const found=preference().referenceHistory?originalSelect(ch,query):memories.filter(m=>!m.characterId||m.characterId===id).slice(0,7);
    const note=summaryFor(id);
    return note?[{text:note.slice(0,1800),tag:"记忆摘要",characterId:id},...found].slice(0,8):found;
  };
  const styles=document.createElement("style");
  styles.textContent=[
    ".xy-memory-manager{display:flex;flex-direction:column;gap:15px;padding-bottom:30px}",
    ".xy-memory-section{border:1px solid rgba(92,104,90,.13);border-radius:15px;background:rgba(255,255,255,.56);padding:15px}",
    ".xy-memory-section h3{font-size:14px;font-weight:600;margin:0 0 9px;color:#404942}",
    ".xy-memory-section p{white-space:pre-wrap;line-height:1.75;color:#535e55;font-size:13px;margin:8px 0}",
    ".xy-memory-description{font-size:11px;color:#7e877f;line-height:1.65}",
    ".xy-memory-line{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:14px 0}",
    ".xy-memory-line label{font-size:12px;color:#455148}",
    ".xy-memory-line input{width:18px;height:18px;accent-color:#5a6b5c}",
    ".xy-memory-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:9px}",
    ".xy-memory-actions button,.xy-memory-inline button,.xy-memory-add{border:1px solid rgba(74,90,78,.18);border-radius:10px;background:rgba(247,250,247,.92);color:#47584c;padding:7px 10px;cursor:pointer;font-size:12px}",
    ".xy-memory-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-top:1px solid rgba(83,100,88,.1);padding:10px 0}",
    ".xy-memory-item p{font-size:12px;margin:0;flex:1;overflow-wrap:anywhere}",
    ".xy-memory-item .source{display:block;color:#89938a;font-size:10px;margin-top:3px}",
    ".xy-memory-item button{font-size:11px;border:0;background:transparent;color:#687b6d;cursor:pointer;padding:3px}",
    ".xy-memory-manager textarea{display:block;width:100%;min-height:100px;border:1px solid #cbd4c9;border-radius:10px;padding:10px;background:#fff;resize:vertical;color:#36463a;font:inherit;font-size:13px;line-height:1.6}",
    ".xy-memory-inline{margin-top:10px;display:flex;flex-direction:column;gap:8px}",
    ".xy-memory-inline[hidden]{display:none}"
  ].join("\n");
  document.head.appendChild(styles);
  const originalOpen=openPanel;
  function openMemory(){
    originalOpen("memory");
    const root=document.querySelector("#panelBody"),ch=character(),list=currentMemories();
    if(!root)return;
    root.innerHTML="";
    const main=document.createElement("div");main.className="xy-memory-manager";root.appendChild(main);
    const intro=document.createElement("div");intro.className="xy-memory-description";
    intro.textContent=ch.name+"的长期记忆 · 本地保存，按角色独立管理";main.appendChild(intro);
    const addSection=(title)=>{
      const section=document.createElement("section");section.className="xy-memory-section";main.appendChild(section);
      const h=document.createElement("h3");h.textContent=title;section.appendChild(h);return section;
    };
    const button=(parent,text,action,index)=>{
      const b=document.createElement("button");b.type="button";b.textContent=text;
      b.dataset.memory=action;if(index!==undefined)b.dataset.index=String(index);
      parent.appendChild(b);return b;
    };
    const summary=addSection("记忆摘要");
    const summaryValue=summaryFor(ch.id)||summarize();
    const summaryP=document.createElement("p");summaryP.textContent=summaryValue;summary.appendChild(summaryP);
    const summaryActions=document.createElement("div");summaryActions.className="xy-memory-actions";summary.appendChild(summaryActions);
    button(summaryActions,"编辑摘要","edit-summary");
    if(summaryFor(ch.id))button(summaryActions,"恢复自动摘要","reset-summary");
    const editSummary=document.createElement("div");editSummary.className="xy-memory-inline";editSummary.id="xySummaryEdit";editSummary.hidden=true;summary.appendChild(editSummary);
    const summaryField=document.createElement("textarea");summaryField.id="xySummaryText";summaryField.value=summaryValue;editSummary.appendChild(summaryField);
    button(editSummary,"保存摘要","save-summary");
    const settings=addSection("记忆设置");
    const option=(text,id,key)=>{
      const row=document.createElement("div");row.className="xy-memory-line";settings.appendChild(row);
      const label=document.createElement("label");label.htmlFor=id;label.textContent=text;row.appendChild(label);
      const cb=document.createElement("input");cb.type="checkbox";cb.id=id;cb.dataset.option=key;cb.checked=!!preference()[key];row.appendChild(cb);
    };
    option("自动记住明确表达的偏好","xyAutoMemory","automatic");
    option("参考以前的聊天","xyMemoryRecall","referenceHistory");
    const hint=document.createElement("div");hint.className="xy-memory-description";
    hint.textContent="只自动记录明确表达的偏好或“记住”指令；所有记忆都可以编辑和删除。";settings.appendChild(hint);
    const listSection=addSection("已保存的记忆（"+list.length+"）");
    const top=document.createElement("div");top.className="xy-memory-actions";listSection.appendChild(top);
    button(top,"＋ 添加记忆","add");
    for(const m of list){
      const item=document.createElement("div");item.className="xy-memory-item";listSection.appendChild(item);
      const box=document.createElement("div");box.style.flex="1";item.appendChild(box);
      const p=document.createElement("p");p.textContent=m.text||"";box.appendChild(p);
      const src=document.createElement("span");src.className="source";
      src.textContent=(m.tag||"记忆")+" · "+(m.source==="自动记录"?"自动记录":"已保存");box.appendChild(src);
      button(item,"编辑","edit",memories.indexOf(m));button(item,"删除","delete",memories.indexOf(m));
    }
    const editor=document.createElement("div");editor.id="xyMemoryEdit";editor.className="xy-memory-inline";editor.hidden=true;listSection.appendChild(editor);
    const textarea=document.createElement("textarea");textarea.id="xyMemoryText";textarea.placeholder="要记住的事情";editor.appendChild(textarea);
    button(editor,"保存这条记忆","save-item");
  }
  openPanel=function(type){return type==="memory"?openMemory():originalOpen(type)};
  const root=document.querySelector("#panelBody");
  root?.addEventListener("change",e=>{
    const key=e.target?.dataset?.option;
    if(!key||!root.querySelector(".xy-memory-manager"))return;
    store.set(PREF,{...preference(),[key]:!!e.target.checked});
  });
  root?.addEventListener("click",e=>{
    const btn=e.target.closest?.("[data-memory]");
    if(!btn||!root.querySelector(".xy-memory-manager"))return;
    const action=btn.dataset.memory,index=Number(btn.dataset.index);
    if(action==="edit-summary"){
      const block=root.querySelector("#xySummaryEdit");block.hidden=false;block.querySelector("textarea").focus();return;
    }
    if(action==="save-summary"||action==="reset-summary"){
      const data=summaries();
      if(action==="reset-summary")delete data[character().id];
      else data[character().id]=String(root.querySelector("#xySummaryText")?.value||"").trim().slice(0,2500);
      store.set(SUM,data);openMemory();return;
    }
    if(action==="add"||action==="edit"){
      const editor=root.querySelector("#xyMemoryEdit"),textarea=root.querySelector("#xyMemoryText");
      editor.hidden=false;editor.dataset.index=action==="edit"?String(index):"";
      textarea.value=action==="edit"?(memories[index]?.text||""):"";textarea.focus();return;
    }
    if(action==="save-item"){
      const editor=root.querySelector("#xyMemoryEdit"),i=editor.dataset.index;
      const text=String(root.querySelector("#xyMemoryText")?.value||"").trim().slice(0,2000);
      if(!text)return;
      if(i!==""&&memories[Number(i)])memories[Number(i)].text=text;
      else memories.unshift({text,tag:"手动",characterId:character().id,createdAt:Date.now()});
      save();renderChats();openMemory();return;
    }
    if(action==="delete"&&Number.isInteger(index)&&memories[index]){
      memories.splice(index,1);save();renderChats();openMemory();
    }
  });
})();
