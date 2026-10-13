(()=>{
"use strict";
const KEY="xy.study.v1";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cap=(s,n=5000)=>String(s??"").trim().slice(0,n);
const arr=x=>Array.isArray(x)?x:[];
const id=()=>String(window.xyCurrentCharacter?.()?.id||chat()?.characterId||"xuan-yan");
const charName=()=>String(window.xyCurrentCharacter?.()?.name||"当前角色");
const uuid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const blank=()=>({card:null,preset:{name:"",content:"",enabled:false},lore:[],chapters:[],useSummary:false});
const load=()=>{
  try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");if(x&&x.byCharacter&&typeof x.byCharacter==="object"&&!Array.isArray(x.byCharacter))return x}catch{}
  return {version:1,byCharacter:{}};
};
function book(db,who=id()){
  if(!db.byCharacter[who]||typeof db.byCharacter[who]!=="object")db.byCharacter[who]=blank();
  const b=db.byCharacter[who];b.lore=arr(b.lore);b.chapters=arr(b.chapters);b.preset=b.preset||blank().preset;
  return b;
}
const current=()=>book(load());
let tab="card",editLore="",editChapter="",status="";
function save(edit,message="已保存到本机"){
  try{const db=load();edit(book(db));localStorage.setItem(KEY,JSON.stringify(db));status=message;draw()}
  catch(e){status="保存失败："+String(e?.message||e);draw()}
}
function textField(key,title,value,rows=4){
  return '<label class="study-field"><span>'+escape(title)+'</span><textarea rows="'+rows+'" id="'+key+'">'+escape(value)+'</textarea></label>';
}
function inputField(key,title,value){
  return '<label class="study-field"><span>'+escape(title)+'</span><input id="'+key+'" type="text" value="'+escape(value)+'"></label>';
}
function check(key,label,value){
  return '<label class="study-check"><input type="checkbox" id="'+key+'" '+(value?'checked':'')+'><span>'+escape(label)+'</span></label>';
}
function btn(action,text,key="",cls=""){
  return '<button type="button" data-study="'+action+'" data-key="'+escape(key)+'" class="'+cls+'">'+escape(text)+'</button>';
}
function draw(){
  const panel=document.querySelector("#panel"),host=document.querySelector("#panelBody");if(!panel||!host)return;
  const b=current(),c=b.card||{},p=b.preset||{};
  document.querySelector("#sidebar")?.classList.remove("open");
  document.querySelector("#panelEyebrow").textContent="AEVREN · STUDY";
  document.querySelector("#panelTitle").textContent="书房";
  let html='<div id="xyStudy"><section class="study-cover"><strong>'+escape(charName())+'的书房</strong><small>这里的设定按角色分别保存，不动原有聊天、记忆和日记。</small></section>'+
    '<div class="study-tabs">'+[["card","角色卡"],["preset","预设"],["lore","世界书"],["chapter","剧情"]].map(x=>btn("tab",x[1],x[0],x[0]===tab?"selected":"")).join("")+'</div>'+
    (status?'<p class="study-status" role="status">'+escape(status)+'</p>':"");
  if(tab==="card")html+='<p class="study-tip">支持酒馆 V1 / V2 角色卡 JSON。PNG 角色卡暂不支持；启用后新消息会自动带上这里的设定。</p>'+
    '<label class="study-import">导入角色卡 JSON<input type="file" id="studyCardImport" accept=".json,application/json" hidden></label>'+
    inputField("studyCardName","角色名称",c.name)+
    textField("studyCardDesc","角色描述",c.description,5)+
    textField("studyCardPersonality","性格",c.personality)+
    textField("studyCardScenario","背景 / 场景",c.scenario)+
    textField("studyCardSystem","系统设定",c.system_prompt)+
    textField("studyCardGreeting","开场白（只保存，不自动发送）",c.first_mes)+
    check("studyCardActive","启用角色卡上下文",c.enabled)+
    btn("saveCard","保存角色卡","","primary");
  if(tab==="preset")html+='<p class="study-tip">附加系统预设，不修改原来的接口和模型参数。导入后默认关闭，检查完内容再启用。</p>'+
    '<label class="study-import">导入预设 JSON<input type="file" id="studyPresetImport" accept=".json,application/json" hidden></label>'+
    inputField("studyPresetName","预设名称",p.name)+textField("studyPresetContent","预设指令",p.content,12)+
    check("studyPresetActive","启用这个预设",p.enabled)+btn("savePreset","保存预设","","primary");
  if(tab==="lore"){
    const x=b.lore.find(e=>e.id===editLore)||{};
    html+='<p class="study-tip">常驻条目每轮加入上下文；关键词条目在本轮消息触发时才加入，最多同时读取四条。</p>'+
      '<label class="study-import">导入世界书 JSON<input type="file" id="studyLoreImport" accept=".json,application/json" hidden></label>'+
      inputField("studyLoreName","设定名称",x.name)+
      inputField("studyLoreKeys","关键词（逗号分开）",arr(x.keys).join("，"))+
      textField("studyLoreContent","正文",x.content,6)+
      check("studyLoreConstant","常驻设定",x.constant)+check("studyLoreActive","启用条目",x.enabled!==false)+
      '<div class="study-actions">'+btn("saveLore",editLore?"保存修改":"添加条目","","primary")+(editLore?btn("cancelLore","取消编辑"):"")+'</div>'+
      '<h3>世界书 · '+b.lore.length+' 条</h3>';
    html+=b.lore.map(x=>'<article class="study-card"><strong>'+escape(x.name||"设定")+'</strong><small>'+(x.enabled===false?"已关闭 · ":"")+
      (x.constant?"常驻":escape(arr(x.keys).join(" / ")||"未设置关键词"))+'</small><p>'+escape(cap(x.content,105))+'</p><div class="study-actions">'+btn("editLore","编辑",x.id)+btn("deleteLore","删除",x.id,"danger")+'</div></article>').join("");
  }
  if(tab==="chapter"){
    const x=b.chapters.find(e=>e.id===editChapter)||{};
    html+='<p class="study-tip">可以将长剧情保存成章节。章节正文不会全部塞进聊天，只有开启摘要后才引用最新章节摘要。</p>'+
      inputField("studyChapterName","章节标题",x.name)+textField("studyChapterText","章节正文",x.text,11)+
      textField("studyChapterSummary","章节摘要",x.summary,4)+check("studyChapterActive","引用最新章节摘要",b.useSummary)+
      '<div class="study-actions">'+btn("saveChapter",editChapter?"更新章节":"保存新章节","","primary")+(editChapter?btn("cancelChapter","取消编辑"):"")+'</div>'+
      '<h3>章节书架 · '+b.chapters.length+' 篇</h3>';
    html+=[...b.chapters].reverse().map(x=>'<article class="study-card"><strong>'+escape(x.name||"无标题")+'</strong><small>'+escape(new Date(x.updated||Date.now()).toLocaleDateString("zh-CN"))+'</small><p>'+escape(cap(x.summary||x.text,110))+'</p><div class="study-actions">'+btn("editChapter","打开 / 编辑",x.id)+btn("deleteChapter","删除",x.id,"danger")+'</div></article>').join("");
  }
  if(tab==="chapter")html+=window.xyStudyAuto?.panelHTML?.()||"";
  html+='<footer class="study-footer">'+btn("export","导出本角色书房 JSON")+btn("copy","复制书房 JSON")+
    '<small>书房资料保存在本机，同时包含在「数据管理」的砚屿完整备份里。</small></footer></div>';
  host.innerHTML=html;panel.classList.add("open");document.querySelector("#scrim")?.classList.add("show");
}
const val=k=>document.getElementById(k)?.value?.trim()||"";
const on=k=>!!document.getElementById(k)?.checked;
const words=s=>String(s||"").split(/[,，、;\n]/).map(s=>s.trim()).filter(Boolean).slice(0,30);
function loreEntry(x){
  if(!x||typeof x!=="object")return null;
  const content=cap(x.content||x.text,7000);if(!content)return null;
  const rawKeys=x.keys||x.key||[];
  const keys=(Array.isArray(rawKeys)?rawKeys:words(rawKeys)).map(x=>cap(x,80)).filter(Boolean);
  return {id:uuid(),name:cap(x.name||x.comment||x.title||"设定",90),keys,content,constant:!!x.constant,enabled:x.enabled!==false&&x.disable!==true};
}
function parseLore(raw){
  const x=raw?.data?.character_book||raw?.character_book||raw?.world_book||raw?.data?.world_book||raw;
  if(!x?.entries||typeof x.entries!=="object")throw Error("JSON 中找不到世界书 entries");
  return (Array.isArray(x.entries)?x.entries:Object.values(x.entries)).map(loreEntry).filter(Boolean).slice(0,300);
}
function parseCard(raw){
  const x=raw?.data&&typeof raw.data==="object"?raw.data:raw;
  if(!x||typeof x!=="object"||(!x.name&&!x.description&&!x.personality))throw Error("不是可识别的角色卡");
  return {name:cap(x.name,120),description:cap(x.description,10000),personality:cap(x.personality,5000),scenario:cap(x.scenario,5000),system_prompt:cap(x.system_prompt,5000),first_mes:cap(x.first_mes,8000),enabled:true};
}
function parsePreset(x){
  if(typeof x==="string")return {name:"导入的预设",content:cap(x,30000),enabled:false};
  if(!x||typeof x!=="object")throw Error("不是有效的预设 JSON");
  const prompts=arr(x.prompts).filter(p=>p?.role==="system"&&p.enabled!==false&&p.content).map(p=>p.content);
  const content=cap(prompts.join("\n\n")||x.system_prompt||x.prompt||x.content,30000);
  if(!content)throw Error("没有找到系统预设正文");
  return {name:cap(x.name||"导入的预设",100),content,enabled:false};
}
function appendLore(b,entries){
  const existing=new Set(b.lore.map(x=>x.content+"|"+arr(x.keys).join(",")));
  for(const e of entries){const k=e.content+"|"+e.keys.join(",");if(!existing.has(k)){b.lore.push(e);existing.add(k)}}
}
async function importFile(file,kind){
  if(!file)return;
  if(file.size>2*1024*1024){status="导入文件不能超过 2MB";draw();return}
  try{
    const raw=JSON.parse(await file.text());
    if(kind==="card"){
      const card=parseCard(raw);let extra=[];try{extra=parseLore(raw)}catch{}
      save(b=>{b.card=card;appendLore(b,extra)},"已导入角色卡"+(extra.length?"和附带世界书":""));
    }else if(kind==="preset")save(b=>{b.preset=parsePreset(raw)},"预设已导入，检查后再启用");
    else{const entries=parseLore(raw);if(!entries.length)throw Error("没有有效世界书条目");save(b=>appendLore(b,entries),"世界书已导入 "+entries.length+" 条（重复条目跳过）")}
  }catch(e){status="导入失败："+String(e?.message||e);draw()}
}
function bundle(){return JSON.stringify({format:"AevrenXYStudy",version:1,characterId:id(),characterName:charName(),at:new Date().toISOString(),data:current()},null,2)}
function context(options){
  const b=book(load(),String(options?.characterId||id())),q=String(options?.query||"").toLowerCase(),sections=[],c=b.card||{},p=b.preset||{};
  if(p.enabled&&p.content)sections.push("【书房·预设】\n"+cap(p.content,2100));
  if(c.enabled){
    const fields=[["名字",c.name],["描述",c.description],["性格",c.personality],["背景",c.scenario],["设定",c.system_prompt]]
      .filter(x=>x[1]).map(x=>x[0]+"："+cap(x[1],x[0]==="描述"?850:450));
    if(fields.length)sections.push("【书房·角色卡】\n"+fields.join("\n"));
  }
  const matched=b.lore.filter(x=>x.enabled!==false&&x.content&&(x.constant||arr(x.keys).some(k=>k&&q.includes(String(k).toLowerCase())))).slice(0,4);
  if(matched.length)sections.push("【书房·世界书】\n"+matched.map(x=>(x.name||"设定")+"："+cap(x.content,500)).join("\n"));
  if(b.useSummary&&b.chapters.length){
    const latest=b.chapters[b.chapters.length-1];
    if(latest.summary)sections.push("【书房·最近剧情摘要】\n"+cap(latest.summary,700));
  }
  return cap(sections.join("\n\n"),6300);
}
const host=document.querySelector("#panelBody");
host?.addEventListener("change",event=>{
  const t=event.target;if(!t.closest("#xyStudy"))return;
  if(t.id==="studyCardImport")importFile(t.files?.[0],"card");
  if(t.id==="studyPresetImport")importFile(t.files?.[0],"preset");
  if(t.id==="studyLoreImport")importFile(t.files?.[0],"lore");
});
host?.addEventListener("click",event=>{
  if(!event.target.closest("#xyStudy"))return;
  const t=event.target.closest("[data-study]");if(!t)return;
  const action=t.dataset.study,key=t.dataset.key;
  if(action==="tab"){tab=key;editLore="";editChapter="";status="";draw();return}
  if(action==="saveCard"){const c={name:cap(val("studyCardName"),120),description:cap(val("studyCardDesc"),10000),personality:cap(val("studyCardPersonality"),5000),scenario:cap(val("studyCardScenario"),5000),system_prompt:cap(val("studyCardSystem"),5000),first_mes:cap(val("studyCardGreeting"),8000),enabled:on("studyCardActive")};save(b=>{b.card=c});return}
  if(action==="savePreset"){const p={name:cap(val("studyPresetName"),100),content:cap(val("studyPresetContent"),30000),enabled:on("studyPresetActive")};save(b=>{b.preset=p});return}
  if(action==="saveLore"){
    const e={id:editLore||uuid(),name:cap(val("studyLoreName")||"设定",90),keys:words(val("studyLoreKeys")),content:cap(val("studyLoreContent"),7000),constant:on("studyLoreConstant"),enabled:on("studyLoreActive")};
    if(!e.content||(!e.keys.length&&!e.constant)){status="请填写正文与关键词，或开启常驻";draw();return}
    save(b=>{const i=b.lore.findIndex(x=>x.id===editLore);if(i>=0)b.lore[i]=e;else b.lore.push(e);editLore=""});return;
  }
  if(action==="editLore"){editLore=key;status="";draw();return}
  if(action==="cancelLore"){editLore="";draw();return}
  if(action==="deleteLore"){if(!confirm("删除这条世界书设定？"))return;save(b=>{b.lore=b.lore.filter(x=>x.id!==key);editLore=""},"已删除条目");return}
  if(action==="saveChapter"){
    const e={id:editChapter||uuid(),name:cap(val("studyChapterName")||"未命名章节",100),text:cap(val("studyChapterText"),150000),summary:cap(val("studyChapterSummary"),3000),updated:Date.now()};
    if(!e.text){status="章节正文不能为空";draw();return}
    save(b=>{const i=b.chapters.findIndex(x=>x.id===editChapter);if(i>=0)b.chapters[i]=e;else b.chapters.push(e);b.useSummary=on("studyChapterActive");editChapter=""});return;
  }
  if(action==="editChapter"){editChapter=key;status="";draw();return}
  if(action==="cancelChapter"){editChapter="";draw();return}
  if(action==="deleteChapter"){if(!confirm("删除这一章？"))return;save(b=>{b.chapters=b.chapters.filter(x=>x.id!==key);editChapter=""},"已删除章节");return}
  if(action==="export"){
    const blob=new Blob([bundle()],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="xy-study-"+id()+".json";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);status="已尝试导出（APK 无法下载时使用复制按钮）";draw();return;
  }
  if(action==="copy"){
    const json=bundle();
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(json).then(()=>{status="已复制书房 JSON";draw()}).catch(()=>prompt("复制书房 JSON",json));
    else prompt("复制书房 JSON",json);
  }
});
const style=document.createElement("style");
style.textContent=String.raw`
#xyStudy{display:grid;gap:12px;color:#3d5244;font-size:13px;padding-bottom:30px}#xyStudy *{box-sizing:border-box}
#xyStudy .study-cover{padding:15px;border-radius:16px;background:linear-gradient(135deg,#e5eee4,#f6f8f2);display:grid;gap:7px}
#xyStudy .study-cover strong{font-size:15px}#xyStudy .study-cover small,#xyStudy .study-tip,#xyStudy .study-footer small{color:#748378;line-height:1.6;font-size:11px}
#xyStudy .study-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
#xyStudy .study-card#xyStudyAuto{margin-top:8px}
#xyStudyAuto .study-auto-result{padding:11px;border-radius:10px;background:#eff4ed}
#xyStudyAuto .study-auto-result p{white-space:pre-wrap;line-height:1.7;margin:6px 0 0;font-size:12px}
#xyStudyAuto .study-check input{flex:none}
#xyStudyAuto button:disabled{opacity:.4;cursor:wait}

#xyStudy button,#xyStudy .study-import{cursor:pointer;-webkit-tap-highlight-color:transparent}
#xyStudy .study-tabs button{border:1px solid #d8e1d7;background:#fff;border-radius:9px;padding:10px 2px;color:#627667;font-size:12px}
#xyStudy .study-tabs .selected{background:#365b49;color:#fff}
#xyStudy .study-status{margin:0;padding:9px;background:#eaf1e9;border-radius:9px;color:#41604b;overflow-wrap:anywhere}
#xyStudy .study-import{display:block;text-align:center;padding:11px;border:1px dashed #adbfaa;border-radius:10px;background:#ebf2e9;color:#385944}
#xyStudy .study-field{display:grid;gap:6px}#xyStudy .study-field span{font-size:11px;color:#697a6e}
#xyStudy .study-field textarea,#xyStudy .study-field input{width:100%;min-height:41px;max-height:none;overflow:auto;padding:10px;border:1px solid #d5e0d4;background:#fff;border-radius:10px;outline:0;color:#35493b;resize:vertical;font:inherit;line-height:1.6}
#xyStudy .study-check{display:flex;gap:8px;align-items:center;font-size:12px}#xyStudy .study-check input{accent-color:#365b49;width:16px;height:16px;flex:none}
#xyStudy button.primary{padding:12px;background:#365b49;color:#fff;border:0;border-radius:10px;flex:1}
#xyStudy .study-actions{display:flex;gap:8px;flex-wrap:wrap}
#xyStudy .study-actions button:not(.primary){border:1px solid #d7e0d6;background:#fff;border-radius:9px;padding:8px 10px;color:#4f6355;font-size:11px}
#xyStudy .study-actions .danger{color:#a25b55!important}
#xyStudy h3{font-size:13px;margin:8px 0 0}
#xyStudy .study-card{padding:12px;border-radius:12px;border:1px solid #e0e6de;background:#ffffffaa;display:grid;gap:8px;overflow-wrap:anywhere}
#xyStudy .study-card strong{font-size:12px}#xyStudy .study-card small{color:#869487;font-size:10px}
#xyStudy .study-card p{font-size:11px;line-height:1.55;white-space:pre-wrap;margin:0;color:#647368}
#xyStudy .study-footer{border-top:1px solid #d8e2d8;padding-top:12px;display:grid;gap:9px}
#xyStudy .study-footer button{border:1px solid #cbd7cc;background:#fff9;color:#44604e;border-radius:9px;padding:10px}
#panel:has(#xyStudy){display:flex;flex-direction:column}
#panel:has(#xyStudy) #panelBody{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;padding-right:3px}
`;
document.head.appendChild(style);
const originalOpen=openPanel;
openPanel=function(type){if(type==="study")return draw();return originalOpen(type)};
window.xyStudyRoom={open:draw,context,exportData:bundle};
})();