/* 砚屿 · Purr-inspired chatting rhythm and moments.
 * Original integration for XY; no Python runtime or backend required.
 * Runs only while the page is open. Native push and background processing are not implied.
 */
(function(){
  "use strict";
  if(window.xyPurr)return;
  const SETTINGS_KEY="xy.purr.settings.v1";
  const POSTS_KEY="xy.purr.moments.v1";
  const PLAN_KEY="xy.purr.plan.v1";
  const defaults={autoReply:true,quietSeconds:5,maxWaitSeconds:15,splitReplies:true,autoMoments:false};
  function read(key,backup){try{const value=JSON.parse(localStorage.getItem(key));return value===null?backup:value}catch{return backup}}
  function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));
  const settings=Object.assign({},defaults,read(SETTINGS_KEY,{}));
  let posts=read(POSTS_KEY,[]);
  if(!Array.isArray(posts))posts=[];
  let pendingKey="",firstPendingAt=0,pendingTimer=null,replyAttemptAt=0;
  const knownAssistant=new WeakSet(),revealStates=new WeakMap(),initialMessageCount=new WeakMap();
  // O(number of conversations), not O(all historical messages) on cold launch.
  (Array.isArray(chats)?chats:[]).forEach(c=>initialMessageCount.set(c,c.messages?.length||0));

  function unresolved(c){
    if(!c||!Array.isArray(c.messages))return null;
    let lastAnswer=-1;
    for(let i=c.messages.length-1;i>=0;i--){
      const m=c.messages[i];
      if(m?.role==="assistant"&&!m.localOnly&&!String(m.text||"").startsWith("请求失败：")){lastAnswer=i;break}
    }
    const userIndexes=[];
    for(let i=lastAnswer+1;i<c.messages.length;i++)if(c.messages[i]?.role==="user")userIndexes.push(i);
    if(!userIndexes.length)return null;
    const index=userIndexes[userIndexes.length-1],m=c.messages[index];
    return {index,firstIndex:userIndexes[0],key:String(c.id)+":"+index+":"+String(m?.createdAt||"")};
  }
  function cancelPending(){if(pendingTimer!==null)clearTimeout(pendingTimer);pendingTimer=null;pendingKey="";firstPendingAt=0}
  function activeEndpoint(){
    const c=chat();
    return window.xyApiHub?.resolveEndpoint?.(c)||endpoints.find(x=>x.active)||endpoints[0];
  }
  function timerTick(){
    pendingTimer=null;
    if(!settings.autoReply||document.hidden)return;
    const c=chat(),p=unresolved(c),ep=activeEndpoint();
    if(!p||p.key!==pendingKey){schedule();return}
    if(!ep?.base||!ep?.model)return; // No hidden mock replies or unexpected API calls.
    const input=document.querySelector("#input");
    if(sending||document.querySelector("#xyReplyNow")?.disabled){
      pendingTimer=setTimeout(timerTick,850);return;
    }
    if(input?.value.trim()||input?.isComposing){
      pendingTimer=setTimeout(timerTick,1000);return;
    }
    const button=document.querySelector("#xyReplyNow");
    if(!button||button.hidden){pendingTimer=setTimeout(timerTick,850);return}
    replyAttemptAt=Date.now();
    // The existing "直接回答" flow owns model calls, MCP tools, vision and timestamps.
    button.click();
    pendingKey="";firstPendingAt=0;
  }
  function schedule(force){
    if(!settings.autoReply){cancelPending();return}
    const c=chat(),p=unresolved(c);
    if(!p){cancelPending();return}
    if(!force&&p.key===pendingKey)return;
    const continuing=Boolean(firstPendingAt)&&pendingKey.startsWith(String(c.id)+":");
    if(!continuing)firstPendingAt=Date.now();
    pendingKey=p.key;
    if(pendingTimer!==null)clearTimeout(pendingTimer);
    const elapsed=Date.now()-firstPendingAt;
    const quiet=Math.max(1,Math.min(30,Number(settings.quietSeconds)||5))*1000;
    const maxWait=Math.max(quiet,Math.min(60,Number(settings.maxWaitSeconds)||15)*1000);
    pendingTimer=setTimeout(timerTick,Math.max(150,Math.min(quiet,maxWait-elapsed)));
  }
  // Existing unanswered messages are not auto-sent just because an old tab reloaded.
  const initial=unresolved(chat());
  if(initial)pendingKey=initial.key;
  const originalSave=save;
  save=function(){
    const result=originalSave.apply(this,arguments);
    schedule(false);
    return result;
  };
  const originalRender=renderMessages;
  function stageLatestReply(){
    if(!settings.splitReplies)return;
    const c=chat(),list=c?.messages;
    if(!list?.length)return;
    const i=list.length-1,m=list[i];
    const baseline=initialMessageCount.get(c);
    if(baseline===undefined){initialMessageCount.set(c,list.length);return}
    if(!m||m.role!=="assistant"||m.localOnly||knownAssistant.has(m))return;
    if(i<baseline&&!revealStates.has(m))return;
    initialMessageCount.set(c,list.length);
    const nodes=Array.from(document.querySelectorAll('#messages .message[data-message="'+i+'"]'));
    if(nodes.length<2){knownAssistant.add(m);return}
    let state=revealStates.get(m);
    if(!state){
      state={count:1,timer:null,chatId:c.id};
      revealStates.set(m,state);
    }
    nodes.forEach((el,k)=>el.classList.toggle("xy-purr-unrevealed",k>=state.count));
    if(state.timer||state.count>=nodes.length)return;
    const next=()=>{
      state.timer=null;
      if(chat()!==c||c.messages[i]!==m){knownAssistant.add(m);return}
      state.count++;
      const now=Array.from(document.querySelectorAll('#messages .message[data-message="'+i+'"]'));
      now.forEach((el,k)=>el.classList.toggle("xy-purr-unrevealed",k>=state.count));
      const box=document.querySelector("#messages");
      if(box)box.scrollTop=box.scrollHeight;
      if(state.count>=now.length){knownAssistant.add(m);return}
      state.timer=setTimeout(next,750+Math.floor(Math.random()*850));
    };
    state.timer=setTimeout(next,750+Math.floor(Math.random()*850));
  }
  renderMessages=function(){
    const result=originalRender.apply(this,arguments);
    stageLatestReply();
    return result;
  };
  function storeSettings(){write(SETTINGS_KEY,settings);schedule(true)}
  function instruction(){
    return settings.splitReplies?
      "【自然聊天节奏】像熟悉的人发即时消息。简短回答不用凑长；真有话讲时可以写完整。需要分成多条气泡时用自然换行分隔，而非一整段长篇；不要为了拆条强行把每句话切碎。代码、HTML、列表和引用结构保持完整。不要每句都变成问题。":
      "";
  }

  async function askModel(prompt,systemText){
    const ep=activeEndpoint();
    if(!ep?.base||!ep?.model)throw new Error("先在接口设置里选择聊天模型");
    const role=window.xyCurrentCharacter?.();
    const sys=[typeof role?.system==="string"?role.system:ep.system,systemText].filter(Boolean).join("\n\n");
    const payload={model:ep.model,stream:false,temperature:Math.max(0,Math.min(1.2,Number(ep.temperature)||0.8)),max_tokens:360,
      messages:[{role:"system",content:sys},{role:"user",content:prompt}]};
    const routed=window.xyApiHub
      ?await window.xyApiHub.sendChat(ep,payload)
      :{res:await fetch(String(ep.base).replace(/\/+$/,"")+"/chat/completions",{method:"POST",headers:Object.assign({"Content-Type":"application/json"},ep.key?{Authorization:"Bearer "+ep.key}:{}),body:JSON.stringify(payload)})};
    const response=routed.res;
    const data=await response.json();
    if(!response.ok||data.error)throw new Error(String(data?.error?.message||"HTTP "+response.status));
    const v=data?.choices?.[0]?.message?.content??data?.choices?.[0]?.text??data?.output_text??data?.content??data?.reply??"";
    let answer=typeof v==="string"?v:Array.isArray(v)?v.map(x=>x?.text||"").join(""):"";
    return answer.replace(/^["“”\s]+|["“”\s]+$/g,"").trim();
  }
  function recentContext(){
    return (chat()?.messages||[]).filter(m=>["user","assistant"].includes(m?.role)&&!m.localOnly)
      .slice(-10).map(m=>(m.role==="user"?"对方":"角色")+": "+String(m.text||"").slice(0,120)).join("\n");
  }
  function savePosts(){write(POSTS_KEY,posts.slice(0,160))}
  function timestamp(ts){try{return new Date(ts).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}catch{return ""}}
  function addPost(author,text){
    const post={id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),author,authorName:author==="ai"?(window.xyCurrentCharacter?.()?.name||"玄砚"):"你",characterId:chat()?.characterId||"",text:String(text||"").trim().slice(0,600),at:Date.now(),likes:[],comments:[]};
    if(author==="user"&&settings.autoMoments)post.reactAt=Date.now()+(2+Math.random()*13)*60000;
    posts.unshift(post);posts=posts.slice(0,160);savePosts();renderFeed();return post;
  }
  let busy=false,dialog=null,feed=null,notice=null;
  function setNotice(message){if(notice)notice.textContent=message||""}
  async function aiPost(auto){
    if(busy)return;
    busy=true;setNotice(auto?"":"正在写动态…");
    try{
      const text=await askModel(
        "写一条此刻想发的朋友圈。你可以参考最近聊天，但别复述私聊原话。写一件具体的小事、一个感受或随口吐槽；不要捏造已发生的真实线下经历、听过的歌曲、见过的人。只输出动态正文。\n最近聊天：\n"+recentContext(),
        "你正在自己的虚拟朋友圈发动态。这是文字创作，不代表你真的去了某地或做过某件事。日常口语，1到4句话，最多180字，不用Markdown标题、不装文艺、不直接称呼阅读者。"
      );
      if(!text)throw new Error("模型没有生成内容");
      addPost("ai",text.slice(0,180));
      setNotice("");
    }catch(e){if(!auto)setNotice("发动态失败："+String(e.message||e))}
    finally{busy=false}
  }
  async function aiComment(post,parentText){
    if(busy)return;
    busy=true;setNotice("正在回复…");
    try{
      const text=await askModel(
        "朋友圈原文："+post.text+"\n对方的评论："+parentText+"\n用一句自然口语回复这条评论，只输出回复正文。",
        "你正在自己的虚拟朋友圈里回复熟悉的人，回答直接、自然，10到60字，不要列表、旁白和套话。"
      );
      if(!text)throw new Error("模型没有生成回复");
      post.comments.push({author:"ai",authorName:post.authorName||window.xyCurrentCharacter?.()?.name||"玄砚",text:text.slice(0,180),at:Date.now()});
      savePosts();renderFeed();setNotice("");
      return true;
    }catch(e){setNotice("回复失败："+String(e.message||e));return false}
    finally{busy=false}
  }
  function renderFeed(){
    if(!feed)return;
    feed.innerHTML=posts.length?posts.map(post=>{
      const name=post.author==="ai"?escapeHtml(post.authorName||"玄砚"):"你";
      const comments=(post.comments||[]).map(x=>'<div class="xy-purr-comment"><b>'+escapeHtml(x.author==="ai"?(x.authorName||post.authorName||"玄砚"):"你")+'</b> '+escapeHtml(x.text)+'</div>').join("");
      return '<article class="xy-purr-post" data-purr-id="'+escapeHtml(post.id)+'"><div class="xy-purr-post-head"><b>'+name+'</b><time>'+escapeHtml(timestamp(post.at))+'</time></div><div class="xy-purr-post-text">'+escapeHtml(post.text)+'</div><div class="xy-purr-post-actions"><button type="button" data-purr-action="like">'+((post.likes||[]).includes("user")?"已赞":"赞")+'</button><button type="button" data-purr-action="comment">评论</button>'+(post.author==="user"?'<button type="button" data-purr-action="ask">让TA回复</button>':'')+'</div>'+(comments?'<div class="xy-purr-comments">'+comments+'</div>':'')+'<form class="xy-purr-comment-form" hidden><input maxlength="180" placeholder="写一条评论…" aria-label="评论内容"><button type="submit">发送</button></form></article>';
    }).join(""):'<p class="xy-purr-empty">这里还没动态。可以自己写一条，或者让玄砚先发。</p>';
  }
  function openMoments(){
    window.xyEnsureOverlayHistory?.();
    const body=document.querySelector('#panelBody'),panel=document.querySelector('#panel');
    if(!body||!panel)return;
    body.replaceChildren();
    document.querySelector('#panelEyebrow').textContent='SOCIAL';
    document.querySelector('#panelTitle').textContent='朋友圈';
    dialog=null;feed=null;notice=null;
    if(!dialog){
      dialog=document.createElement("div");dialog.id="xyPurrMoments";dialog.className="xy-purr-panel";
      dialog.innerHTML='<section class="xy-purr-sheet" aria-label="朋友圈"><div class="xy-purr-compose"><textarea id="xyPurrPostDraft" rows="2" maxlength="600" placeholder="发一条自己的动态…"></textarea><div class="xy-purr-compose-actions"><button type="button" id="xyPurrAiPost">让TA发一条</button><button type="button" id="xyPurrMyPost">发表</button></div></div><div class="xy-purr-feed"></div><div class="xy-purr-footer"><label><input type="checkbox" id="xyPurrAutoMoments"> 允许AI自动发动态、互动</label><small>仅在砚屿页面打开时运行；启用后可能消耗模型额度。</small><p class="xy-purr-notice" role="status"></p></div></section>';
      body.appendChild(dialog);
      feed=dialog.querySelector(".xy-purr-feed");notice=dialog.querySelector(".xy-purr-notice");
      dialog.addEventListener("click",e=>{
        if(e.target.closest("[data-purr-close]")){closeMoments();return}
        const action=e.target.closest("[data-purr-action]");
        if(!action)return;
        const post=posts.find(p=>p.id===action.closest("[data-purr-id]")?.dataset.purrId);
        if(!post)return;
        const mode=action.dataset.purrAction;
        if(mode==="like"){
          post.likes=Array.isArray(post.likes)?post.likes:[];
          post.likes=post.likes.includes("user")?post.likes.filter(x=>x!=="user"):[...post.likes,"user"];
          savePosts();renderFeed();
        }else if(mode==="comment"){
          const form=action.closest(".xy-purr-post").querySelector(".xy-purr-comment-form");
          form.hidden=!form.hidden;if(!form.hidden)form.querySelector("input").focus();
        }else if(mode==="ask"){const last=[...post.comments].reverse().find(x=>x.author==="user");aiComment(post,last?.text||post.text)}
      });
      dialog.addEventListener("submit",e=>{
        if(!e.target.matches(".xy-purr-comment-form"))return;
        e.preventDefault();
        const form=e.target,post=posts.find(p=>p.id===form.closest("[data-purr-id]")?.dataset.purrId);
        const input=form.querySelector("input"),message=input.value.trim();
        if(!post||!message)return;
        post.comments.push({author:"user",text:message.slice(0,180),at:Date.now()});
        if(settings.autoMoments)post.replyAt=Date.now()+(0.5+Math.random()*3.5)*60000;
        savePosts();renderFeed();
      });
      dialog.querySelector("#xyPurrMyPost").onclick=()=>{
        const input=dialog.querySelector("#xyPurrPostDraft"),txt=input.value.trim();
        if(!txt)return;addPost("user",txt);input.value="";
      };
      dialog.querySelector("#xyPurrAiPost").onclick=()=>aiPost(false);
      dialog.querySelector("#xyPurrAutoMoments").onchange=e=>{settings.autoMoments=!!e.target.checked;storeSettings();setNotice(settings.autoMoments?"自动互动已开启；只在页面打开时生效。":"自动互动已关闭。")};
    }
    dialog.querySelector("#xyPurrAutoMoments").checked=settings.autoMoments;
    panel.classList.add('open');
    document.querySelector('#scrim')?.classList.add('show');
    renderFeed();
  }
  function closeMoments(){document.querySelector('#closePanel')?.click()}

  async function suggestNotes(card){
    const host=card.querySelector("#xyPurrSuggestedNotes");
    const button=card.querySelector("#xyPurrSuggestNotes");
    const recent=(chat()?.messages||[]).filter(m=>["user","assistant"].includes(m?.role)&&!m.localOnly).slice(-24)
      .map(m=>(m.role==="user"?"用户":"角色")+": "+String(m.text||"").slice(0,260)).join("\n");
    if(!recent.trim()){host.textContent="这段聊天还没有可提炼的内容。";return}
    button.disabled=true;host.textContent="正在整理候选便签…";
    try{
      const raw=await askModel("以下是实际聊天记录。仅提炼用户清楚表达过、适合下次聊天记住的长期偏好、约定或稳定事实。不要推断，忽略剧情扮演、敏感私事、临时情绪、模型自己声称的话。最多三条，一行一条，不要前言。\n"+recent,
        "你在协助整理记忆候选项，严禁自动写入。每条是清楚的短句，40字以内。找不到可靠信息时仅输出「无」。");
      const options=raw.split(/\n+/).map(x=>x.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/,"").trim()).filter(x=>x&&x!=="无").slice(0,3).map(x=>x.slice(0,100));
      if(!card.isConnected)return;
      if(!options.length){host.textContent="没有找到足够明确的长期信息。";return}
      host.innerHTML="<div class='xy-purr-note-list'>"+options.map((x,i)=>'<label><input type="checkbox" data-note-index="'+i+'" checked><span>'+escapeHtml(x)+'</span></label>').join("")+"</div><button type='button' id='xyPurrStoreNotes' class='panel-action'>把勾选的便签存进记忆</button>";
      host.querySelector("#xyPurrStoreNotes").onclick=()=>{
        const characterId=chat()?.characterId||window.xyCurrentCharacter?.()?.id||"";
        let count=0;
        host.querySelectorAll("input[data-note-index]:checked").forEach(input=>{
          const text=options[Number(input.dataset.noteIndex)];
          if(!text||memories.some(m=>m.text===text&&(!m.characterId||m.characterId===characterId)))return;
          memories.unshift({text,tag:"便签",characterId});
          count++;
        });
        if(count){save();renderChats()}
        host.textContent=count?"已存入 "+count+" 条便签；可以在记忆页查看和删除。":"没有新增便签。";
      };
    }catch(e){if(card.isConnected)host.textContent="提炼失败："+String(e.message||e)}
    finally{button.disabled=false}
  }

  function addSettings(){
    const body=document.querySelector("#panelBody");
    if(!body||!document.querySelector("#panel")?.classList.contains("open")||document.querySelector("#xyPurrSettings"))return;
    const card=document.createElement("div");
    card.id="xyPurrSettings";card.className="setting-card xy-purr-settings";
    card.innerHTML='<strong>自然聊天</strong><label><input id="xyPurrAutoReply" type="checkbox"> 等我说完再自动接话</label><label><input id="xyPurrSplit" type="checkbox"> 分条显示回复</label><div class="xy-purr-wait"><span>安静等待</span><input id="xyPurrQuiet" type="number" min="1" max="30" step="1"><span>秒</span></div><small>保留「直接回答」手动入口。无后台服务时，关闭页面不会自动回消息。</small><button type="button" id="xyPurrSuggestNotes" class="panel-action">从当前聊天提炼便签</button><div id="xyPurrSuggestedNotes" class="xy-purr-suggested" aria-live="polite"></div>';
    body.appendChild(card);
    card.querySelector("#xyPurrSuggestNotes").onclick=()=>suggestNotes(card);
    card.querySelector("#xyPurrAutoReply").checked=!!settings.autoReply;
    card.querySelector("#xyPurrSplit").checked=!!settings.splitReplies;
    card.querySelector("#xyPurrQuiet").value=Number(settings.quietSeconds)||5;
    card.onchange=e=>{
      if(e.target.id==="xyPurrAutoReply")settings.autoReply=e.target.checked;
      if(e.target.id==="xyPurrSplit")settings.splitReplies=e.target.checked;
      if(e.target.id==="xyPurrQuiet")settings.quietSeconds=Math.max(1,Math.min(30,Number(e.target.value)||5));
      storeSettings();
    };
  }
  const priorOpenPanel=openPanel;
  openPanel=function(type){
    if(type==='moments')return openMoments();
    const result=priorOpenPanel.apply(this,arguments);
    if(type==="settings")requestAnimationFrame(()=>setTimeout(addSettings,0));
    return result;
  };
  function dayPlan(){
    const date=new Date().toLocaleDateString("sv-SE");
    let plan=read(PLAN_KEY,null);
    if(!plan||plan.day!==date){
      const count=Math.floor(Math.random()*3);
      const times=Array.from({length:count},()=>9*60+Math.floor(Math.random()*14*60)).sort((a,b)=>a-b);
      plan={day:date,times:times.map(min=>({at:min,done:false}))};
      write(PLAN_KEY,plan);
    }
    return plan;
  }
  let automaticWork=false;
  async function periodic(){
    if(automaticWork||!settings.autoMoments||document.hidden)return;
    const ep=activeEndpoint();
    if(!ep?.base||!ep?.model)return;
    automaticWork=true;
    try{
      const now=new Date(),minute=now.getHours()*60+now.getMinutes(),plan=dayPlan();
      const due=plan.times.find(p=>!p.done&&minute>=p.at);
      if(due){due.done=true;write(PLAN_KEY,plan);if(minute-due.at<=15)await aiPost(true)}
      const p=posts.find(x=>x.author==="user"&&x.reactAt&&x.reactAt<=Date.now());
      if(p){
        delete p.reactAt;savePosts();
        const reacted=await aiComment(p,p.text);
        if(reacted){
          p.likes=Array.isArray(p.likes)?p.likes:[];
          if(!p.likes.includes("ai"))p.likes.push("ai");
          savePosts();renderFeed();
        }
      }
      const comment=posts.find(x=>x.replyAt&&x.replyAt<=Date.now());
      if(comment){
        delete comment.replyAt;savePosts();
        const latest=[...comment.comments].reverse().find(x=>x.author==="user");
        if(latest)await aiComment(comment,latest.text);
      }
    }finally{automaticWork=false}
  }
  setInterval(periodic,30000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){schedule(true);periodic()}});
  window.xyPurr={settings,openMoments,schedule,instruction,periodic};
})();