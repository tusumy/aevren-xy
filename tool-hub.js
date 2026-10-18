(()=>{
  const tools=[
    {id:"memory",title:"记忆",subtitle:"整理记忆与偏好",symbol:"⌁",group:"日常"},
    {id:"characters",title:"角色",subtitle:"角色资料、用户名字",symbol:"◇",group:"日常"},
    {id:"study",title:"书房",subtitle:"角色卡与故事预设",symbol:"▤",group:"创作"},
    {id:"journal",title:"日记",subtitle:"记录日常，翻阅书架",symbol:"✎",group:"创作"},
    {id:"theme",title:"主题",subtitle:"配色、气泡与外观",symbol:"◐",group:"外观与管理"},
    {id:"data",title:"数据管理",subtitle:"备份、导入与恢复",symbol:"▥",group:"外观与管理"},
    {id:"mcp",title:"MCP 工具",subtitle:"连接服务与查看状态",symbol:"⌘",group:"连接"},
    {id:"settings",title:"模型与设置",subtitle:"接口、模型及参数",symbol:"⚙",group:"连接"}
  ];
  const favKey="xy.toolhub.favorites.v1";
  let currentTab="all";
  let currentSearch="";
  function favorites(){
    try{
      const saved=JSON.parse(localStorage.getItem(favKey));
      return Array.isArray(saved)?saved.filter(id=>tools.some(x=>x.id===id)):["study","memory","mcp"];
    }catch{return ["study","memory","mcp"]}
  }
  function persistFavorites(ids){try{localStorage.setItem(favKey,JSON.stringify(ids))}catch{}}
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
      '<span class="xy-hub-glyph" aria-hidden="true">'+item.symbol+'</span>'+
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
      '<div class="xy-hub-hero"><div class="xy-hub-hero-kicker">YOUR SPACE · YOUR TOOLS</div>'+
      '<h2>把复杂的收起来。<br>想用时，一点就到。</h2>'+
      '<p>聊天留在外面，功能都放在这里。原来的设置和数据不会改变。</p>'+
      '<div class="xy-hub-status"><span class="xy-hub-status-dot" aria-hidden="true"></span><span>当前接口 <strong>'+escapeHtml(state.selected)+'</strong></span></div></div>'+
      '<div class="xy-hub-stats"><div><strong>08</strong><span>个功能入口</span></div><div><strong>'+state.enabled+'</strong><span>已启用 MCP</span></div><div><strong id="xyHubFavCount">0</strong><span>收藏的入口</span></div></div>'+
      '<label class="xy-hub-search"><span aria-hidden="true">⌕</span><input id="xyHubSearch" type="search" autocomplete="off" placeholder="搜索工具、功能…" aria-label="搜索工具"></label>'+
      '<div class="xy-hub-filters" role="group" aria-label="筛选工具">'+
      '<button type="button" data-hub-filter="all">全部</button><button type="button" data-hub-filter="favorite">★ 收藏</button>'+
      '<button type="button" data-hub-filter="日常">日常</button><button type="button" data-hub-filter="创作">创作</button>'+
      '<button type="button" data-hub-filter="外观与管理">管理</button><button type="button" data-hub-filter="连接">连接</button></div>'+
      '<div class="xy-hub-result"><span>找到 <b id="xyHubShowing">8</b> 项</span><span>点星号可收藏</span></div>'+
      '<div id="xyHubSections"></div><div id="xyHubEmpty" class="xy-hub-empty" hidden>没找到这个工具，换个关键词试试。</div>'+
      '<p class="xy-hub-footer">功能入口集中管理 · 各页面保留原来的操作方式</p></div>';
    const root=body.querySelector("#xyToolHub");
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
      if(open)openPanel(open.dataset.open);
    });
    drawCards(root);
    panel.classList.add("open");
    document.querySelector("#scrim")?.classList.add("show");
  }
  const previousOpen=openPanel;
  openPanel=function(type){
    if(type==="toolhub"){window.xyEnsureOverlayHistory?.();return openHub()}
    return previousOpen(type);
  };
})();