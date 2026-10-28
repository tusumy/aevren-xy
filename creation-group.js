/* Standalone group conversations, each participant takes their own model turn. */
(()=>{
"use strict";
const C=window.xyCreative;if(!C)return;
const {esc}=C;
const host=document.querySelector("#panelBody"),panel=document.querySelector("#panel");
let active="",busy=false,formBook="",selectedIds=[],notice="",apiBindingsOpen=false;
function chips(ids){return '<div class="xy-c-roles">'+C.chars().map(x=>'<label><input data-group-member type="checkbox" value="'+esc(x.id)+'" '+(ids.includes(String(x.id))?"checked":"")+'><span>'+esc(x.name)+'</span></label>').join("")+'</div>'}
function composer(){
 return '<div class="xy-c-head"><button data-g="shelf">← 书架</button></div><div class="xy-c-hero"><small>GROUP CHAT</small><h2>创建群聊</h2><p>多个角色共处一室，你说话，他们分别回应。</p></div>'+
 '<label>群聊名称<input id="xyGtitle" maxlength="100" placeholder="例如：云海茶会"></label>'+
 '<label>关联设定书（可留空）<select id="xyGbook"><option value="">自由群聊 · 不关联</option>'+C.books().map(b=>'<option value="'+esc(b.id)+'" '+(formBook===b.id?"selected":"")+'>'+esc(b.title)+'</option>').join("")+'</select></label>'+
 '<div class="xy-c-label">选参与角色（至少两位）</div>'+chips(selectedIds)+
 '<button data-g="create" class="xy-c-primary">创建群聊</button>';
}
// Persist these bindings ON THE GROUP; never mutate endpoints.active or a private chat.
function endpointFor(g,ch){
 const b=g.apiBindings?.[String(ch.id)]||{};
 let ep;
 if(b.endpointId){
   ep=endpoints.find(x=>String(x.id)===String(b.endpointId)&&x.base);
   if(!ep)throw Error("角色「"+ch.name+"」绑定的接口已删除或未填写地址，请重新绑定");
 }else ep=endpoints.find(x=>x.active)||endpoints[0];
 if(!ep?.base)throw Error("角色「"+ch.name+"」还没有可用接口");
 const model=String(b.model||ep.model||"").trim();
 if(!model)throw Error("角色「"+ch.name+"」的接口还没有选择模型");
 return {endpoint:ep,model};
}
function apiControls(g){
 const bindings=g.apiBindings||{};
 const opts=(selected)=>'<option value="">跟随当前默认接口</option>'+
  endpoints.map(ep=>'<option value="'+esc(ep.id)+'" '+(selected===String(ep.id)?"selected":"")+'>'+esc(ep.name||ep.model||"接口")+' · '+esc(ep.model||"未选模型")+'</option>').join("");
 const rows=(g.characterIds||[]).map(id=>{
   const char=C.chars().find(x=>String(x.id)===String(id));
   if(!char)return "";
   const conf=bindings[String(id)]||{};
   const chosen=String(conf.endpointId||"");
   const ep=chosen?endpoints.find(x=>String(x.id)===chosen):(endpoints.find(x=>x.active)||endpoints[0]);
   return '<div class="xy-g-api-row"><strong>'+esc(char.name)+'</strong>'+
     '<label>使用接口<select data-g-api-endpoint="'+esc(id)+'">'+opts(chosen)+'</select></label>'+
     '<label>模型名称（留空跟随接口默认）<input data-g-api-model="'+esc(id)+'" value="'+esc(conf.model||"")+'" placeholder="'+esc(ep?.model||"默认模型")+'"></label></div>';
 }).join("");
 return '<details class="xy-g-api" '+(apiBindingsOpen?'open':'')+'><summary>角色 API 绑定 <span>每个角色可用不同接口和模型</span></summary>'+
 '<div class="xy-g-api-list">'+rows+'</div><p class="xy-c-note">只影响本群聊。未单独指定的角色使用当前默认接口；API 密钥仍保存在原接口设置中。</p></details>';
}
function conversation(g){
 const book=C.book(g.bookId);
 return '<div class="xy-c-head"><button data-g="shelf">← 书架</button><button class="warning" data-g="remove">删除群聊</button></div>'+
 '<div class="xy-c-hero"><small>GROUP ROOM'+(book?" · "+esc(book.title):"")+'</small><h2>'+esc(g.title)+'</h2><p>'+esc(C.names(g.characterIds))+' · 独立聊天记录</p></div>'+
 apiControls(g)+
 '<div class="xy-c-dialogue" id="xyGmessages" role="log" aria-live="polite">'+(g.messages||[]).map(m=>
 '<article class="xy-c-speech '+(m.role==="user"?"mine":"")+'"><small>'+esc(m.role==="user"?"我":m.name||C.names([m.characterId]))+'</small><p>'+esc(m.text)+'</p></article>').join("")+'</div>'+
 '<div class="xy-c-send"><textarea id="xyGinput" rows="3" maxlength="5000" placeholder="对大家说点什么……" '+(busy?"disabled":"")+'></textarea>'+
 '<button data-g="send" '+(busy?"disabled":"")+'>'+(busy?"角色正在回复…":"发送消息")+'</button></div>'+
 '<small class="xy-c-note">每名角色独立请求各自绑定的模型；没绑定则使用默认接口。不会发送到外部群聊。</small>';
}
function render(){
 const g=C.group(active);
 host.innerHTML='<div id="xyCreativeGroup">'+(notice?'<p class="xy-c-error">'+esc(notice)+'</p>':"")+(g?conversation(g):composer())+'</div>';notice="";
 host.querySelector("#xyGmessages")?.scrollTo(0,999999);
}
function show(id=""){
 active=id;apiBindingsOpen=false;panel.classList.add("xy-creative-panel","open");
 document.querySelector("#sidebar")?.classList.remove("open");
 document.querySelector("#panelEyebrow").textContent="AEVREN · GROUP";
 document.querySelector("#panelTitle").textContent=id?"群聊":"创建群聊";
 document.querySelector("#scrim")?.classList.add("show");
 window.xyEnsureOverlayHistory?.();render();
}
function newGroup(book=null){selectedIds=(book?.characterIds||[]).map(String);formBook=book?.id||"";show()}
async function reply(g,ch){
 const {endpoint:ep,model}=endpointFor(g,ch);
 const url=window.AevrenApiCompat?.completeChatEndpoint?.(ep.base)||String(ep.base).replace(/\/$/,"")+"/chat/completions";
 const world=C.book(g.bookId)?.world||"";
 const globalSystem=window.xyIsCharacterSystem?.(ep.system)?"":ep.system||"";
 const system=[globalSystem,ch.system||"","你仅扮演群聊中的「"+ch.name+"」。使用第一人称自然交流。其他人的发言是上下文，不能替他们说话，不能编造别人的回复。",world?"故事背景：\n"+world.slice(0,16000):""].filter(Boolean).join("\n\n");
 const messages=[{role:"system",content:system},...(g.messages||[]).slice(-36).map(m=>({role:m.role==="user"?"user":"assistant",content:(m.role==="user"?"用户":m.name||C.names([m.characterId]))+"："+m.text})),{role:"user",content:"请以「"+ch.name+"」的身份自然回应群聊刚才的话。只写你自己的发言。"}];
 const payload={model,stream:false,temperature:Number(ep.temperature??0.8),messages};
 if(Number(ep.maxTokens)>0)payload.max_tokens=Number(ep.maxTokens);
 const headers={"Content-Type":"application/json",Accept:"application/json"};
 if(ep.key)headers.Authorization="Bearer "+ep.key;
 const response=await fetch(url,{method:"POST",headers,body:JSON.stringify(payload)});
 if(!response.ok)throw Error("HTTP "+response.status+" "+(await response.text()).slice(0,120));
 const data=await response.json();let content=data?.choices?.[0]?.message?.content??data?.choices?.[0]?.text??data?.output_text;
 if(Array.isArray(content))content=content.map(x=>x?.text||"").join(" ");
 if(!String(content||"").trim())throw Error("接口没有返回可用的文字");
 return String(content).trim();
}
async function send(){
 if(busy)return;let g=C.group(active),text=host.querySelector("#xyGinput")?.value.trim();
 if(!g||!text)return;g.messages??=[];
 g.messages.push({id:C.id(),role:"user",text:text.slice(0,5000),at:Date.now()});C.saveGroup(g);
 busy=true;render();
 try{
  for(const id of g.characterIds||[]){
   const ch=C.chars().find(x=>String(x.id)===String(id));if(!ch)continue;
   const content=await reply(g,ch);
   const current=C.group(g.id);if(!current)break;
   g=current;g.messages.push({id:C.id(),role:"assistant",characterId:String(ch.id),name:ch.name,text:content,at:Date.now()});C.saveGroup(g);
   if(active===g.id)render();
  }
 }catch(e){notice="回复中断："+String(e.message||e).slice(0,170)}
 finally{busy=false;if(active===g.id)render()}
}
host?.addEventListener("toggle",e=>{
 if(e.target?.matches?.(".xy-g-api"))apiBindingsOpen=Boolean(e.target.open);
},true);
host?.addEventListener("change",e=>{
 const target=e.target,id=target?.dataset?.gApiEndpoint||target?.dataset?.gApiModel;
 if(!id)return;
 const g=C.group(active);if(!g||!(g.characterIds||[]).some(x=>String(x)===String(id)))return;
 g.apiBindings??={};
 const old=g.apiBindings[id]||{};
 const next={...old};
 if(target.dataset.gApiEndpoint!==undefined){
   next.endpointId=target.value;
   // A custom model from the previous endpoint must not accidentally carry over.
   next.model="";
 }else if(target.dataset.gApiModel!==undefined)next.model=target.value.trim().slice(0,200);
 if(!next.endpointId&&!next.model)delete g.apiBindings[id];else g.apiBindings[id]=next;
 C.saveGroup(g);apiBindingsOpen=true;render();
});
host?.addEventListener("click",e=>{
 const button=e.target.closest("#xyCreativeGroup [data-g]");if(!button)return;
 e.preventDefault();const task=button.dataset.g;
 if(task==="shelf"){active="";return window.xyCreativeLibrary?.open()}
 if(task==="create"){
  const ids=[...host.querySelectorAll("[data-group-member]:checked")].map(x=>x.value);
  if(ids.length<2){notice="至少选择两名角色。先去「角色」添加也可以。";selectedIds=ids;formBook=host.querySelector("#xyGbook")?.value||"";return render()}
  const item={id:C.id(),title:host.querySelector("#xyGtitle")?.value.trim().slice(0,100)||"新群聊",bookId:host.querySelector("#xyGbook")?.value||"",characterIds:ids,apiBindings:{},messages:[],createdAt:Date.now()};
  C.saveGroup(item);return show(item.id);
 }
 if(task==="remove"){if(!confirm("删除这段群聊及全部发言？"))return;C.drop(C.G,active);active="";return window.xyCreativeLibrary?.open()}
 if(task==="send")send();
});
const oldOpen=openPanel;
openPanel=function(type){if(type==="groupchat")return show();return oldOpen(type)};
window.xyCreativeGroup={open:show,newGroup,endpointFor};
})();