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
const currentBook=()=>book(load());
let tab="card",editLore="",editChapter="",status="",greetingChoice=0,greetingRole="";
function saveStudy(edit,message="已保存到本机"){
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
  if(greetingRole!==id()){greetingRole=id();greetingChoice=0}
  const b=currentBook(),c=b.card||{},p=b.preset||{};
  document.querySelector("#sidebar")?.classList.remove("open");
  document.querySelector("#panelEyebrow").textContent="AEVREN · STUDY";
  document.querySelector("#panelTitle").textContent="书房";
  const activeChat=typeof chat==="function"?chat():null;
  const lastUser=[...(activeChat?.messages||[])].reverse().find(m=>m?.role==="user")?.text||"";
  const recent=(activeChat?.messages||[]).slice(-8).map(m=>String(m?.text||"").slice(0,350)).join("\n");
  const preview=context({characterId:id(),chatId:activeChat?.id,query:lastUser,recent});
  const bindingNote=c.name&&c.name!==charName()?"已导入「"+c.name+"」角色卡，但当前聊天角色仍是「"+charName()+"」。两边设定可能冲突；角色名不会自动修改。":"当前聊天绑定「"+charName()+"」，本书房只供这个角色使用。";
  const counts={
    greetings:[c.first_mes,...arr(c.alternate_greetings)].filter(Boolean).length,
    lore:b.lore.filter(x=>x.enabled!==false).length,
    chapters:b.chapters.length
  };
  // Avoid the app-wide header{height:72px} used for the chat title bar.
  // A book cover must grow with its title and overview stats.
  const hero='<section class="study-cover">'+
    '<span class="study-cover-kicker">THE STORY ARCHIVE <i>✦</i></span>'+
    '<strong>'+escape(charName())+'的故事档案</strong>'+
    '<p>'+escape(bindingNote)+'</p>'+
    '<div class="study-overview">'+
      '<span><b>'+counts.greetings+'</b><small>种开场</small></span>'+
      '<span><b>'+counts.lore+'</b><small>条设定</small></span>'+
      '<span><b>'+counts.chapters+'</b><small>篇章节</small></span>'+
    '</div></section>';
  let html='<div id="xyStudy">'+hero+
    '<nav class="study-tabs" aria-label="书房页面">'+[["card","人物"],["preset","预设"],["lore","世界书"],["chapter","故事线"]].map(x=>btn("tab",x[1],x[0],x[0]===tab?"selected":"")).join("")+'</nav>'+
    (status?'<p class="study-status" role="status">'+escape(status)+'</p>':"")+
    '<details class="study-preview"><summary>这轮角色读到了什么 <span>核对上下文 ↗</span></summary>'+
    '<div class="study-preview-inner"><p>这里只展示当前对话实际可读的设定。未触发的世界书不会整本注入。</p>'+
    '<p>角色卡 '+(c.enabled?"已启用":"未启用")+' · 预设 '+(p.enabled?"已启用":"未启用")+
    ' · 世界书 '+counts.lore+' 条 · 章节 '+counts.chapters+' 篇</p>'+
    '<pre>'+escape(preview||"本轮暂无可注入的书房内容。")+'</pre></div></details>';
  if(tab==="card"){
    const openings=[c.first_mes,...arr(c.alternate_greetings)].filter(Boolean);
    const first=Math.min(greetingChoice,Math.max(0,openings.length-1));
    html+='<section class="study-section-heading"><span class="study-eyebrow">CHARACTER / 人物手记</span>'+
      '<h3>和谁一起写故事</h3><p>先选择相遇的方式。角色的详细设定，藏在下面的编辑页里。</p></section>'+
      '<label class="study-import">＋ 导入酒馆角色卡 JSON<input type="file" id="studyCardImport" accept=".json,application/json" hidden></label>'+
      (openings.length?'<section class="study-card study-greeting-picker">'+
        '<span class="study-eyebrow">FIRST MEETING / 开场</span><strong>选择一场相遇 · '+openings.length+' 种开场</strong>'+
        // Android's native <select> popup ignores WebView's night palette
        // on some phones. A details menu keeps all 36 choices legible.
        '<input type="hidden" id="studyGreetingChoice" value="'+first+'">'+
        '<details class="study-greeting-menu" id="studyGreetingMenu">'+
          '<summary aria-label="选择角色开场白"><span class="study-greeting-current" id="studyGreetingCurrent">'+
            escape('第 '+(first+1)+' 条 · '+cap(String(openings[first]).replace(/\s+/g," "),42))+
          '</span><span aria-hidden="true" class="study-greeting-chevron">⌄</span></summary>'+
          '<div class="study-greeting-options" role="group" aria-label="开场白选项">'+
            openings.map((text,i)=>'<button type="button" class="study-greeting-option '+(i===first?"chosen":"")+
              '" data-study="pickGreeting" data-key="'+i+'" aria-pressed="'+(i===first)+'">'+
              '<span class="study-greeting-no">'+String(i+1).padStart(2,"0")+'</span>'+
              '<span class="study-greeting-title">'+escape(cap(String(text).replace(/\s+/g," "),90))+'</span>'+
              (i===first?'<span class="study-greeting-tick" aria-hidden="true">✓</span>':"")+
              '</button>').join("")+
          '</div></details>'+
        '<textarea id="studyGreetingPreview" readonly rows="6" aria-label="完整开场白预览">'+escape(openings[first])+'</textarea>'+
        '<small>选中的开场会开启一条新对话，原来的聊天不会改变。</small>'+
        btn("startGreetingChat","用这一条开场 · 开始聊天","","primary")+'</section>':
        '<div class="study-empty">暂时没有开场白，先导入酒馆角色卡吧。</div>')+
      '<details class="study-editor" '+(!c.name?"open":"")+'>'+
      '<summary><span>人物设定与其他开场</span><small>'+(c.enabled?"角色卡已启用":"角色卡未启用")+'</small></summary>'+
      '<div class="study-editor-fields">'+
      inputField("studyCardName","角色名称",c.name)+
      textField("studyCardDesc","角色描述",c.description,5)+
      textField("studyCardPersonality","性格",c.personality)+
      textField("studyCardScenario","背景 / 场景",c.scenario)+
      textField("studyCardSystem","系统设定",c.system_prompt)+
      textField("studyCardGreeting","默认开场白",c.first_mes)+
      (arr(c.alternate_greetings).length?'<details class="study-alts"><summary>编辑其它 '+arr(c.alternate_greetings).length+' 条开场</summary>'+
        arr(c.alternate_greetings).map((txt,i)=>textField("studyAlt"+i,"备选 "+(i+2),txt,4)).join("")+'</details>':"")+
      (arr(c.displayRules).length?'<p class="study-tip">已保存 '+arr(c.displayRules).length+' 条酒馆 HTML 显示规则：'+escape(arr(c.displayRules).map(r=>r.name).join(" / "))+'. 仅预览 HTML/CSS，不运行原酒馆助手脚本。</p>':"")+
      check("studyCardActive","启用角色卡上下文",c.enabled)+
      btn("saveCard","保存人物设定","","primary")+'</div></details>';
  }
  if(tab==="preset"){
    html+='<section class="study-section-heading"><span class="study-eyebrow">PRESET / 角色补充</span>'+
      '<h3>故事的语气与规则</h3><p>附加到模型的预设指令，不改变原接口或聊天角色。</p></section>'+
      '<label class="study-import">＋ 导入预设 JSON<input type="file" id="studyPresetImport" accept=".json,application/json" hidden></label>'+
      '<details class="study-editor" '+(!p.content?"open":"")+'>'+
        '<summary><span>'+(p.name?escape(p.name):"编辑预设内容")+'</span><small>'+(p.enabled?"使用中":"暂未启用")+'</small></summary>'+
        '<div class="study-editor-fields">'+inputField("studyPresetName","预设名称",p.name)+
        textField("studyPresetContent","预设指令",p.content,12)+
        check("studyPresetActive","启用这个预设",p.enabled)+btn("savePreset","保存预设","","primary")+'</div></details>';
  }
  if(tab==="lore"){
    const x=b.lore.find(e=>e.id===editLore)||{};
    html+='<section class="study-section-heading"><span class="study-eyebrow">WORLD / 设定集</span>'+
      '<h3>世界藏在细节里</h3><p>常驻条目每轮可见；关键词条目会结合最近聊天触发，最多读取四条正文。</p></section>'+
      '<label class="study-import">＋ 导入世界书 JSON<input type="file" id="studyLoreImport" accept=".json,application/json" hidden></label>'+
      '<details class="study-editor" '+(editLore?"open":"")+'>'+
        '<summary><span>'+(editLore?"正在编辑设定":"＋ 写一条世界书")+'</span><small>地点 · 人物 · 物品 · 规则</small></summary>'+
        '<div class="study-editor-fields">'+
        inputField("studyLoreName","设定名称",x.name)+
        inputField("studyLoreKeys","关键词（逗号分开）",arr(x.keys).join("，"))+
        textField("studyLoreContent","正文",x.content,6)+
        check("studyLoreConstant","常驻设定",x.constant)+
        check("studyLoreActive","启用条目",x.enabled!==false)+
        '<div class="study-actions">'+btn("saveLore",editLore?"保存修改":"添加条目","","primary")+
        (editLore?btn("cancelLore","取消编辑"):"")+'</div></div></details>'+
        '<div class="study-shelf-head"><div><span class="study-eyebrow">INDEX / WORLD BOOK</span><h3>设定目录</h3></div><span class="study-count">'+b.lore.length+' 条</span></div>';
    html+=(b.lore.length?b.lore.map(x=>'<article class="study-card study-lore-entry">'+
      '<div class="study-chapter-top"><span class="study-chapter-type">'+(x.constant?"常驻":"关键词")+'</span>'+
      '<time>'+(x.enabled===false?"已关闭":"已启用")+'</time></div>'+
      '<strong>'+escape(x.name||"设定")+'</strong>'+
      '<small>'+escape(arr(x.keys).join(" / ")||"随时可用")+'</small>'+
      '<p>'+escape(cap(x.content,135))+'</p>'+
      '<div class="study-actions">'+btn("editLore","编辑",x.id)+btn("deleteLore","删除",x.id,"danger")+'</div></article>').join(""):
      '<div class="study-empty">世界书还是空白的。地点、人物、约定，都可以写在这里。</div>');
  }
  if(tab==="chapter"){
    const x=b.chapters.find(e=>e.id===editChapter)||{};
    html+='<section class="study-section-heading">'+
      '<span class="study-eyebrow">STORY / CHAPTERS</span>'+
      '<h3>故事在这里继续</h3>'+
      '<p>先看最新剧情，再沿着时间线翻阅章节。想手写内容时，展开编辑页就好。</p></section>';
    html+=window.xyStudyAuto?.panelHTML?.()||"";
    html+='<details class="study-editor" '+(editChapter?"open":"")+'>'+
      '<summary><span>'+(editChapter?"正在编辑章节":"＋ 手写一篇章节")+'</span><small>'+(editChapter?"保存后会返回故事书架":"点开后再填写")+'</small></summary>'+
      '<div class="study-editor-fields">'+
      inputField("studyChapterName","章节标题",x.name)+
      textField("studyChapterText","章节正文",x.text,11)+
      textField("studyChapterSummary","章节摘要",x.summary,4)+
      check("studyChapterActive","引用最新章节摘要",b.useSummary)+
      '<div class="study-actions">'+btn("saveChapter",editChapter?"更新章节":"保存新章节","","primary")+
      (editChapter?btn("cancelChapter","取消编辑"):"")+'</div></div></details>';
    const ordered=[...b.chapters].reverse();
    html+='<section class="study-shelf"><div class="study-shelf-head">'+
      '<div><span class="study-eyebrow">ARCHIVE / SAVED STORIES</span><h3>章节书架</h3></div>'+
      '<span class="study-count">'+ordered.length+' 篇</span></div>'+
      (ordered.length?'<div class="study-timeline">'+ordered.map((entry,index)=>{
        const day=new Date(entry.updated||Date.now()).toLocaleDateString("zh-CN");
        const type=entry.generated?"自动归档":"手写章节";
        const excerpt=cap(entry.summary||entry.text,165);
        const fullText=String(entry.text||entry.summary||"").trim();
        const readingLabel=entry.generated?"本章原始聊天":"完整章节正文";
        return '<details class="study-card study-chapter-entry">'+
          '<summary class="study-chapter-cover" aria-label="展开或收起章节：'+escape(entry.name||"无标题")+'">'+
            '<span class="study-chapter-top"><span class="study-chapter-number">'+String(ordered.length-index).padStart(2,"0")+'</span>'+
              '<span class="study-chapter-type">'+type+'</span><time>'+escape(day)+'</time></span>'+
            '<strong>'+escape(entry.name||"无标题")+'</strong>'+
            '<span class="study-chapter-excerpt">'+escape(excerpt||"点开查看章节内容")+'</span>'+
            '<span class="study-chapter-open-hint"><span class="study-chapter-open-label">点击阅读整章</span><span class="study-chapter-close-label">收起章节</span>'+
              '<span class="study-chapter-chevron" aria-hidden="true">⌄</span></span>'+
          '</summary>'+
          '<div class="study-chapter-reading">'+
            '<div class="study-chapter-reading-label">'+escape(readingLabel)+'</div>'+
            '<div class="study-chapter-full">'+escape(fullText||"这一章还没有正文。")+'</div>'+
            '<div class="study-actions">'+btn("editChapter","编辑章节",entry.id)+btn("deleteChapter","删除章节",entry.id,"danger")+'</div>'+
          '</div>'+
        '</details>';
      }).join("")+'</div>':
      '<div class="study-empty">还没有章节。聊过的故事，可以从上面的「整理最近 8 轮」开始收集。</div>')+
      '</section>';
  }
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
// Import only small, known display rules. Full Tavern Helper scripts can
// exceed 300 KB and require its privileged JS API; never run them here.
function importDisplayRules(raw){
  const x=raw?.data&&typeof raw.data==="object"?raw.data:raw;
  const list=arr(x?.extensions?.regex_scripts);
  return list.filter(item=>item&&item.disabled!==true&&item.promptOnly!==true)
    .map(item=>{
      const find=String(item.findRegex||"");
      const kind=/<jn_status>/i.test(find)?"status":/【主页】/.test(find)?"homepage":"";
      const template=String(item.replaceString||"");
      if(!kind||!template||template.length>40000||find.length>2000)return null;
      return {kind,name:cap(item.scriptName||"酒馆渲染",100),findRegex:find,replaceString:template};
    }).filter(Boolean).slice(0,8);
}
function parseCard(raw){
  const x=raw?.data&&typeof raw.data==="object"?raw.data:raw;
  if(!x||typeof x!=="object"||(!x.name&&!x.description&&!x.personality))throw Error("不是可识别的角色卡");
  const alts=arr(x.alternate_greetings??raw.alternate_greetings).filter(t=>typeof t==="string"&&t.trim()).map(t=>cap(t,8000));
  return {name:cap(x.name,120),description:cap(x.description,10000),personality:cap(x.personality,5000),scenario:cap(x.scenario,5000),system_prompt:cap(x.system_prompt,5000),first_mes:cap(x.first_mes,8000),alternate_greetings:alts,displayRules:importDisplayRules(raw),enabled:true};
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
      greetingChoice=0;saveStudy(b=>{b.card=card;appendLore(b,extra)},"角色卡已导入 · "+([card.first_mes,...card.alternate_greetings].filter(Boolean).length)+" 条开场白 · "+card.displayRules.length+" 条 HTML 显示规则"+(extra.length?"，含世界书":""));
    }else if(kind==="preset")saveStudy(b=>{b.preset=parsePreset(raw)},"预设已导入，检查后再启用");
    else{const entries=parseLore(raw);if(!entries.length)throw Error("没有有效世界书条目");saveStudy(b=>appendLore(b,entries),"世界书已导入 "+entries.length+" 条（重复条目跳过）")}
  }catch(e){status="导入失败："+String(e?.message||e);draw()}
}
function bundle(){return JSON.stringify({format:"AevrenXYStudy",version:1,characterId:id(),characterName:charName(),at:new Date().toISOString(),data:currentBook()},null,2)}
function context(options={}){
  const b=book(load(),String(options.characterId||id()));
  const q=String(options.query||"").toLowerCase();
  const recent=String(options.recent||"").toLowerCase().slice(-2600);
  const c=b.card||{},p=b.preset||{},sections=[];
  const conversationId=String(options.chatId??(typeof chat==="function"?chat()?.id:"")??"");
  if(p.enabled&&p.content)sections.push("【书房·预设】\n"+cap(p.content,1900));
  const openingChat=typeof chats!=="undefined"?chats.find(c=>String(c.id)===conversationId):null;
  if(openingChat?.studyGreeting&&String(openingChat.characterId||"")===String(options.characterId||id())){
    sections.push("【书房·本对话已选的开场】\n"+cap(openingChat.studyGreeting,2200));
  }
  if(c.enabled){
    const fields=[["名字",c.name],["描述",c.description],["性格",c.personality],["背景",c.scenario],["设定",c.system_prompt]]
      .filter(x=>x[1]).map(x=>x[0]+"："+cap(x[1],x[0]==="描述"?800:400));
    if(fields.length)sections.push("【书房·角色卡】\n"+fields.join("\n"));
  }
  // The model gets a bounded table of contents, not every page of the archive.
  // This lets it know what can be looked up and explain gaps instead of inventing lore.
  const visibleChapters=b.chapters.filter(x=>!x.generated||String(x.originChatId)===conversationId);
  const titles=visibleChapters.slice(-10).map(x=>cap(x.name,30)).filter(Boolean);
  const loreNames=b.lore.filter(x=>x.enabled!==false).slice(0,14).map(x=>cap(x.name,30)).filter(Boolean);
  if(titles.length||loreNames.length){
    const nav=[];
    if(loreNames.length)nav.push("世界书条目："+loreNames.join("、"));
    if(titles.length)nav.push("章节："+titles.join("、"));
    sections.push("【书房·可用目录（非正文）】\n"+cap(nav.join("\n"),520));
  }
  const matched=b.lore.filter(x=>{
    if(x.enabled===false||!x.content)return false;
    if(x.constant)return true;
    return arr(x.keys).some(k=>{
      const token=String(k||"").trim().toLowerCase();
      return !!token&&(q.includes(token)||recent.includes(token));
    });
  }).slice(0,4);
  if(matched.length)sections.push("【书房·当前触发的世界书正文】\n"+matched.map(x=>(x.name||"设定")+"："+cap(x.content,550)).join("\n"));
  const latest=visibleChapters[visibleChapters.length-1];
  if(b.useSummary&&latest?.summary)sections.push("【书房·本对话最近剧情摘要】\n"+cap(latest.summary,750));
  const relevant=[...visibleChapters].reverse().find(x=>{
    const name=String(x.name||"").trim().toLowerCase();
    return name.length>=2&&q.includes(name);
  })||((/书房|章节|前一章|上一章|回顾|前面发生|之前的剧情/.test(q))?latest:null);
  if(relevant&&(relevant.text||relevant.summary)){
    // Only provide an excerpt when the user asks for a chapter/topic.
    const body=cap(relevant.text||relevant.summary,1450);
    sections.push("【书房·查询到的章节："+cap(relevant.name,60)+"】\n"+body);
  }
  return cap(sections.join("\n\n"),7200);
}
const host=document.querySelector("#panelBody");
host?.addEventListener("change",event=>{
  const t=event.target;if(!t.closest("#xyStudy"))return;
  if(t.id==="studyGreetingChoice"){
    greetingChoice=Number(t.value)||0;
    const options=[currentBook().card?.first_mes,...arr(currentBook().card?.alternate_greetings)].filter(Boolean);
    const preview=document.getElementById("studyGreetingPreview");
    if(preview)preview.value=String(options[greetingChoice]||"");
    return
  }
  if(t.id==="studyCardImport")importFile(t.files?.[0],"card");
  if(t.id==="studyPresetImport")importFile(t.files?.[0],"preset");
  if(t.id==="studyLoreImport")importFile(t.files?.[0],"lore");
});
host?.addEventListener("click",event=>{
  if(!event.target.closest("#xyStudy"))return;
  const t=event.target.closest("[data-study]");if(!t)return;
  const action=t.dataset.study,key=t.dataset.key;
  if(action==="pickGreeting"){
    const all=[currentBook().card?.first_mes,...arr(currentBook().card?.alternate_greetings)].filter(Boolean);
    const choice=Number(key);
    if(!Number.isInteger(choice)||choice<0||choice>=all.length)return;
    greetingChoice=choice;
    const hidden=document.getElementById("studyGreetingChoice");
    if(hidden)hidden.value=String(choice);
    const preview=document.getElementById("studyGreetingPreview");
    if(preview)preview.value=String(all[choice]);
    const shown=document.getElementById("studyGreetingCurrent");
    if(shown)shown.textContent="第 "+(choice+1)+" 条 · "+cap(String(all[choice]).replace(/\s+/g," "),42);
    document.querySelectorAll("#xyStudy .study-greeting-option").forEach(btn=>{
      const chosen=Number(btn.dataset.key)===choice;
      btn.classList.toggle("chosen",chosen);
      btn.setAttribute("aria-pressed",String(chosen));
      const tick=btn.querySelector(".study-greeting-tick");
      if(tick&&!chosen)tick.remove();
      if(!tick&&chosen){
        const mark=document.createElement("span");
        mark.className="study-greeting-tick";mark.setAttribute("aria-hidden","true");mark.textContent="✓";
        btn.appendChild(mark);
      }
    });
    const menu=document.getElementById("studyGreetingMenu");
    if(menu)menu.open=false;
    return;
  }
  if(action==="tab"){tab=key;editLore="";editChapter="";status="";draw();return}
  if(action==="saveCard"){
    const saved=arr(currentBook().card?.alternate_greetings);
    const c={name:cap(val("studyCardName"),120),description:cap(val("studyCardDesc"),10000),personality:cap(val("studyCardPersonality"),5000),scenario:cap(val("studyCardScenario"),5000),system_prompt:cap(val("studyCardSystem"),5000),first_mes:cap(val("studyCardGreeting"),8000),alternate_greetings:saved.map((v,i)=>cap(document.getElementById("studyAlt"+i)?.value??v,8000)),displayRules:arr(currentBook().card?.displayRules),enabled:on("studyCardActive")};
    saveStudy(b=>{b.card=c});return
  }
  if(action==="startGreetingChat"){
    const greetings=[currentBook().card?.first_mes,...arr(currentBook().card?.alternate_greetings)].filter(Boolean);
    const selection=Number(document.getElementById("studyGreetingChoice")?.value||0);
    const intro=greetings[selection];
    if(!intro){status="没有可用的开场白";draw();return}
    const characterId=id(),characterName=charName(),chatId=Date.now()+Math.floor(Math.random()*1000);
    chats.unshift({id:chatId,characterId,title:cap(characterName+" · 开场 "+(selection+1),36),
      messages:[{role:"assistant",text:intro,createdAt:Date.now(),studyOpening:true}],
      studyGreeting:intro,studyGreetingIndex:selection});
    current=chatId;save();renderChats();renderMessages();
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#scrim")?.classList.remove("show");return
  }
  if(action==="savePreset"){const p={name:cap(val("studyPresetName"),100),content:cap(val("studyPresetContent"),30000),enabled:on("studyPresetActive")};saveStudy(b=>{b.preset=p});return}
  if(action==="saveLore"){
    const e={id:editLore||uuid(),name:cap(val("studyLoreName")||"设定",90),keys:words(val("studyLoreKeys")),content:cap(val("studyLoreContent"),7000),constant:on("studyLoreConstant"),enabled:on("studyLoreActive")};
    if(!e.content||(!e.keys.length&&!e.constant)){status="请填写正文与关键词，或开启常驻";draw();return}
    saveStudy(b=>{const i=b.lore.findIndex(x=>x.id===editLore);if(i>=0)b.lore[i]=e;else b.lore.push(e);editLore=""});return;
  }
  if(action==="editLore"){editLore=key;status="";draw();document.querySelector("#xyStudy .study-editor")?.scrollIntoView?.({behavior:"smooth",block:"start"});return}
  if(action==="cancelLore"){editLore="";draw();return}
  if(action==="deleteLore"){if(!confirm("删除这条世界书设定？"))return;saveStudy(b=>{b.lore=b.lore.filter(x=>x.id!==key);editLore=""},"已删除条目");return}
  if(action==="saveChapter"){
    const e={id:editChapter||uuid(),name:cap(val("studyChapterName")||"未命名章节",100),text:cap(val("studyChapterText"),150000),summary:cap(val("studyChapterSummary"),3000),updated:Date.now()};
    if(!e.text){status="章节正文不能为空";draw();return}
    saveStudy(b=>{const i=b.chapters.findIndex(x=>x.id===editChapter);if(i>=0)b.chapters[i]=e;else b.chapters.push(e);b.useSummary=on("studyChapterActive");editChapter=""});return;
  }
  if(action==="editChapter"){editChapter=key;status="";draw();document.querySelector("#xyStudy .study-editor")?.scrollIntoView?.({behavior:"smooth",block:"start"});return}
  if(action==="cancelChapter"){editChapter="";draw();return}
  if(action==="deleteChapter"){if(!confirm("删除这一章？"))return;saveStudy(b=>{b.chapters=b.chapters.filter(x=>x.id!==key);editChapter=""},"已删除章节");return}
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
#xyStudy .study-preview{border:1px solid #cedbd0;border-radius:12px;background:#f7faf5;padding:10px 12px;overflow-wrap:anywhere}
#xyStudy .study-preview summary{font-size:12px;cursor:pointer;color:#355c44;font-weight:600}
#xyStudy .study-preview p{font-size:11px;line-height:1.6;color:#657b6a}
#xyStudy .study-preview pre{display:block;white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow-y:auto;padding:10px;background:#fff;border-radius:8px;font-size:11px;line-height:1.6;color:#364a3b}

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
#xyStudy .study-alts{border:1px solid #d8e1d7;padding:10px;border-radius:10px}
#xyStudy .study-alts summary{cursor:pointer;color:#46634f}
#xyStudy .study-alts .study-field{margin-top:10px}
#xyStudy select{max-width:100%;padding:10px;border:1px solid #d2ded2;border-radius:9px;background:#fff;color:#3d5244}
#xyStudy .study-card #studyGreetingPreview{width:100%;min-height:100px;padding:10px;border:1px solid #d2ded2;border-radius:9px;background:#fff;color:#3d5244;font:inherit;resize:vertical;white-space:pre-wrap}
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