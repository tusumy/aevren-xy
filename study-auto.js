(()=>{
"use strict";
const KEY="xy.study.v1",MIN_TURNS=8,FAILURE_COOLDOWN=30*60*1000;
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cap=(x,n)=>String(x??"").trim().slice(0,n);
const uid=()=>"auto-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const busy=new Set();
const label=id=>String(id??"");
function getAll(){try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");if(x&&x.byCharacter&&typeof x.byCharacter==="object")return x}catch{}return {version:1,byCharacter:{}}}
function readSpace(db,id){
  if(!db.byCharacter[id]||typeof db.byCharacter[id]!=="object")db.byCharacter[id]={card:null,preset:{},lore:[],chapters:[],useSummary:false};
  const s=db.byCharacter[id];s.chapters=Array.isArray(s.chapters)?s.chapters:[];
  if(!s.auto||typeof s.auto!=="object")s.auto={enabled:false,byChat:{}};
  if(!s.auto.byChat||typeof s.auto.byChat!=="object")s.auto.byChat={};
  return s;
}
function getSettings(charId){const all=getAll();return readSpace(all,charId).auto}
function saveEdit(charId,callback){
  const all=getAll(),space=readSpace(all,charId);
  callback(space.auto,space);
  localStorage.setItem(KEY,JSON.stringify(all));
}
function currentIds(){
  const c=typeof chat==="function"?chat():null;
  return {c,charId:label(c?.characterId||window.xyCurrentCharacter?.()?.id||"xuan-yan"),chatId:label(c?.id||"")};
}
function completedPairs(c){
  const out=[],msgs=Array.isArray(c?.messages)?c.messages:[];
  let users=[];
  for(const m of msgs){
    if(m?.role==="user"){
      const t=cap(m.text,1900);
      if(t)users.push(t);
      if(users.length>3)users=users.slice(-3);
    }else if(m?.role==="assistant"){
      const t=cap(m.text,2300);
      if(!m.localOnly&&t&&!/^请求失败[：:]/.test(t)&&!/^嗯，我在。/.test(t)&&users.length){
        out.push({user:users.join("\n"),assistant:t});
      }
      users=[];
    }
  }
  return out;
}
function recordFor(auto,chatId){return auto.byChat[chatId]&&typeof auto.byChat[chatId]==="object"?auto.byChat[chatId]:{}}
function firstSentencePreview(value){
  const oneLine=String(value||"").replace(/\s+/g," ").trim();
  const punctuation=oneLine.search(/[。！？!?]/);
  // Show at most the first sentence, with a bounded preview for long prose.
  return cap(punctuation>=0?oneLine.slice(0,punctuation+1):oneLine,110);
}
// Both story summaries share one renderer so the plot and character/state
// cards cannot drift into different interactions again.
function foldedSummaryCard(number,label,title,content,extraClass=""){
  if(!String(content||"").trim())return "";
  return '<details class="study-memory-page study-memory-digest'+(extraClass?" "+extraClass:"")+'">'+
    '<summary class="study-digest-toggle" aria-label="'+html("展开或收起完整"+label)+'">'+
      '<span class="study-page-kicker"><span>'+html(number)+'</span> '+html(label)+'</span>'+
      '<span class="study-digest-heading">'+html(title)+'</span>'+
      '<span class="study-digest-one-line">'+html(firstSentencePreview(content))+'</span>'+
      '<span class="study-digest-hint"><span class="study-digest-read">点击展开全文</span>'+
        '<span class="study-digest-close">点击收起</span>'+
        '<span class="study-digest-arrow" aria-hidden="true">⌄</span></span>'+
    '</summary>'+
    '<div class="study-digest-full"><p>'+html(content)+'</p></div>'+
  '</details>';
}
function panelHTML(){
  const {c,charId,chatId}=currentIds(),auto=getSettings(charId),record=recordFor(auto,chatId);
  const currentCount=completedPairs(c).length;
  const old=Math.min(Number(record.cursor)||0,currentCount);
  const finished=Math.min(MIN_TURNS,Math.max(0,currentCount-old));
  const remaining=Math.max(0,MIN_TURNS-finished);
  const percent=Math.round(finished/MIN_TURNS*100);
  const lastDate=record.updated?new Date(record.updated).toLocaleString("zh-CN",{hour12:false}):"";
  const hasResults=!!(record.digest||record.board);
  return '<section id="xyStudyAuto" class="study-card study-auto-panel">'+
    '<div class="study-auto-head">'+
      '<div class="study-auto-title"><span class="study-eyebrow">CHAPTER / AUTO MEMORY</span>'+
      '<h3>让故事自己长出记忆</h3>'+
      '<p>从真实聊天里提炼剧情，原话永远保留。</p></div>'+
      '<div class="study-progress-num"><b>'+finished+'</b><span>/ 8 轮</span></div>'+
    '</div>'+
    '<div class="study-progress-bar" role="progressbar" aria-label="距离下次整理的进度" aria-valuenow="'+finished+'" aria-valuemin="0" aria-valuemax="8">'+
      '<span style="width:'+percent+'%"></span></div>'+
    '<p class="study-progress-note">'+(auto.enabled?(remaining?"再聊 "+remaining+" 轮将自动整理":"可以整理新的剧情了"):"自动整理已关闭 · 可以手动整理")+
       (lastDate?" · 上次 "+html(lastDate):"")+'</p>'+
    '<div class="study-auto-action">'+
      '<button type="button" class="study-auto-trigger" data-study-auto="manual" '+(busy.has(chatId)?"disabled":"")+'>'+
       (busy.has(chatId)?"正在整理…":"✦ 整理最近 8 轮")+'</button>'+
      '<label class="study-auto-toggle"><input type="checkbox" id="studyAutoToggle" '+(auto.enabled?"checked":"")+'><span>自动整理</span></label>'+
    '</div>'+
    '<details class="study-auto-help"><summary>整理规则和调用费用</summary>'+
       '<p>每新增 8 轮有效聊天归档一次，只整理本对话。通常额外请求模型 1 次；格式异常时最多重试 1 次，可能产生额外费用。失败后自动暂停 30 分钟，手动重试不受限制。</p></details>'+
    (busy.has(chatId)?'<p class="study-status" role="status">正在翻阅这八轮聊天，请稍等…</p>':"")+
    (record.error?'<p class="study-status study-error" role="alert">上次整理失败：'+html(cap(record.error,210))+'。原聊天没有被覆盖。</p>':"")+
    (hasResults?'<div class="study-summary-pages">'+
      foldedSummaryCard("01","剧情脉络","上次故事说到这里",record.digest)+
      foldedSummaryCard("02","人物与场景","目前的故事状态",record.board,"study-memory-board")+
      '</div>':'<div class="study-summary-empty"><span aria-hidden="true">✧</span>'+
        '<p>故事还没有整理成章。按上面的按钮，收下最近的八轮对话。</p></div>')+
    '</section>';
}
function refresh(){
  const target=document.querySelector("#xyStudyAuto");
  if(target)target.outerHTML=panelHTML();
}
function setError(charId,chatId,error){
  try{saveEdit(charId,a=>{const r=a.byChat[chatId]||{};a.byChat[chatId]={...r,error:cap(error?.message||error,300),failedAt:Date.now()}})}catch{}
  refresh();
}
function apiEndpoint(raw){
  const x=String(raw||"").trim().replace(/\/$/,"");
  if(!x)return "";
  if(x.endsWith("#"))return x.slice(0,-1);
  try{
    const u=new URL(x),p=u.pathname.replace(/\/$/,"");
    if(/\/(?:chat\/completions|responses)$/i.test(p))return x;
    if(!p||p==="/")return x+"/v1/chat/completions";
    if(/\/v1$/i.test(p))return x+"/chat/completions";
  }catch{}
  return x;
}
function textFrom(data){
  const c=data?.choices?.[0];
  if(typeof c?.message?.content==="string")return c.message.content;
  if(Array.isArray(c?.message?.content))return c.message.content.map(x=>x?.text||"").join("\n");
  if(typeof c?.text==="string")return c.text;
  if(typeof data?.output_text==="string")return data.output_text;
  if(Array.isArray(data?.output))return data.output.filter(x=>x?.type==="message").flatMap(x=>x.content||[]).map(x=>x?.text||"").join("\n");
  if(Array.isArray(data?.content))return data.content.map(x=>x?.text||"").join("\n");
  return "";
}
// Extract complete JSON values one at a time. Some OpenAI-compatible
// providers return a valid object followed by a second object, a closing
// commentary line, or a Markdown fence. Parsing first-to-last "{"...""
// wrongly joins independent objects and raises "Unexpected non-whitespace
// character after JSON".
function balancedJsonFragments(input){
  const source=String(input||"");
  const found=[];
  for(let i=0;i<source.length&&found.length<24;i++){
    const first=source[i];
    if(first!=="{"&&first!=="[")continue;
    const stack=[],pairs={"}":"{","]":"["};
    let quoted=false,escaped=false;
    for(let j=i;j<source.length;j++){
      const ch=source[j];
      if(quoted){
        if(escaped)escaped=false;
        else if(ch==="\\")escaped=true;
        else if(ch==='"')quoted=false;
        continue;
      }
      if(ch==='"'){quoted=true;continue}
      if(ch==="{"||ch==="[")stack.push(ch);
      else if(ch==="}"||ch==="]"){
        if(stack.pop()!==pairs[ch])break;
        if(!stack.length){
          found.push(source.slice(i,j+1));
          i=j; // Treat this as one self-contained value, not a joined span.
          break;
        }
      }
    }
  }
  return found;
}
function validSummary(value){
  const candidates=Array.isArray(value)?value:[value];
  for(const raw of candidates){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
    // Support common schema aliases without manufacturing narrative detail.
    const summary=typeof raw.summary==="string"?raw.summary:
      typeof raw.digest==="string"?raw.digest:"";
    if(!summary.trim())continue;
    const title=typeof raw.title==="string"?raw.title:
      typeof raw.name==="string"?raw.name:"自动整理";
    const board=typeof raw.board==="string"?raw.board:
      typeof raw.state==="string"?raw.state:"";
    return {title:cap(title||"自动整理",70),summary:cap(summary,1600),board:cap(board,1300)};
  }
  return null;
}
function parsePlainSummary(text){
  const fields={title:[],summary:[],board:[]};
  let active="";
  for(const line of String(text||"").split(/\r?\n/)){
    const m=line.match(/^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(章节标题|标题|title|剧情摘要|情节摘要|故事梗概|摘要|总结|summary|人物与场景|人物状态|角色状态|场景状态|当前状态|未解决事项|board|state)(?:\*\*)?\s*(?:[：:]|\s*[-—]\s*|\s*$)\s*(.*)$/i);
    if(m){
      const name=m[1].toLowerCase();
      active=/^(?:标题|章节标题|title)$/.test(name)?"title":
        /^(?:剧情摘要|情节摘要|故事梗概|摘要|总结|summary)$/.test(name)?"summary":"board";
      if(m[2].trim())fields[active].push(m[2].trim());
    }else if(active&&line.trim()&&!/^```/.test(line))fields[active].push(line.trim());
  }
  if(!fields.summary.length)return null;
  return validSummary({title:fields.title.join(" ")||"自动整理",
    summary:fields.summary.join("\n"),board:fields.board.join("\n")});
}
function parseResult(text){
  const raw=String(text||"").trim();
  if(!raw)throw Error("整理模型没有返回文字");
  const candidates=[raw,raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"")];
  // Also search balanced segments within prose, code fences or successive
  // JSON objects, respecting nested braces and JSON string escapes.
  candidates.push(...balancedJsonFragments(raw));
  for(const candidate of candidates){
    try{
      const accepted=validSummary(JSON.parse(candidate));
      if(accepted)return accepted;
    }catch{} // Try the next independent JSON value.
  }
  const headings=parsePlainSummary(raw);
  if(headings)return headings;
  throw Error("模型未提供完整的剧情摘要 JSON 或带标题的摘要，请检查当前模型的输出格式");
}
async function requestModel(ep,transcript,prior){
  const url=apiEndpoint(ep?.base);
  if(!url||!ep.model)throw Error("请先配置可用的聊天接口和模型");
  const headers={"Content-Type":"application/json",Accept:"application/json"};
  if(ep.key)headers.Authorization="Bearer "+ep.key;
  const instructions="你是剧情记录员，只基于以下原始对话做事实提炼。不要续写、推测心理、发明事件或擅自修改既有角色设定。区分用户与 AI 的发言，保留尚未解决的剧情线。严格返回一个 JSON 对象，不要代码块："+
    '{"title":"本段章节标题，不超过20字","summary":"本段发生了什么，以及衔接过往的剧情脉络，150-400字","board":"当前人物关系、地点、已知状态、未解决事项，简洁文字"}。'+
    "如果没有真实的剧情发展，就只记录实际交流，不得编造故事。";
  const prompt="之前的剧情摘要与状态（可能为空，仅供承接）：\n"+cap(prior.digest||"",1100)+"\n"+cap(prior.board||"",700)+
    "\n\n本次需要归档的真实聊天记录：\n"+transcript;
  const body={model:ep.model,stream:false,temperature:0.2,max_tokens:2400,
    messages:[{role:"system",content:instructions},{role:"user",content:prompt}]};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
  let response;
  try{response=await fetch(url,{method:"POST",headers,body:JSON.stringify(body),signal:controller.signal})}
  finally{clearTimeout(timeout)}
  const raw=await response.text();let data;
  try{data=JSON.parse(raw)}catch{throw Error("模型接口返回了非 JSON 响应")}
  if(!response.ok||data?.error)throw Error(data?.error?.message||"HTTP "+response.status);
  const first=textFrom(data);
  try{return parseResult(first)}
  catch(formatErr){
    // Retry only malformed model output, not network/API errors.
    // The second attempt requests headings rather than rigid JSON, which
    // works with providers that prepend commentary or truncate JSON.
    const easy="仅从以下真实对话整理已发生的事实，不续写、不推测。请输出普通文字而非 JSON，按以下三个标题，每项有实际内容：\n"+
      "标题：不超过20字\n摘要：用100到250字概括真实交流\n人物与场景：已知人物关系、地点和未解决事项。\n不要解释、不要代码块。";
    const retryBody={...body,max_tokens:2400,temperature:0.1,
      messages:[{role:"system",content:easy},{role:"user",content:prompt}]};
    const retryController=new AbortController();
    const retryTimer=setTimeout(()=>retryController.abort(),60000);
    let secondResponse;
    try{
      secondResponse=await fetch(url,{method:"POST",headers,body:JSON.stringify(retryBody),signal:retryController.signal});
    }finally{clearTimeout(retryTimer)}
    const secondRaw=await secondResponse.text();let secondData;
    try{secondData=JSON.parse(secondRaw)}catch{throw Error("模型重试时接口没有返回 JSON")}
    if(!secondResponse.ok||secondData?.error)throw Error(secondData?.error?.message||"重试 HTTP "+secondResponse.status);
    try{return parseResult(textFrom(secondData))}
    catch{throw Error("模型两次都未生成可识别的摘要。可换一个擅长总结的聊天模型，再点「整理最近 8 轮」")}
  }
}
async function run(c,{manual=false}={}){
  if(!c?.id)return false;
  const charId=label(c.characterId||window.xyCurrentCharacter?.()?.id||"xuan-yan"),chatId=label(c.id);
  if(busy.has(chatId))return false;
  const a=getSettings(charId),record=recordFor(a,chatId),pairs=completedPairs(c);
  const total=pairs.length;
  if(!manual&&!a.enabled)return false;
  if(!manual&&record.failedAt&&Date.now()-Number(record.failedAt)<FAILURE_COOLDOWN)return false;
  let start=Math.min(Math.max(0,Number(record.cursor)||0),total);
  if(!manual&&total-start<MIN_TURNS)return false;
  if(manual&&total===start){
    if(record.updated){setError(charId,chatId,"没有新对话需要整理");return false}
    start=Math.max(0,total-MIN_TURNS);
  }else if(manual&&!record.updated&&start===0){
    // First manual import captures the most recent eight turns, not the oldest eight.
    start=Math.max(0,total-MIN_TURNS);
  }
  if(total===0||start>=total){setError(charId,chatId,"还没有可整理的文字对话");return false}
  // Bound every extra API call to eight pairs, even after returning to a long-untouched conversation.
  const end=Math.min(total,start+MIN_TURNS);
  const excerpt=pairs.slice(start,end);
  const transcript=excerpt.map((p,i)=>(start+i+1)+". 用户："+p.user+"\n角色："+p.assistant).join("\n\n").slice(0,20000);
  const ep=typeof endpoints!=="undefined"?(endpoints.find(x=>x.active)||endpoints[0]):null;
  busy.add(chatId);refresh();
  try{
    const result=await requestModel(ep,transcript,record);
    // Don't resurrect a deleted chat or overwrite a newer manual/automatic digest.
    const activeChat=(typeof chats!=="undefined"?chats:[]).find(x=>label(x.id)===chatId);
    if(!activeChat)throw Error("对话已删除，本次整理未保存");
    if(label(activeChat.characterId||window.xyCurrentCharacter?.()?.id||"xuan-yan")!==charId)throw Error("角色已切换，本次整理未保存");
    const latest=getSettings(charId),prior=recordFor(latest,chatId);
    if((Number(prior.cursor)||0)!==(Number(record.cursor)||0))throw Error("已经有更新的整理结果，本次未覆盖");
    saveEdit(charId,(auto,s)=>{
      auto.byChat[chatId]={cursor:end,digest:result.summary,board:result.board,updated:Date.now(),error:"",failedAt:0};
      const title=result.title||"自动整理";
      // Archive real conversation text, never generated fanfiction in the original chat.
      s.chapters.push({id:uid(),name:title,text:transcript,summary:result.summary,updated:Date.now(),generated:true,originChatId:chatId,range:[start+1,end]});
    });
    return true;
  }catch(e){setError(charId,chatId,e);return false}
  finally{busy.delete(chatId);refresh()}
}
function afterReply(c){void run(c).catch(()=>{});}
function context({characterId,chatId}={}){
  const a=getSettings(label(characterId||currentIds().charId));
  if(!a.enabled)return "";
  const r=recordFor(a,label(chatId||currentIds().chatId));
  if(!r.digest&&!r.board)return "";
  return cap("【书房·此对话的自动剧情摘要】\n"+cap(r.digest,900)+
    (r.board?"\n【书房·人物与场景状态】\n"+cap(r.board,650):""),1650);
}
document.querySelector("#panelBody")?.addEventListener("change",event=>{
  if(event.target?.id!=="studyAutoToggle")return;
  const {c,charId,chatId}=currentIds(),enabled=event.target.checked;
  try{saveEdit(charId,a=>{
    if(enabled&&!a.enabled){
      // Seed the checkpoint of EVERY existing conversation in this character.
      // Switching conversations must not silently upload older history.
      const existing=typeof chats!=="undefined"?chats:[c];
      for(const conversation of existing){
        if(!conversation?.id)continue;
        const targetId=label(conversation.id);
        const owner=label(conversation.characterId||(targetId===chatId?charId:"xuan-yan"));
        if(owner!==charId)continue;
        const r=recordFor(a,targetId);
        a.byChat[targetId]={...r,cursor:completedPairs(conversation).length,error:""};
      }
    }
    a.enabled=enabled;
  })}catch(e){setError(charId,chatId,e)}
  refresh();
});
document.querySelector("#panelBody")?.addEventListener("click",event=>{
  const b=event.target.closest?.("[data-study-auto]");
  if(!b||!b.closest("#xyStudyAuto"))return;
  if(b.dataset.studyAuto==="manual"){const {c}=currentIds();void run(c,{manual:true})}
});
window.xyStudyAuto={panelHTML,afterReply,context,run,completedPairs};
})();