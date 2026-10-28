(()=>{
  const tools=[
    {id:"memory",title:"记忆",subtitle:"整理记忆与偏好",symbol:"⌁",group:"日常"},
    {id:"quotes",title:"句子收藏",subtitle:"收藏喜欢的单句，随时翻看",symbol:"♡",group:"日常"},
    {id:"characters",title:"角色",subtitle:"角色资料、用户名字",symbol:"◇",group:"日常"},
    {id:"study",title:"书房",subtitle:"角色卡与故事预设",symbol:"▤",group:"创作"},
    {id:"creation",title:"创作角",subtitle:"独立设定书 · 多条故事线",symbol:"✧",group:"创作"},
    {id:"groupchat",title:"群聊",subtitle:"多选角色 · 共同演绎",symbol:"♧",group:"创作"},
    {id:"journal",title:"日记",subtitle:"记录日常，翻阅书架",symbol:"✎",group:"创作"},
    {id:"imagine",title:"生图",subtitle:"文生图、参考图与作品",symbol:"✦",group:"创作"},
    {id:"theme",title:"主题",subtitle:"配色、气泡与外观",symbol:"◐",group:"外观与管理"},
    {id:"avatar",title:"头像",subtitle:"聊天头像与角色头像",symbol:"◉",group:"外观与管理"},
    {id:"data",title:"数据管理",subtitle:"备份、导入与恢复",symbol:"▥",group:"外观与管理"},
    {id:"mcp",title:"MCP 工具",subtitle:"连接服务与查看状态",symbol:"⌘",group:"连接"},
    {id:"settings",title:"模型与设置",subtitle:"接口、模型及参数",symbol:"⚙",group:"连接"},
    {id:"voice",title:"语音",subtitle:"语音播放与识别设置",symbol:"♪",group:"连接"}
  ];
  // Small hand-drawn outline icon family: neutral, scalable, follows theme color.
  const strokes={
    memory:'<circle cx="12" cy="12" r="3.5"/><circle cx="5" cy="6" r="1.5"/><circle cx="19" cy="6" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/><path d="M7 7.4 9.5 10M17 7.4 14.5 10M7 17.8l2.5-3.4M17 17.8l-2.5-3.4"/>',
    characters:'<path d="M12 2.8c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5 8.5-3.8 8.5-8.5S16.7 2.8 12 2.8Z"/><circle cx="12" cy="9.7" r="3"/><path d="M5.5 18c.9-3 3.4-4.5 6.5-4.5s5.6 1.5 6.5 4.5"/>',
    study:'<path d="M12 20.2c-3.1-2.3-6-3-9.5-2V5c3.8-1.1 6.9-.4 9.5 1.9 2.5-2.3 5.7-3 9.5-1.9v13.2c-3.5-1-6.4-.3-9.5 2Z"/><path d="M12 7v13.2M5.5 9c1.6-.2 2.8 0 4.2.8m-4.2 2.6c1.6-.2 2.8 0 4.2.8m4.6-3.4c1.4-.8 2.7-1 4.2-.8"/>',
    journal:'<path d="M7 3.3h9l3 3V20H7a2 2 0 0 1-2-2V5.3a2 2 0 0 1 2-2Z"/><path d="M16 3.3v4h3M8 11h7M8 14h6M8 17h4"/><path d="m14.5 20.7 6.2-7.3 1.2 1.3-6.3 7.3-2.4.6Z"/>',
    theme:'<circle cx="12" cy="12" r="4.3"/><path d="M12 2v2.3M12 19.7V22M2 12h2.3M19.7 12H22M4.9 4.9l1.7 1.7m10.8 10.8 1.7 1.7m0-14.2-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    data:'<rect x="6" y="4" width="14" height="16" rx="2"/><path d="M9.5 8h7M9.5 12h7M9.5 16H15M3 8v13h13"/>',
    mcp:'<rect x="3" y="3" width="6" height="6" rx="1.7"/><rect x="15" y="3" width="6" height="6" rx="1.7"/><rect x="9" y="15" width="6" height="6" rx="1.7"/><path d="M9 6h6M6 9v3l4.3 3.5M18 9v3l-4.3 3.5"/>',
    settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.2" fill="var(--xy-hub-icon-fill,#eef5ef)"/><circle cx="16" cy="12" r="2.2" fill="var(--xy-hub-icon-fill,#eef5ef)"/><circle cx="11" cy="18" r="2.2" fill="var(--xy-hub-icon-fill,#eef5ef)"/>',
    voice:'<path d="M10 17V4l10-2v12"/><circle cx="6.5" cy="18" r="3.5"/><circle cx="16.5" cy="15" r="3.5"/><path d="M10 7l10-2"/>',
    imagine:'<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="m5 16 4-4 3.2 3.2 3.6-4 3.7 4.8"/><circle cx="9" cy="8.5" r="1.5"/><path d="M18 1v4M16 3h4"/>',
    avatar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.6 18.3c1-3.3 3.1-4.8 6.4-4.8s5.4 1.5 6.4 4.8"/>'
  };
  function drawnIcon(id){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(strokes[id]||strokes.theme)+'</svg>';
  }
  const favKey="xy.toolhub.favorites.v1";
  let currentTab="all";
  let currentSearch="";
  const expandKey="xy.toolhub.sections.open.v1";
  function readExpanded(){
    try{return localStorage.getItem(expandKey)==="true"}catch{return false}
  }

  function favorites(){
    try{
      const saved=JSON.parse(localStorage.getItem(favKey));
      return Array.isArray(saved)?saved.filter(id=>tools.some(x=>x.id===id)):["study","memory","mcp"];
    }catch{return ["study","memory","mcp"]}
  }
  function persistFavorites(ids){
    try{localStorage.setItem(favKey,JSON.stringify(ids))}catch{}
    renderSidebarFavorites();
  }
  // Sidebar is a live reflection of the very same stars used in Tool Hub.
  // No second shortcut list or separate persistence.
  function renderSidebarFavorites(){
    const host=document.querySelector("#xySidebarFavorites");
    if(!host)return;
    const pinned=favorites().map(id=>tools.find(tool=>tool.id===id)).filter(Boolean);
    const counter=document.querySelector("#xySidebarFavCount");
    if(counter)counter.textContent=String(pinned.length);
    host.innerHTML=pinned.length?pinned.map(item=>
      '<button class="xy-sidebar-fav-link" type="button" data-xy-favorite="'+item.id+'" aria-label="打开'+escapeHtml(item.title)+'">'+
        '<span class="xy-sidebar-fav-icon">'+drawnIcon(item.id)+'</span>'+
        '<span class="xy-sidebar-fav-name">'+escapeHtml(item.title)+'</span>'+
        '<span class="xy-sidebar-fav-arrow" aria-hidden="true">›</span>'+
      '</button>'
    ).join(""):'<div class="xy-sidebar-fav-empty">暂无收藏。去工具中心点星号添加。</div>'+
      '<button type="button" class="xy-sidebar-fav-add" data-xy-open-hub>＋ 添加常用工具</button>';
  }

  const recentKey="xy.toolhub.recent.v1";
  function recentlyUsed(){
    try{
      const value=JSON.parse(localStorage.getItem(recentKey));
      return Array.isArray(value)?value.filter(id=>tools.some(x=>x.id===id)).slice(0,4):[];
    }catch{return []}
  }
  function noteUsed(id){
    if(!tools.some(x=>x.id===id))return;
    try{
      const rest=recentlyUsed().filter(x=>x!==id);
      localStorage.setItem(recentKey,JSON.stringify([id,...rest].slice(0,4)));
    }catch{}
  }
  function renderRecent(root){
    const section=root.querySelector("#xyHubRecent");
    if(!section)return;
    const recents=recentlyUsed().map(id=>tools.find(x=>x.id===id)).filter(Boolean);
    section.hidden=!recents.length;
    const host=section.querySelector("#xyHubRecentLinks");
    host.innerHTML=recents.map(x=>
      '<button type="button" class="xy-hub-recent-link" data-open="'+x.id+'" aria-label="打开最近使用的'+escapeHtml(x.title)+'">'+
      '<span class="xy-hub-recent-icon">'+drawnIcon(x.id)+'</span>'+
      '<span>'+escapeHtml(x.title)+'</span></button>'
    ).join("");
  }
  const groups=["日常","创作","外观与管理","连接"];
  function status(){
    const e=typeof endpoints!=="undefined"&&Array.isArray(endpoints)?endpoints:[];
    const m=typeof mcps!=="undefined"&&Array.isArray(mcps)?mcps:[];
    const ready=e.find(x=>x.active);
    const selected=ready?.name||"未选择模型";
    const enabled=m.filter(x=>x.enabled).length;
    return {selected,enabled,total:m.length};
  }
  function escapeHtml(raw){
    return String(raw??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
  }
  function itemHtml(item,favs){
    const pinned=favs.includes(item.id);
    return '<div class="xy-hub-card" data-id="'+item.id+'" data-group="'+item.group+'">'+
      '<button type="button" class="xy-hub-open" data-open="'+item.id+'" aria-label="打开'+item.title+'">'+
      '<span class="xy-hub-glyph" aria-hidden="true">'+drawnIcon(item.id)+'</span>'+
      '<span class="xy-hub-copy"><strong>'+item.title+'</strong><small>'+item.subtitle+'</small></span>'+
      '<span class="xy-hub-arrow" aria-hidden="true">↗</span></button>'+
      '<button type="button" class="xy-hub-pin'+(pinned?' is-pinned':'')+'" data-pin="'+item.id+'" aria-pressed="'+pinned+'" aria-label="'+(pinned?'取消':'添加')+'收藏：'+item.title+'" title="收藏快捷入口">'+(pinned?'★':'☆')+'</button></div>';
  }
  function drawCards(root){
    const favs=favorites();
    const groupsHtml=groups.map(group=>{
      const sorted=tools.filter(x=>x.group===group).sort((a,b)=>Number(favs.includes(b.id))-Number(favs.includes(a.id)));
      return '<section class="xy-hub-group" data-hub-group="'+group+'"><h3>'+group+'</h3><div class="xy-hub-grid">'+sorted.map(x=>itemHtml(x,favs)).join('')+'</div></section>';
    }).join('');
    root.querySelector("#xyHubSections").innerHTML=groupsHtml;
    root.querySelector("#xyHubFavCount").textContent=favs.length;
    updateFilter(root);
  }
  function updateFilter(root){
    const q=currentSearch.trim().toLocaleLowerCase();
    const favs=favorites();
    let shown=0;
    root.querySelectorAll(".xy-hub-card").forEach(card=>{
      const item=tools.find(x=>x.id===card.dataset.id);
      const passTab=currentTab==="all"||(currentTab==="favorite"?favs.includes(item.id):item.group===currentTab);
      const passText=!q||(item.title+" "+item.subtitle+" "+item.group).toLocaleLowerCase().includes(q);
      card.hidden=!(passTab&&passText);
      if(!card.hidden)shown++;
    });
    root.querySelectorAll(".xy-hub-group").forEach(section=>{
      section.hidden=!section.querySelector(".xy-hub-card:not([hidden])");
    });
    root.querySelectorAll("[data-hub-filter]").forEach(tab=>{
      const active=tab.dataset.hubFilter===currentTab;
      tab.classList.toggle("is-active",active);
      tab.setAttribute("aria-pressed",String(active));
    });
    root.querySelector("#xyHubEmpty").hidden=shown!==0;
    root.querySelector("#xyHubShowing").textContent=String(shown);
  }
  function openHub(){
    const sidebar=document.querySelector("#sidebar");
    const panel=document.querySelector("#panel");
    const body=document.querySelector("#panelBody");
    if(!panel||!body)return;
    sidebar?.classList.remove("open");
    document.querySelector("#panelEyebrow").textContent="AEVREN · TOOLS";
    document.querySelector("#panelTitle").textContent="工具中心";
    const state=status();
    body.innerHTML='<div id="xyToolHub">'+
      '<section class="xy-hub-hero" aria-label="工具中心介绍">'+
        '<div class="xy-hub-intro"><div class="xy-hub-hero-kicker">YOUR SPACE · YOUR TOOLS</div>'+
        '<h2>把复杂的收起来。<br>想用时，一点就到。</h2>'+
        '<p>聊天留在外面，功能都放在这里。原来的设置和数据不会改变。</p>'+
        '<div class="xy-hub-status"><span class="xy-hub-status-dot" aria-hidden="true"></span><span>当前接口 <strong>'+escapeHtml(state.selected)+'</strong></span></div></div>'+
        '<span class="xy-hub-island-art" aria-hidden="true"></span></section>'+
      '<details class="xy-hub-sections" id="xyHubSectionsDisclosure" '+(readExpanded()?'open':'')+'>'+
      '<summary><span><strong>工具与收藏</strong><small>'+tools.length+' 个功能 · 点开查看</small></span><span class="xy-hub-sections-chevron" aria-hidden="true">⌄</span></summary>'+
      '<div class="xy-hub-sections-body">'+
      '<div class="xy-hub-stats"><div><strong>'+String(tools.length).padStart(2,"0")+'</strong><span>个功能入口</span></div><div><strong>'+state.enabled+'</strong><span>已启用 MCP</span></div><div><strong id="xyHubFavCount">0</strong><span>收藏的入口</span></div></div>'+
      '<section class="xy-hub-recent" id="xyHubRecent" hidden><h3>最近打开</h3><div id="xyHubRecentLinks" class="xy-hub-recent-links"></div></section>'+ 
      '<label class="xy-hub-search"><span aria-hidden="true">⌕</span><input id="xyHubSearch" type="search" autocomplete="off" placeholder="搜索工具、功能…" aria-label="搜索工具"></label>'+
      '<div class="xy-hub-filters" role="group" aria-label="筛选工具">'+
      '<button type="button" data-hub-filter="all">全部</button><button type="button" data-hub-filter="favorite">★ 收藏</button>'+
      '<button type="button" data-hub-filter="日常">日常</button><button type="button" data-hub-filter="创作">创作</button>'+
      '<button type="button" data-hub-filter="外观与管理">管理</button><button type="button" data-hub-filter="连接">连接</button></div>'+
      '<div class="xy-hub-result"><span>找到 <b id="xyHubShowing">8</b> 项</span><span>点星号可收藏</span></div>'+
      '<div id="xyHubSections"></div><div id="xyHubEmpty" class="xy-hub-empty" hidden>没找到这个工具，换个关键词试试。</div>'+
      '<p class="xy-hub-footer">功能入口集中管理 · 各页面保留原来的操作方式</p></div></details></div>';
    const root=body.querySelector("#xyToolHub");
    const fold=root.querySelector("#xyHubSectionsDisclosure");
    fold?.addEventListener("toggle",()=>{
      try{localStorage.setItem(expandKey,String(fold.open))}catch{}
    });
    root.querySelector("#xyHubSearch").value=currentSearch;
    root.addEventListener("input",e=>{
      if(e.target.id==="xyHubSearch"){currentSearch=e.target.value;updateFilter(root)}
    });
    root.addEventListener("click",e=>{
      const pin=e.target.closest("[data-pin]");
      if(pin){
        const id=pin.dataset.pin;
        const favs=favorites();
        persistFavorites(favs.includes(id)?favs.filter(x=>x!==id):[...favs,id]);
        drawCards(root);
        return;
      }
      const tab=e.target.closest("[data-hub-filter]");
      if(tab){currentTab=tab.dataset.hubFilter;updateFilter(root);return}
      const open=e.target.closest("[data-open]");
      if(open){
        // Keep the hub as this tool's parent in both toolbar and Android Back.
        window.xyPanelNavigation?.enterFromHub?.();
        openPanel(open.dataset.open);
      }
    });
    drawCards(root);
    renderRecent(root);
    panel.classList.add("open");
    document.querySelector("#scrim")?.classList.add("show");
  }
  const previousOpen=openPanel;
  openPanel=function(type){
    if(type==="toolhub"){window.xyEnsureOverlayHistory?.();return openHub()}
    if(type==="voice"){
      noteUsed("voice");
      return window.xyOpenVoicePanel?.();
    }
    if(type==="imagine"){
      noteUsed("imagine");
      window.xyEnsureOverlayHistory?.();
      return window.xyImageStudio?.open?.();
    }
    const result=previousOpen(type);
    noteUsed(type);
    return result;
  };
  const shortcutHost=document.querySelector("#xySidebarFavorites");
  const favoriteToggle=document.querySelector("#xySidebarFavToggle");
  const favoriteExpandKey="xy.sidebar.favorites.expanded.v1";
  function setSidebarFavoritesOpen(open){
    if(shortcutHost)shortcutHost.hidden=!open;
    if(favoriteToggle){
      favoriteToggle.classList.toggle("is-open",open);
      favoriteToggle.setAttribute("aria-expanded",String(open));
    }
    try{localStorage.setItem(favoriteExpandKey,String(open))}catch{}
  }
  if(favoriteToggle){
    let initial=false;
    try{initial=localStorage.getItem(favoriteExpandKey)==="true"}catch{}
    setSidebarFavoritesOpen(initial);
    favoriteToggle.addEventListener("click",()=>setSidebarFavoritesOpen(favoriteToggle.getAttribute("aria-expanded")!=="true"));
  }
  shortcutHost?.addEventListener("click",e=>{
    const open=e.target.closest("[data-xy-favorite]");
    if(open){openPanel(open.dataset.xyFavorite);return}
    if(e.target.closest("[data-xy-open-hub]"))openPanel("toolhub");
  });
  window.addEventListener("storage",e=>{if(e.key===favKey)renderSidebarFavorites()});
  renderSidebarFavorites();
  // Voice settings now live in Tool Hub and may be starred like other tools.
  // The old injected sidebar button would otherwise be a duplicate.
  document.querySelector(".sidebar-bottom > [data-panel='voice']")?.remove();
  // Avatar also belongs in the same searchable tool shelf, not as a stray item.
  document.querySelector(".sidebar-bottom > [data-panel='avatar']")?.remove();
})();