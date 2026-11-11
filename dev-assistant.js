/* 砚屿开发助手 · 独立工具页面。需要用户自建的受控任务后端，不在浏览器运行 CLI。 */
(()=>{
  "use strict";
  const STORAGE="xy.devAssistant.v1";
  const MAX_TASKS=20;
  const RUNNING=new Set(["queued","planning","running","in_progress"]);
  const REVIEW=new Set(["needs_approval","waiting_approval","review"]);
  const LABELS={
    draft:"本地草稿",queued:"已排队",planning:"正在规划",running:"执行中",
    in_progress:"执行中",needs_approval:"待你确认",waiting_approval:"待你确认",
    review:"待你确认",completed:"已完成",failed:"失败",cancelled:"已取消"
  };
  const $=(root,selector)=>root.querySelector(selector);
  const safe=(value)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const clamp=(value,n)=>String(value??"").slice(0,n);
  const state=(()=>{
    try{
      const input=JSON.parse(localStorage.getItem(STORAGE)||"{}");
      return {
        endpoint:typeof input.endpoint==="string"?input.endpoint:"",
        repository:typeof input.repository==="string"?input.repository:"tusumy/aevren-xy",
        tasks:Array.isArray(input.tasks)?input.tasks.slice(0,MAX_TASKS):[]
      };
    }catch{return {endpoint:"",repository:"tusumy/aevren-xy",tasks:[]};}
  })();
  let temporaryToken="";
  let notice="";
  let busy=false;
  let polling=false;
  const persist=()=>{
    try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{
      notice="浏览器存储空间不足，任务记录未能保存。";
    }
  };
  const isRepository=(text)=>/^[\w.-]+\/[\w.-]+$/.test(text);
  const validEndpoint=(raw)=>{
    try{
      const url=new URL(raw);
      if(url.username||url.password||url.search||url.hash) return false;
      return url.protocol==="https:" || (url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname));
    }catch{return false;}
  };
  const currentPanel=()=>document.querySelector("#xyDevAssistant");
  const editTask=(localId,updates)=>{
    const task=state.tasks.find(t=>t.localId===localId);
    if(task){Object.assign(task,updates);task.updatedAt=Date.now();persist();}
    return task;
  };
  const api=async(path,method="GET",payload)=>{
    const endpoint=state.endpoint.trim().replace(/\/+$/,"");
    if(!validEndpoint(endpoint))throw Error("先配置有效的 HTTPS 服务地址。");
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const headers={Accept:"application/json"};
      if(payload!==undefined)headers["Content-Type"]="application/json";
      if(temporaryToken)headers.Authorization="Bearer "+temporaryToken;
      const response=await fetch(endpoint+path,{
        method,headers,credentials:"omit",signal:controller.signal,
        ...(payload===undefined?{}:{body:JSON.stringify(payload)})
      });
      const text=await response.text();
      let data={};
      if(text){
        try{data=JSON.parse(text);}catch{throw Error("服务返回的不是 JSON。");}
      }
      if(!response.ok)throw Error(clamp(data.error?.message||data.error||data.message||"HTTP "+response.status,180));
      if(data&&data.ok===false)throw Error(clamp(data.error||data.message||"服务拒绝了请求",180));
      return data||{};
    }catch(error){
      if(error.name==="AbortError")throw Error("请求超时，请检查服务是否在线。");
      if(error instanceof TypeError)throw Error("网络连接失败，检查 HTTPS、CORS 或服务状态。");
      throw error;
    }finally{clearTimeout(timeout);}
  };
  const taskMarkup=(task)=>{
    const status=clamp(task.status||"draft",40);
    const needsReview=REVIEW.has(status)&&!!task.remoteId;
    const working=RUNNING.has(status);
    const canRetry=status==="draft"&&!!state.endpoint;
    const link=String(task.prUrl||task.previewUrl||"");
    const validLink=/^https:\/\//.test(link)?link:"";
    const info=safe(clamp(task.summary||"等待后端返回规划和执行结果。",1500));
    const created=new Date(task.createdAt||Date.now()).toLocaleString();
    return '<article class="xy-da-task" data-task="'+safe(task.localId)+'">'+
      '<div class="xy-da-task-top"><span class="xy-da-state" data-state="'+safe(status)+'">'+safe(LABELS[status]||status)+'</span><time>'+safe(created)+'</time></div>'+
      '<strong>'+safe(clamp(task.instruction,140))+'</strong>'+
      '<small>'+safe(clamp(task.repository,120))+'</small>'+
      '<p class="xy-da-result">'+info+'</p>'+
      (validLink?'<a href="'+safe(validLink)+'" target="_blank" rel="noopener noreferrer">查看变更或预览 ↗</a>':"")+
      '<div class="xy-da-actions">'+
      (task.remoteId?'<button type="button" data-da-action="refresh" data-id="'+safe(task.localId)+'">刷新</button>':"")+
      (canRetry?'<button type="button" data-da-action="submit" data-id="'+safe(task.localId)+'">发送草稿</button>':"")+
      (needsReview?'<button type="button" class="xy-da-primary" data-da-action="approve" data-id="'+safe(task.localId)+'">确认应用变更</button>':"")+
      ((working||needsReview)&&task.remoteId?'<button type="button" data-da-action="cancel" data-id="'+safe(task.localId)+'">取消任务</button>':"")+
      '<button type="button" data-da-action="copy" data-id="'+safe(task.localId)+'">复制需求</button>'+
      '</div></article>';
  };
  const refreshList=()=>{
    const panel=currentPanel();
    if(!panel)return;
    const host=$(panel,"#xyDaHistory");
    if(host)host.innerHTML=state.tasks.length?state.tasks.map(taskMarkup).join(""):'<p class="xy-da-muted">还没有任务。先写一句想让助手做的事。</p>';
    const stateEl=$(panel,"#xyDaCount");
    if(stateEl)stateEl.textContent=String(state.tasks.length);
    const noticeEl=$(panel,"#xyDaNotice");
    if(noticeEl)noticeEl.textContent=notice;
    const createButton=$(panel,"#xyDaCreate");
    if(createButton)createButton.textContent=state.endpoint?"发送给开发助手":"保存任务草稿";
  };
  const render=()=>{
    const body=document.querySelector("#panelBody");
    if(!body)return;
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="DEVELOPMENT ASSISTANT";
    document.querySelector("#panelTitle").textContent="开发助手";
    body.innerHTML='<div id="xyDevAssistant" class="xy-da">'+
      '<section class="xy-da-intro"><span class="xy-da-eyebrow">Aevren · Builder</span><h3>想改哪里，直接交给助手。</h3>'+
      '<p>用于代码任务，不挤进日常聊天。先生成修改方案，确认后才应用变更。</p></section>'+
      '<form id="xyDaForm" class="xy-da-form">'+
      '<label for="xyDaRepo">GitHub 仓库</label>'+
      '<input id="xyDaRepo" name="repo" required autocomplete="off" spellcheck="false" placeholder="owner/repository" maxlength="120" value="'+safe(state.repository)+'">'+
      '<label for="xyDaInstruction">你想让助手做什么？</label>'+
      '<textarea id="xyDaInstruction" rows="5" maxlength="6000" placeholder="例如：检查砚屿聊天页的手机布局，整理输入框，先给出修改方案。"></textarea>'+
      '<button id="xyDaCreate" class="xy-da-primary" type="submit">'+(state.endpoint?"发送给开发助手":"保存任务草稿")+'</button></form>'+
      '<details class="xy-da-connect"><summary>连接云端执行服务 <span>'+(state.endpoint?"已填写地址":"尚未连接")+'</span></summary>'+
      '<p>填写你自己部署的任务 API 地址。反重力需要在服务器端运行；这里不会直接启动云电脑。</p>'+
      '<label for="xyDaEndpoint">任务服务 HTTPS 地址</label>'+
      '<input id="xyDaEndpoint" type="url" autocomplete="off" spellcheck="false" placeholder="https://assistant.example.com/api" value="'+safe(state.endpoint)+'">'+
      '<label for="xyDaToken">访问令牌（仅本次页面有效）</label>'+
      '<input id="xyDaToken" type="password" autocomplete="off" placeholder="Bearer token，可留空" value="">'+
      '<div class="xy-da-actions"><button type="button" id="xyDaSaveConfig">保存地址</button><button type="button" id="xyDaCheck">检测连接</button></div>'+
      '<small>令牌不会保存到浏览器存储或 GitHub。服务必须自行校验身份、限制仓库权限，并允许网页跨域访问。</small>'+
      '</details>'+
      '<p id="xyDaNotice" class="xy-da-notice" role="status" aria-live="polite"></p>'+
      '<section class="xy-da-records"><div class="xy-da-record-head"><h3>任务记录 <span id="xyDaCount">0</span></h3><button id="xyDaRefreshAll" type="button">刷新进度</button></div>'+
      '<div id="xyDaHistory"></div></section>'+
      '<p class="xy-da-muted xy-da-footer">未连接时只保存草稿，不会假装任务已执行。后端接口约定见仓库文档。</p>'+
      '</div>';
    document.querySelector("#panel")?.classList.add("open");
    document.querySelector("#scrim")?.classList.add("show");
    const panel=currentPanel();
    $(panel,"#xyDaForm").addEventListener("submit",createTask);
    $(panel,"#xyDaSaveConfig").addEventListener("click",saveConnection);
    $(panel,"#xyDaCheck").addEventListener("click",checkConnection);
    $(panel,"#xyDaRefreshAll").addEventListener("click",()=>refreshRemote());
    panel.addEventListener("click",handleTaskAction);
    refreshList();
  };
  const saveConnection=()=>{
    const panel=currentPanel();if(!panel)return;
    const endpoint=$(panel,"#xyDaEndpoint").value.trim().replace(/\/+$/,"");
    if(endpoint&&!validEndpoint(endpoint)){notice="地址必须是 HTTPS（本机 localhost 可以用 HTTP），也不能携带用户名、密码或查询参数。";refreshList();return false;}
    state.endpoint=endpoint;
    temporaryToken=$(panel,"#xyDaToken").value.trim();
    state.repository=$(panel,"#xyDaRepo").value.trim()||state.repository;
    persist();
    notice=endpoint?"服务地址已保存；需检测连接才能确认它可用。":"已清除执行服务地址，仍可保存草稿。";
    refreshList();
    return true;
  };
  async function checkConnection(){
    if(!saveConnection()||!state.endpoint)return;
    notice="正在检测…";refreshList();
    try{
      const response=await api("/health");
      notice="服务返回正常"+(response.name?" · "+clamp(response.name,50):"")+"。具体任务能力仍以服务端实现为准。";
    }catch(error){notice="连接失败："+error.message;}
    refreshList();
  }
  async function sendTask(task){
    if(!state.endpoint){notice="还没配置任务执行服务，已保存本地草稿。";refreshList();return;}
    const result=await api("/tasks","POST",{repository:task.repository,instruction:task.instruction,mode:"plan",approval_required:true});
    const remoteId=result.task_id??result.id;
    if(typeof remoteId!=="string"&&typeof remoteId!=="number")throw Error("服务没有返回 task_id，未确认任务是否创建，请先检查服务端记录。");
    editTask(task.localId,{
      remoteId:String(remoteId),status:clamp(result.status||"queued",40),
      summary:clamp(result.summary||"任务已发出，等待规划结果。",1500)
    });
    notice="任务已交给云端服务。";
    refreshList();
  }
  async function createTask(event){
    event.preventDefault();if(busy)return;
    const panel=currentPanel();if(!panel)return;
    const repository=$(panel,"#xyDaRepo").value.trim();
    const instruction=$(panel,"#xyDaInstruction").value.trim();
    if(!isRepository(repository)){notice="仓库格式应为 owner/repository。";refreshList();return;}
    if(!instruction){notice="先写下想做的任务。";refreshList();return;}
    state.repository=repository;
    const task={
      localId:"task-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
      repository,instruction,status:"draft",summary:"任务草稿尚未执行。",
      createdAt:Date.now(),updatedAt:Date.now(),remoteId:""
    };
    state.tasks.unshift(task);state.tasks=state.tasks.slice(0,MAX_TASKS);persist();
    $(panel,"#xyDaInstruction").value="";
    busy=true;
    try{await sendTask(task);}
    catch(error){notice="发送失败，草稿已保留："+error.message;refreshList();}
    finally{busy=false;}
  }
  const refreshOne=async(task)=>{
    if(!task.remoteId)return;
    const result=await api("/tasks/"+encodeURIComponent(task.remoteId));
    editTask(task.localId,{
      status:clamp(result.status||task.status,40),
      summary:clamp(result.summary||result.message||task.summary,1500),
      prUrl:clamp(result.pr_url||task.prUrl||"",1000),
      previewUrl:clamp(result.preview_url||task.previewUrl||"",1000)
    });
  };
  async function refreshRemote(onlyId){
    if(polling||!state.endpoint)return;
    const targets=state.tasks.filter(t=>t.remoteId&&(!onlyId?t.status!=="draft":t.localId===onlyId)).slice(0,8);
    if(!targets.length){notice="没有可查询的远程任务。";refreshList();return;}
    polling=true;
    let failed=0;
    try{
      const results=await Promise.allSettled(targets.map(refreshOne));
      failed=results.filter(r=>r.status==="rejected").length;
      if(failed)notice="有 "+failed+" 个任务刷新失败，请检查网络或令牌。";
      else if(onlyId)notice="已刷新任务进度。";
    }finally{polling=false;refreshList();}
  }
  async function handleTaskAction(event){
    const button=event.target.closest("[data-da-action]");
    if(!button||busy)return;
    const task=state.tasks.find(t=>t.localId===button.dataset.id);
    if(!task)return;
    const action=button.dataset.daAction;
    if(action==="copy"){
      const text=task.repository+"\n"+task.instruction;
      try{await navigator.clipboard.writeText(text);notice="需求已复制。";}
      catch{notice="当前浏览器无法复制，请长按任务文字。";}
      refreshList();return;
    }
    if(action==="refresh"){await refreshRemote(task.localId);return;}
    if(!state.endpoint){notice="尚未连接执行服务。";refreshList();return;}
    if(action==="approve"&&(!REVIEW.has(task.status)||!task.remoteId))return;
    if(action==="cancel"&&(!RUNNING.has(task.status)&&!REVIEW.has(task.status)))return;
    if(action==="approve"&&!confirm("确认让云端服务应用这个任务的变更？请先检查服务端生成的差异或 PR。"))return;
    busy=true;
    try{
      if(action==="submit"){await sendTask(task);}
      if(action==="approve"){
        const result=await api("/tasks/"+encodeURIComponent(task.remoteId)+"/approve","POST",{action:"apply"});
        editTask(task.localId,{status:clamp(result.status||"running",40),summary:clamp(result.summary||"已授权应用，等待服务返回。",1500)});
        notice="确认指令已发送。";
      }
      if(action==="cancel"){
        const result=await api("/tasks/"+encodeURIComponent(task.remoteId)+"/cancel","POST",{});
        editTask(task.localId,{status:clamp(result.status||"cancelled",40),summary:clamp(result.summary||"已请求取消。",1500)});
        notice="取消请求已发送。";
      }
    }catch(error){notice="操作失败："+error.message;}
    finally{busy=false;refreshList();}
  }
  const previousOpenPanel=openPanel;
  openPanel=function(type){
    if(type==="assistant"){window.xyEnsureOverlayHistory?.();render();return;}
    return previousOpenPanel(type);
  };
  // 只在用户打开助手、页面可见时查询。关闭面板后不继续轮询。
  setInterval(()=>{
    if(document.visibilityState!=="visible"||!currentPanel()||!state.endpoint)return;
    if(state.tasks.some(t=>t.remoteId&&RUNNING.has(t.status)))void refreshRemote();
  },12000);
  window.xyDevAssistant={open:render,connection:()=>({configured:!!state.endpoint,taskCount:state.tasks.length})};
})();