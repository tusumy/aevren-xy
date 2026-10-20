(()=>{
  "use strict";
  // Client-side model hub. Never stores prompts or API keys in its statistics.
  const FAV_KEY="xy.apiHub.favorites.v1", ORDER_KEY="xy.apiHub.routes.v1", LOG_KEY="xy.apiHub.stats.v1";
  const get=(key,fallback)=>{try{return store.get(key,fallback)}catch{return fallback}};
  const put=(key,value)=>{try{store.set(key,value)}catch{}};
  const escText=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const keyOf=value=>String(value||"").trim().toLowerCase();
  const active=()=>endpoints.find(x=>x.active)||endpoints[0]||null;
  const modelsFor=ep=>[...new Set([ep.model,...(Array.isArray(ep.models)?ep.models:[])].map(x=>String(x||"").trim()).filter(Boolean))];
  const viable=ep=>!!(ep?.id&&ep.base&&ep.key!==undefined);
  const favorites=()=>get(FAV_KEY,[]);
  const ordering=()=>get(ORDER_KEY,{});
  const stats=()=>get(LOG_KEY,[]);

  function groups(){
    const map=new Map();
    for(const ep of endpoints){
      if(!ep.base)continue;
      for(const model of modelsFor(ep)){
        const id=keyOf(model);
        if(!id)continue;
        if(!map.has(id))map.set(id,{id,name:model,candidates:[]});
        map.get(id).candidates.push({endpoint:ep,model});
      }
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"zh-CN"));
  }
  function orderedCandidates(group,primaryId){
    const rank=ordering()[group.id]||[];
    return group.candidates.slice().sort((a,b)=>{
      if(a.endpoint.id===primaryId)return -1;
      if(b.endpoint.id===primaryId)return 1;
      const ia=rank.indexOf(a.endpoint.id),ib=rank.indexOf(b.endpoint.id);
      return (ia<0?9999:ia)-(ib<0?9999:ib);
    });
  }
  function selected(){
    const c=chat();
    const choice=c?.xyApiChoice;
    if(choice?.endpointId&&choice?.model){
      const ep=endpoints.find(x=>x.id===choice.endpointId&&x.base);
      if(ep)return {endpoint:ep,model:choice.model};
    }
    const ep=active();
    return ep?{endpoint:ep,model:ep.model}:null;
  }
  function resolveEndpoint(c){
    const choice=c?.xyApiChoice;
    const ep=choice?.endpointId?endpoints.find(x=>x.id===choice.endpointId&&x.base):null;
    if(ep&&choice.model)return {...ep,model:choice.model};
    return active();
  }
  function selectModel(endpointId,model){
    const ep=endpoints.find(x=>x.id===endpointId);
    if(!ep||!modelsFor(ep).some(x=>keyOf(x)===keyOf(model)))return;
    const c=chat();if(!c)return;
    c.xyApiChoice={endpointId,model};
    save();renderHeader();renderUI();
  }
  function renderHeader(){
    const parent=document.querySelector("header .presence");
    if(!parent)return;
    let btn=document.querySelector("#xyModelQuickSwitch");
    if(!btn){
      btn=document.createElement("button");btn.id="xyModelQuickSwitch";
      btn.className="xy-model-quick";btn.type="button";
      btn.setAttribute("aria-label","切换当前对话模型");
      parent.insertAdjacentElement("afterend",btn);
      btn.addEventListener("click",()=>{openPanel("settings");requestAnimationFrame(()=>document.querySelector("#xyApiHubPanel")?.scrollIntoView({block:"start",behavior:"smooth"}))});
    }
    const x=selected();
    btn.textContent=x?.model||"选择模型";
    btn.title=x?.endpoint?x.endpoint.name+" · "+(x.model||"未选择"):"选择模型";
  }
  function record(ep,model,status,elapsed,tokens){
    const logs=stats();
    logs.push({at:Date.now(),endpointId:ep.id,model:String(model),status,elapsed:Math.round(elapsed),tokens:Number(tokens)||0});
    put(LOG_KEY,logs.slice(-400));
  }
  async function sendChat(primary,payload,stickyId){
    const id=keyOf(payload?.model||primary?.model);
    const group=groups().find(x=>x.id===id);
    let routes=group?orderedCandidates(group,stickyId||primary.id):[];
    // A manually typed model is valid even if the catalog is empty.
    if(!routes.some(x=>x.endpoint.id===primary.id))routes.unshift({endpoint:primary,model:payload.model});
    routes=routes.filter((x,i,arr)=>arr.findIndex(y=>y.endpoint.id===x.endpoint.id)===i);
    let lastResponse=null,lastError=null;
    for(let i=0;i<routes.length;i++){
      const {endpoint:ep,model}=routes[i];
      const start=performance.now();
      const headers={"Content-Type":"application/json",Accept:"application/json"};
      if(ep.key)headers.Authorization="Bearer "+ep.key;
      const url=window.AevrenApiCompat.completeChatEndpoint(ep.base);
      try{
        const res=await fetch(url,{method:"POST",headers,body:JSON.stringify({...payload,model})});
        const elapsed=performance.now()-start;
        let tokens=0;
        if(res.ok){try{const d=await res.clone().json();tokens=Number(d?.usage?.total_tokens||0)}catch{}}
        record(ep,model,res.status,elapsed,tokens);
        if(res.ok)return {res,routeId:ep.id};
        lastResponse=res;
        if(![408,429,500,502,503,504].includes(res.status))return {res,routeId:ep.id};
      }catch(error){
        lastError=error;
        record(ep,model,0,performance.now()-start,0);
        // Abort is intentional; do not reroute or duplicate a cancelled request.
        if(error?.name==="AbortError")throw error;
      }
      // Fail over only to the SAME model ID; do not replace models silently.
    }
    if(lastResponse)return {res:lastResponse,routeId:routes[routes.length-1]?.endpoint?.id};
    throw lastError||new Error("所有同名模型渠道均不可用");
  }
  function statsText(epId){
    const today=new Date().toDateString();
    const rows=stats().filter(x=>x.endpointId===epId&&new Date(x.at).toDateString()===today);
    if(!rows.length)return "今日暂无请求";
    const good=rows.filter(x=>x.status>=200&&x.status<300);
    const ms=good.length?Math.round(good.reduce((s,x)=>s+x.elapsed,0)/good.length):0;
    const tokens=rows.reduce((s,x)=>s+x.tokens,0);
    return "今日 "+rows.length+" 次 · 成功 "+good.length+" · 平均 "+ms+"ms · "+tokens+" tokens";
  }
  function routeControls(g){
    if(g.candidates.length<2)return "<small>当前仅有一个提供此模型的渠道。</small>";
    const sorted=orderedCandidates(g,"");
    return sorted.map((c,i)=>'<div class="xy-hub-route"><span>'+escText(c.endpoint.name)+'</span><button type="button" class="xy-hub-order" data-model="'+escText(g.id)+'" data-id="'+escText(c.endpoint.id)+'" data-delta="-1" '+(i===0?"disabled":"")+'>↑</button><button type="button" class="xy-hub-order" data-model="'+escText(g.id)+'" data-id="'+escText(c.endpoint.id)+'" data-delta="1" '+(i===sorted.length-1?"disabled":"")+'>↓</button></div>').join("");
  }
  function renderUI(){
    const root=document.querySelector("#xyApiHubPanel");
    if(!root)return;
    const search=root.querySelector("#xyHubSearch")?.value.toLowerCase().trim()||"";
    const onlyFav=!!root.querySelector("#xyHubOnlyFav")?.checked;
    const chosen=selected(),fav=favorites();
    const all=groups();
    const visible=all.filter(x=>(!search||(x.name+" "+x.candidates.map(c=>c.endpoint.name).join(" ")).toLowerCase().includes(search))&&(!onlyFav||fav.includes(x.id)));
    root.querySelector("#xyHubCount").textContent=visible.length+" / "+all.length+" 个模型";
    root.querySelector("#xyHubModels").innerHTML=visible.map(g=>{
      const sorted=orderedCandidates(g,chosen?.model&&keyOf(chosen.model)===g.id?chosen.endpoint.id:"");
      const primary=sorted[0];
      const isChosen=keyOf(chosen?.model)===g.id&&chosen?.endpoint?.id===primary.endpoint.id;
      const isFav=fav.includes(g.id);
      return '<div class="xy-hub-row '+(isChosen?"is-chosen":"")+'"><button type="button" class="xy-hub-fav" data-fav="'+escText(g.id)+'" aria-label="'+(isFav?"取消收藏":"收藏")+'" title="'+(isFav?"取消收藏":"收藏")+'">'+(isFav?"★":"☆")+'</button><button type="button" class="xy-hub-select" data-ep="'+escText(primary.endpoint.id)+'" data-model="'+escText(primary.model)+'"><strong>'+escText(g.name)+'</strong><small>'+escText(primary.endpoint.name)+(g.candidates.length>1?" · "+g.candidates.length+" 个渠道":"")+'</small></button>'+(isChosen?'<span class="xy-hub-current">当前</span>':'')+(g.candidates.length>1?'<details class="xy-hub-routes"><summary aria-label="调整模型渠道顺序">⌄</summary><div><small>↑↓ 调整备用顺序，点击渠道可直接选用。</small>'+routeControls(g)+sorted.map(c=>'<button type="button" class="xy-hub-direct" data-ep="'+escText(c.endpoint.id)+'" data-model="'+escText(c.model)+'">使用 '+escText(c.endpoint.name)+'</button>').join("")+'</div></details>':'')+'</div>';
    }).join("")||'<p class="xy-hub-empty">没有找到模型。先在下方添加渠道或同步模型。</p>';
    const cards=root.querySelector("#xyHubChannels");
    cards.innerHTML=endpoints.map(ep=>'<div class="xy-hub-channel"><div><strong>'+escText(ep.name)+'</strong><small>'+modelsFor(ep).length+' 个已知模型 · '+statsText(ep.id)+'</small></div><button type="button" data-sync="'+escText(ep.id)+'">同步模型</button></div>').join("");
    renderHeader();
  }
  function inject(){
    const body=document.querySelector("#panelBody");
    if(!body?.querySelector("#endpointList"))return;
    if(body.querySelector("#xyApiHubPanel")){renderUI();return}
    const section=document.createElement("section");section.id="xyApiHubPanel";section.className="xy-api-hub";
    section.innerHTML='<div class="xy-hub-heading"><div><strong>统一模型</strong><small>当前对话独立选择 · 本机直连，无需部署服务</small></div><span id="xyHubCount"></span></div><label class="xy-hub-filter"><input type="search" id="xyHubSearch" placeholder="搜索模型或渠道"><span><input type="checkbox" id="xyHubOnlyFav"> 仅收藏</span></label><div id="xyHubModels" class="xy-hub-models"></div><details class="xy-hub-channel-panel"><summary>渠道模型与今日使用量</summary><div id="xyHubChannels"></div><small id="xyHubSyncStatus" role="status"></small></details><p class="xy-hub-tip">只在多个渠道提供相同模型 ID 时，才自动尝试备用渠道；不会偷偷换成其他模型。旧对话与原 API 配置保留。</p>';
    const list=body.querySelector("#endpointList");
    list.insertAdjacentElement("beforebegin",section);
    section.addEventListener("input",e=>{if(e.target.id==="xyHubSearch")renderUI()});
    section.addEventListener("change",e=>{if(e.target.id==="xyHubOnlyFav")renderUI()});
    section.addEventListener("click",onClick);
    renderUI();
  }
  async function syncModels(ep){
    const status=document.querySelector("#xyHubSyncStatus");
    if(status)status.textContent="正在同步 "+ep.name+"…";
    const header={Accept:"application/json"};if(ep.key)header.Authorization="Bearer "+ep.key;
    let err="";
    for(const url of window.AevrenApiCompat.modelCandidates(ep.base)){
      try{
        const response=await fetch(url,{headers:header});
        if(!response.ok){err="HTTP "+response.status;continue}
        const data=await response.json();
        const list=Array.isArray(data)?data:(data.data||data.models||[]);
        if(!Array.isArray(list))continue;
        const ids=list.map(x=>typeof x==="string"?x:x?.id||String(x?.name||"").replace(/^models\//,"")).map(x=>String(x||"").trim()).filter(Boolean);
        if(!ids.length){err="接口未提供模型列表";continue}
        ep.models=[...new Set([...modelsFor(ep),...ids])];
        save();renderUI();
        if(status)status.textContent=ep.name+" · 已同步 "+ids.length+" 个模型";
        return;
      }catch(e){err=String(e?.message||e)}
    }
    if(status)status.textContent=ep.name+" · 同步失败："+err+"；仍可在下面手动填写 Model";
  }
  function onClick(event){
    const t=event.target.closest("button");if(!t)return;
    if(t.dataset.fav){
      const old=favorites(),k=t.dataset.fav;
      put(FAV_KEY,old.includes(k)?old.filter(x=>x!==k):[...old,k]);renderUI();return;
    }
    if(t.classList.contains("xy-hub-order")){
      const id=t.dataset.model,g=groups().find(x=>x.id===id);if(!g)return;
      const order=ordering();
      const a=orderedCandidates(g,"").map(x=>x.endpoint.id);
      const i=a.indexOf(t.dataset.id),j=i+Number(t.dataset.delta);
      if(i<0||j<0||j>=a.length)return;
      [a[i],a[j]]=[a[j],a[i]];order[id]=a;put(ORDER_KEY,order);renderUI();return;
    }
    if(t.dataset.sync){
      const ep=endpoints.find(x=>x.id===t.dataset.sync);if(ep?.base)syncModels(ep);return;
    }
    if(t.dataset.ep&&t.dataset.model){
      selectModel(t.dataset.ep,t.dataset.model);
    }
  }
  const previousOpen=openPanel;
  openPanel=function(type){
    const result=previousOpen(type);
    if(type==="settings")requestAnimationFrame(inject);
    return result;
  };
  const oldRenderMessages=renderMessages;
  renderMessages=function(){const result=oldRenderMessages();renderHeader();return result};
  window.xyApiHub={resolveEndpoint,sendChat,groups,selected,renderHeader};
  renderHeader();
})();
