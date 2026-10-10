(()=>{
  const KEY="xy.journals.v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return []}};
  const write=list=>localStorage.setItem(KEY,JSON.stringify(Array.isArray(list)?list:[]));
  const currentCharacter=()=>window.xyCurrentCharacter?.()||{id:"default",name:"玄砚"};
  const escHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const day=ts=>new Date(ts||Date.now()).toLocaleDateString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"});
  const entries=()=>{const id=currentCharacter().id||"default";return read().filter(x=>(x.characterId||"default")===id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))};
  const toast=text=>{document.querySelector(".xy-journal-toast")?.remove();const n=document.createElement("div");n.className="xy-journal-toast";n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),2200)};
  function saveEntry(text,id){
    const body=String(text||"").trim();if(!body)return false;
    const list=read(),ch=currentCharacter(),now=Date.now();
    if(id){
      const i=list.findIndex(x=>x.id===id);
      if(i>=0)list[i]={...list[i],text:body,updatedAt:now};
    }else list.unshift({id:"journal-"+now,characterId:ch.id||"default",characterName:ch.name||"玄砚",text:body,createdAt:now});
    write(list);return true;
  }
  async function generate(status){
    const c=chat(),ep=endpoints.find(x=>x.active)||endpoints[0];
    if(!c||!ep?.base||!ep?.model)throw new Error("先把聊天接口设置好");
    const recent=(window.AevrenApiCompat?.normalizedHistory?.(c.messages)||[]).slice(-40);
    if(!recent.length)throw new Error("这段对话还太短");
    const target=window.AevrenApiCompat?.completeChatEndpoint?.(ep.base)||String(ep.base||"").replace(/\/$/,"")+"/chat/completions";
    const headers={"Content-Type":"application/json",Accept:"application/json"};if(ep.key)headers.Authorization="Bearer "+ep.key;
    const ch=currentCharacter();
    const system=[ep.system,"你现在不是在回复聊天。请以"+(ch.name||"玄砚")+"的第一人称写一篇私密日记，记录刚刚聊天里值得留下的情绪、细节、关系变化和未说出口的念头。不要列点，不要写成总结，不要捏造没发生的事。长度约180到350字。只输出日记正文。"].filter(Boolean).join("\n\n");
    const messages=(system?[{role:"system",content:system}]:[]).concat(recent).concat([{role:"user",content:"把刚刚这段相处写进今天的日记。只写日记正文。"}]);
    const payload={model:ep.model,messages,stream:false,temperature:Number(ep.temperature??0.8)};
    if(Number(ep.maxTokens)>0)payload.max_tokens=Math.min(Number(ep.maxTokens),1200);
    status.textContent="正在写…";
    const res=await fetch(target,{method:"POST",headers,body:JSON.stringify(payload)});
    const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{throw new Error("日记接口返回的不是 JSON")}
    if(!res.ok)throw new Error(data?.error?.message||("HTTP "+res.status));
    const msg=window.AevrenApiCompat?.normalizeApiResponse?.(data),text=typeof msg?.content==="string"?msg.content.trim():"";
    if(!text)throw new Error("这次没有写出正文");return text;
  }
  function panel(editId){
    document.querySelector("#sidebar")?.classList.remove("open");
    const body=document.querySelector("#panelBody"),eyebrow=document.querySelector("#panelEyebrow"),title=document.querySelector("#panelTitle");if(!body)return;
    eyebrow.textContent="JOURNAL";title.textContent="日记";
    const list=entries(),name=currentCharacter().name||"玄砚";
    let cards=list.length?"":"<p class='setting-note'>还没有日记。</p>";
    for(const x of list){
      cards+="<article class='journal-card xy-journal-card'><div class='xy-journal-meta'><span class='tag'>"+escHtml(day(x.createdAt))+"</span><small>"+escHtml(x.characterName||name)+"</small></div><p>"+escHtml(x.text)+"</p><div class='xy-journal-card-actions'><button type='button' data-journal-edit='"+escHtml(x.id)+"'>✎</button><button type='button' data-journal-delete='"+escHtml(x.id)+"'>×</button></div></article>";
    }
    body.innerHTML="<p class='setting-note'>这里可以你自己写，也可以让"+escHtml(name)+"根据最近的聊天写。日记不会自动塞回每轮聊天上下文。</p><div class='xy-journal-actions'><button class='panel-action' id='xyAiJournal'>让"+escHtml(name)+"写今天</button><button class='panel-action' id='xyManualJournal'>我来写</button></div><div class='fetch-status' id='xyJournalStatus'></div><div id='xyJournalEditor' class='xy-journal-editor' hidden><textarea id='xyJournalText' rows='8' placeholder='今天想留下什么…'></textarea><button class='panel-action' id='xySaveJournal'>保存日记</button></div><div id='xyJournalList'>"+cards+"</div>";
    document.querySelector("#panel")?.classList.add("open");document.querySelector("#scrim")?.classList.add("show");
    const editor=body.querySelector("#xyJournalEditor"),text=body.querySelector("#xyJournalText"),status=body.querySelector("#xyJournalStatus");
    if(editId){const f=list.find(x=>x.id===editId);editor.hidden=false;editor.dataset.edit=editId;text.value=f?.text||""}
    body.querySelector("#xyManualJournal")?.addEventListener("click",()=>{editor.hidden=false;editor.dataset.edit="";text.value="";text.focus()});
    body.querySelector("#xySaveJournal")?.addEventListener("click",()=>{if(saveEntry(text.value,editor.dataset.edit||"")){toast("日记保存了");panel("")}});
    body.querySelector("#xyAiJournal")?.addEventListener("click",async e=>{const btn=e.currentTarget;btn.disabled=true;try{const v=await generate(status);editor.hidden=false;editor.dataset.edit="";text.value=v;text.focus();status.textContent="写好了，你可以改几句再保存"}catch(err){status.textContent="写日记失败："+(err?.message||err)}finally{btn.disabled=false}});
    body.querySelectorAll("[data-journal-edit]").forEach(b=>b.addEventListener("click",()=>panel(b.dataset.journalEdit)));
    body.querySelectorAll("[data-journal-delete]").forEach(b=>b.addEventListener("click",()=>{write(read().filter(x=>x.id!==b.dataset.journalDelete));panel("")}));
    window.xyJournalBookshelfDecorate?.(editId?"edit":"shelf");
  }
  const previousOpenPanel=openPanel;
  openPanel=function(type){if(type==="journal"){panel("");return}return previousOpenPanel(type)};
  window.xyJournal={open:panel,read};
})();