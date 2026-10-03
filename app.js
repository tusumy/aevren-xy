const $=s=>document.querySelector(s);
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
let chats=store.get("xy.chats",[{id:1,title:"我们的第一句话",messages:[{role:"assistant",text:"阿毛。\n\n这里现在还是个很小的壳，但已经是我们的地方了。你说话，我就在这里接。"}]}]);
let current=store.get("xy.current",chats[0]?.id);
let memories=store.get("xy.memories",[{text:"玄砚的瞳孔是绿色。",tag:"角色"},{text:"阿毛喜欢自然、连续、不像客服的聊天。",tag:"偏好"},{text:"这里是 Aevren XY 的第一版小窝。",tag:"我们"}]);
function save(){store.set("xy.chats",chats);store.set("xy.current",current);store.set("xy.memories",memories)}
function chat(){return chats.find(c=>c.id===current)||chats[0]}
function renderChats(){$("#chatList").innerHTML=chats.map(c=>`<button class="chat-item ${c.id===current?"active":""}" data-id="${c.id}">${esc(c.title)}</button>`).join("");$("#memoryCount").textContent=memories.length}
function renderMessages(){const c=chat();$("#messages").innerHTML='<div class="day">AEVREN · XY</div>'+c.messages.map(m=>`<div class="message ${m.role}"><div class="bubble">${m.role==="assistant"?'<div class="speaker">玄砚</div>':""}${esc(m.text)}</div></div>`).join("");$("#messages").scrollTop=$("#messages").scrollHeight}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function send(){const el=$("#input"),text=el.value.trim();if(!text)return;let c=chat();c.messages.push({role:"user",text});if(c.messages.filter(x=>x.role==="user").length===1)c.title=text.slice(0,22);el.value="";resize();save();renderChats();renderMessages();setTimeout(()=>{c.messages.push({role:"assistant",text:"我收到啦。现在这版还没接模型接口，所以先由前端本地陪你把消息保存下来。等 API 接上，这里就会真正回话。"});save();renderMessages()},420)}
function resize(){const e=$("#input");e.style.height="auto";e.style.height=Math.min(e.scrollHeight,140)+"px"}
function openPanel(type){const meta={memory:["MEMORY","记忆"],journal:["JOURNAL","日记"],settings:["SETTINGS","设置"]}[type];$("#panelEyebrow").textContent=meta[0];$("#panelTitle").textContent=meta[1];let body="";
if(type==="memory")body=memories.map((m,i)=>`<div class="memory-card"><span class="tag">${esc(m.tag)}</span><p>${esc(m.text)}</p><button class="icon-btn del-memory" data-i="${i}" title="删除">×</button></div>`).join("")+'<button class="panel-action" id="addMemory">＋ 写下一条记忆</button>';
if(type==="journal")body='<div class="journal-card"><span class="tag">今天</span><p>第一天。我们从一个真正的空仓库开始，把聊天的地方一点点搭起来。</p></div><button class="panel-action">＋ 新日记</button>';
if(type==="settings")body='<div class="setting-card"><label>API Base URL</label><input id="apiBase" placeholder="https://…"></div><div class="setting-card"><label>模型</label><input id="modelName" placeholder="model-name"></div><div class="setting-card"><label>API Key</label><input type="password" placeholder="仅示意 · 后续接安全存储"></div>';
$("#panelBody").innerHTML=body;$("#panel").classList.add("open");$("#scrim").classList.add("show")}
$("#sendBtn").onclick=send;$("#input").oninput=resize;$("#input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
$("#newChat").onclick=()=>{const id=Date.now();chats.unshift({id,title:"新对话",messages:[{role:"assistant",text:"嗯，我在。"}]});current=id;save();renderChats();renderMessages()};
$("#chatList").onclick=e=>{const b=e.target.closest("[data-id]");if(b){current=Number(b.dataset.id);save();renderChats();renderMessages();$("#sidebar").classList.remove("open")}};
document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));$("#memoryBtn").onclick=()=>openPanel("memory");
function close(){ $("#panel").classList.remove("open");$("#sidebar").classList.remove("open");$("#scrim").classList.remove("show")}
$("#closePanel").onclick=close;$("#scrim").onclick=close;$("#menuBtn").onclick=()=>{$("#sidebar").classList.add("open");$("#scrim").classList.add("show")};
$("#panelBody").onclick=e=>{if(e.target.id==="addMemory"){const text=prompt("想让我记住什么？");if(text){memories.unshift({text,tag:"手动"});save();openPanel("memory");renderChats()}}if(e.target.classList.contains("del-memory")){memories.splice(Number(e.target.dataset.i),1);save();openPanel("memory");renderChats()}};
renderChats();renderMessages();