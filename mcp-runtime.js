(()=>{
  const validated=new Set();
  let seq=0;

  const parsePayload=(raw,contentType)=>{
    const text=String(raw||"").trim();
    if(!text)return null;
    if(String(contentType||"").includes("text/event-stream")||/^event:|^data:/m.test(text)){
      const items=[];
      for(const line of text.split(/\r?\n/)){
        const s=line.trim();
        if(!s.startsWith("data:"))continue;
        const body=s.slice(5).trim();
        if(!body||body==="[DONE]")continue;
        try{items.push(JSON.parse(body))}catch{}
      }
      return items.reverse().find(x=>x?.result||x?.error||x?.id!=null)||items[0]||null;
    }
    return JSON.parse(text);
  };

  async function request(server,method,params={},opts={}){
    const headers={"Content-Type":"application/json",Accept:"application/json, text/event-stream"};
    if(server.token)headers.Authorization="Bearer "+server.token;
    if(server.session)headers["Mcp-Session-Id"]=server.session;
    const body={jsonrpc:"2.0",method};
    if(!opts.notification)body.id=++seq;
    if(params&&Object.keys(params).length)body.params=params;
    const res=await fetch(server.url,{method:"POST",headers,body:JSON.stringify(body)});
    const sid=res.headers.get("Mcp-Session-Id");
    if(sid)server.session=sid;
    const raw=await res.text();
    if(!res.ok)throw new Error("HTTP "+res.status+(raw?" · "+raw.slice(0,180):""));
    if(opts.notification)return null;
    let data;
    try{data=parsePayload(raw,res.headers.get("content-type")||"")}catch{throw new Error("MCP 返回无法解析")}
    if(data?.error)throw new Error(data.error.message||"MCP error");
    return data?.result??data;
  }

  async function connectServer(server,force=false){
    if(!server?.enabled||!server?.url)return [];
    const key=String(server.id||server.url);
    if(!force&&validated.has(key)&&Array.isArray(server.tools)&&server.tools.length)return server.tools;
    server.status="连接中…";
    try{
      let init;
      try{
        init=await request(server,"initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"Aevren XY",version:"0.1.0"}});
      }catch(first){
        server.session="";
        init=await request(server,"initialize",{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"Aevren XY",version:"0.1.0"}});
      }
      try{await request(server,"notifications/initialized",{}, {notification:true})}catch{}
      const listed=await request(server,"tools/list",{});
      server.tools=Array.isArray(listed?.tools)?listed.tools:[];
      server.status="已连接 · "+server.tools.length+" 个工具";
      validated.add(key);
      try{save()}catch{}
      return server.tools;
    }catch(error){
      server.status="失败："+String(error?.message||error);
      validated.delete(key);
      try{save()}catch{}
      return Array.isArray(server.tools)?server.tools:[];
    }
  }

  async function ensure(force=false){
    const list=(Array.isArray(mcps)?mcps:[]).filter(x=>x?.enabled&&x?.url);
    await Promise.all(list.map(x=>connectServer(x,force)));
    return buildTools();
  }

  function buildTools(){
    const out=[],map={};
    (Array.isArray(mcps)?mcps:[]).forEach((server,si)=>{
      if(!server?.enabled||!Array.isArray(server.tools)||!server.tools.length)return;
      server.tools.forEach(t=>{
        if(!t?.name)return;
        const name=("mcp_"+si+"_"+t.name).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,64);
        out.push({type:"function",function:{
          name,
          description:String(t.description||server.name+" MCP tool").slice(0,1000),
          parameters:t.inputSchema||t.input_schema||{type:"object",properties:{}}
        }});
        map[name]={server,tool:t.name};
      });
    });
    window.xyMcpState={
      serverCount:(Array.isArray(mcps)?mcps:[]).filter(x=>x?.enabled).length,
      toolCount:out.length,
      updatedAt:Date.now()
    };
    return {out,map};
  }

  mcpTools=function(){return buildTools()};

  callMcpTool=async function(server,tool,args){
    try{
      return await request(server,"tools/call",{name:tool,arguments:args||{}});
    }catch(error){
      const msg=String(error?.message||error);
      if(/session|HTTP (400|404|409|410)|not initialized|initialize/i.test(msg)){
        await connectServer(server,true);
        return await request(server,"tools/call",{name:tool,arguments:args||{}});
      }
      throw error;
    }
  };

  function decoratePanel(){
    const body=document.querySelector("#panelBody");
    if(!body||document.querySelector("#xyMcpRuntimeStatus"))return;
    const state=buildTools();
    const enabled=(Array.isArray(mcps)?mcps:[]).filter(x=>x?.enabled).length;
    const note=document.createElement("div");
    note.id="xyMcpRuntimeStatus";
    note.className="setting-card";
    note.innerHTML="<strong style='display:block;font-size:12px;margin-bottom:5px'>聊天工具状态</strong><p class='setting-note' style='margin:0 0 9px'>已启用 "+enabled+" 个 MCP · 当前向模型暴露 "+state.out.length+" 个工具</p><button type='button' class='panel-action' id='xyRefreshMcpTools'>重新发现工具</button>";
    body.prepend(note);
    note.querySelector("#xyRefreshMcpTools")?.addEventListener("click",async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent="正在连接…";
      await ensure(true);
      openPanel("mcp");
    });
  }

  const previousOpenPanel=openPanel;
  openPanel=function(type){
    const r=previousOpenPanel(type);
    if(type==="mcp"){
      requestAnimationFrame(async()=>{
        decoratePanel();
        const needs=(Array.isArray(mcps)?mcps:[]).some(x=>x?.enabled&&x?.url&&!validated.has(String(x.id||x.url)));
        if(needs){
          await ensure(false);
          const panel=document.querySelector("#panel");
          if(panel?.classList.contains("open")){
            previousOpenPanel("mcp");
            requestAnimationFrame(decoratePanel);
          }
        }
      });
    }
    return r;
  };

  window.xyEnsureMcpTools=ensure;
  window.xyConnectMcpServer=connectServer;
  window.xyMcpTools=buildTools;
})();