(()=>{
  "use strict";
  const CFG_KEY="xy.supabase.config", SESSION_KEY="xy.supabase.session";
  const SQL=String.raw`create table if not exists public.xy_cloud_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text not null default '手动备份',
  message_count integer not null default 0 check (message_count >= 0),
  meaningful_count integer not null default 0 check (meaningful_count >= 0),
  data jsonb not null
);
create index if not exists xy_cloud_backups_user_created_idx on public.xy_cloud_backups(user_id,created_at desc);
alter table public.xy_cloud_backups enable row level security;
revoke all on table public.xy_cloud_backups from anon,authenticated;
grant select,insert on table public.xy_cloud_backups to authenticated;
drop policy if exists "xy_cloud_backups_read_own" on public.xy_cloud_backups;
create policy "xy_cloud_backups_read_own" on public.xy_cloud_backups for select to authenticated
using ((select auth.uid())=user_id);
drop policy if exists "xy_cloud_backups_insert_own" on public.xy_cloud_backups;
create policy "xy_cloud_backups_insert_own" on public.xy_cloud_backups for insert to authenticated
with check ((select auth.uid())=user_id);`;
  const $=s=>document.querySelector(s);
  const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const read=(store,key)=>{try{return JSON.parse(store.getItem(key)||"null")}catch{return null}};
  const config=()=>read(localStorage,CFG_KEY)||{};
  const session=()=>read(sessionStorage,SESSION_KEY)||null;
  const saveSession=v=>v?sessionStorage.setItem(SESSION_KEY,JSON.stringify(v)):sessionStorage.removeItem(SESSION_KEY);
  const show=(message,error=false)=>{
    const el=$("#xySbStatus");if(!el)return;
    el.textContent=message;el.dataset.error=error?"1":"0";
  };
  function validateConfig(url,key){
    const input=String(url||"").trim(),k=String(key||"").trim();
    let parsed;
    try{parsed=new URL(input)}catch{throw Error("Project URL 格式不正确")}
    if(parsed.protocol!=="https:"||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=="/")
      throw Error("请填写完整的 https://项目ID.supabase.co 地址，不要带路径或参数");
    if(!k)throw Error("请填写 Publishable Key");
    if(/^sb_secret_/i.test(k))throw Error("不能使用 Secret Key。请从 Supabase 复制 Publishable Key");
    if(k.startsWith("sb_publishable_"))return {url:parsed.origin,key:k};
    if(k.split(".").length===3){
      try{
        const base64=k.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
        const payload=JSON.parse(atob(base64));
        if(payload.role==="anon")return {url:parsed.origin,key:k};
      }catch{}
      throw Error("JWT 密钥不是 anon 角色。不能使用 service_role");
    }
    throw Error("请填写 sb_publishable_ 开头的 Key（或旧版 anon Key）");
  }
  function saveConfig(){
    const value=validateConfig($("#xySbUrl")?.value,$("#xySbKey")?.value);
    const prior=config();
    if(prior.url!==value.url||prior.key!==value.key)saveSession(null);
    localStorage.setItem(CFG_KEY,JSON.stringify(value));
    show("项目配置已保存在当前 APK 的本地存储，不会上传到 GitHub。");
    updateLoginState();
    return value;
  }
  function ensureConfig(){
    const cfg=config();
    if(!cfg.url||!cfg.key)throw Error("请先保存 Project URL 和 Publishable Key");
    return validateConfig(cfg.url,cfg.key);
  }
  function headers(cfg,token){
    const h={"apikey":cfg.key,"Content-Type":"application/json","Accept":"application/json"};
    if(token)h.Authorization="Bearer "+token;
    return h;
  }
  async function request(path,method="GET",body=null,token=null,extra={}){
    const cfg=ensureConfig();
    let res;
    try{
      res=await fetch(cfg.url+path,{method,headers:{...headers(cfg,token),...extra},...(body!==null?{body:JSON.stringify(body)}:{})});
    }catch(err){throw Error("连接不到 Supabase："+(err.message||"网络错误"))}
    const raw=await res.text();let data=null;
    try{data=raw?JSON.parse(raw):null}catch{data=raw}
    if(!res.ok){
      let message=String(data?.msg||data?.error_description||data?.message||data?.error||raw||"请求失败");
      if(res.status===404||message.includes("PGRST205")||message.includes("Could not find the table"))
        message="找不到 xy_cloud_backups 表。请先在 Supabase SQL Editor 运行下方建表 SQL。";
      if(res.status===401||res.status===403)message+="（检查登录状态、项目密钥和 RLS 权限）";
      throw Error(message+" [HTTP "+res.status+"]");
    }
    return data;
  }
  function persistAuth(data,old){
    if(!data?.access_token)throw Error("登录响应中没有 access_token");
    const user=data.user||old?.user||null;
    if(!user?.id)throw Error("登录响应缺少用户 ID");
    const out={
      access_token:data.access_token,
      refresh_token:data.refresh_token||old?.refresh_token||"",
      expires_at:Date.now()+Number(data.expires_in||3600)*1000,
      user:{id:user.id,email:user.email||old?.user?.email||""}
    };
    saveSession(out);return out;
  }
  async function activeSession(){
    const s=session();
    if(!s?.access_token||!s?.user?.id)throw Error("请先登录 Supabase 账号");
    if(Date.now()<Number(s.expires_at||0)-60000)return s;
    if(!s.refresh_token){saveSession(null);throw Error("登录已过期，请重新登录")}
    try{
      const data=await request("/auth/v1/token?grant_type=refresh_token","POST",{refresh_token:s.refresh_token});
      return persistAuth(data,s);
    }catch(err){saveSession(null);updateLoginState();throw Error("登录已过期："+err.message)}
  }
  function updateLoginState(){
    const el=$("#xySbWho");if(!el)return;
    const s=session();
    el.textContent=s?.user?.email?"已登录："+s.user.email:"尚未登录云端账号（密码不会保存在本机）";
    $("#xySbLogout").disabled=!s;
    $("#xySbUpload").disabled=!s;
    $("#xySbList").disabled=!s;
  }
  function busy(btn,run){
    if(!btn||btn.disabled)return;
    btn.disabled=true;const orig=btn.textContent;btn.textContent="正在处理…";
    Promise.resolve().then(run).catch(err=>show(err?.message||String(err),true)).finally(()=>{
      btn.textContent=orig;
      if(btn.id==="xySbUpload"||btn.id==="xySbList"||btn.id==="xySbLogout")updateLoginState();
      else btn.disabled=false;
    });
  }
  async function authenticate(kind){
    const cfg=saveConfig();if(!cfg) return;
    const email=String($("#xySbEmail").value||"").trim(),password=$("#xySbPassword").value;
    if(!email.includes("@")||!password)throw Error("请输入邮箱和密码");
    if(kind==="signup"&&password.length<6)throw Error("密码至少 6 位");
    const target=kind==="signup"?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
    const data=await request(target,"POST",{email,password});
    $("#xySbPassword").value="";
    if(!data?.access_token){
      if(kind==="signup"){show("注册请求已提交。若 Supabase 开启邮箱验证，请先查收邮件，再返回砚屿登录。");return}
      throw Error("登录未获得会话，请检查邮箱验证状态");
    }
    persistAuth(data);
    show("登录成功。接下来可以建立云端备份或查看历史版本。");
    updateLoginState();
    await listVersions();
  }
  async function testConnection(){
    saveConfig();
    const health=await request("/auth/v1/health");
    show("Supabase 项目已连通："+String(health?.version||health?.name||"服务响应正常")+"。登录后可检查数据表。");
  }
  async function upload(){
    const s=await activeSession();
    const mgr=window.xyDataManager;
    if(!mgr?.exportValues||!mgr?.statsOf)throw Error("本机数据管理尚未加载");
    const values=mgr.exportValues(),count=mgr.statsOf(values);
    if(count.messages>0&&(count.meaningful===0||(count.messages>=10&&count.meaningful<count.messages/3)))
      throw Error("已拦截上传：当前聊天正文大量为空（"+count.meaningful+"/"+count.messages+"）。先不要把损坏状态存进云端。");
    if(!count.meaningful&&!count.memories&&!count.journals)throw Error("本地没有值得备份的内容");
    const pack={format:"AevrenXYBackup",version:1,exportedAt:new Date().toISOString(),values};
    if(new Blob([JSON.stringify(pack)]).size>7*1024*1024)throw Error("数据超过 7 MB，当前云端备份暂不支持，请先使用本地导出");
    if(!window.confirm("新建一份云端历史备份？\n"+count.chats+" 个对话，"+count.meaningful+" 条有正文的消息。不会删除旧版本。"))return;
    await request("/rest/v1/xy_cloud_backups","POST",{
      user_id:s.user.id,label:"砚屿手动备份",message_count:count.messages,
      meaningful_count:count.meaningful,data:pack
    },s.access_token,{"Prefer":"return=minimal"});
    show("云端备份已新增，旧备份没有被覆盖。");
    await listVersions();
  }
  async function restoreVersion(id){
    const s=await activeSession();
    const rows=await request("/rest/v1/xy_cloud_backups?id=eq."+encodeURIComponent(id)+"&select=data,created_at&limit=1","GET",null,s.access_token);
    const item=Array.isArray(rows)?rows[0]:null;
    if(!item?.data?.values||item.data.format!=="AevrenXYBackup")throw Error("这份云端备份格式无法识别");
    const mgr=window.xyDataManager;
    if(!mgr?.restoreValues)throw Error("本机恢复功能尚未准备好");
    await mgr.restoreValues(item.data.values,"merge","Supabase 云端备份 "+item.created_at);
  }
  async function listVersions(){
    const el=$("#xySbVersions");if(!el)return;
    const s=await activeSession();
    const rows=await request("/rest/v1/xy_cloud_backups?select=id,created_at,label,message_count,meaningful_count&order=created_at.desc&limit=20","GET",null,s.access_token);
    el.replaceChildren();
    if(!Array.isArray(rows)||!rows.length){el.textContent="还没有云端备份。";show("已连接，备份数据表正常。");return}
    for(const item of rows){
      const row=document.createElement("div");row.className="xy-sb-version";
      const info=document.createElement("div");
      const heading=document.createElement("strong");heading.textContent=new Date(item.created_at).toLocaleString("zh-CN");
      const sub=document.createElement("small");sub.textContent=String(item.message_count)+" 条消息 · "+String(item.meaningful_count)+" 条有正文";
      info.append(heading,sub);
      const btn=document.createElement("button");btn.textContent="合并恢复";btn.type="button";
      btn.addEventListener("click",()=>busy(btn,()=>restoreVersion(item.id)));
      row.append(info,btn);el.append(row);
    }
    show("云端备份列表已更新，共读取 "+rows.length+" 个版本。");
  }
  async function copySql(){
    let ok=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(SQL);ok=true}}catch{}
    if(!ok){
      const ta=$("#xySbSqlText");ta.hidden=false;ta.value=SQL;ta.focus();ta.select();
      try{ok=document.execCommand("copy")}catch{}
    }
    show(ok?"建表 SQL 已复制。请到 Supabase SQL Editor 粘贴并运行。":"SQL 已展开，请长按全选复制。",!ok);
  }
  function render(){
    const body=$("#panelBody");if(!body)return;
    const cfg=config(),s=session();
    const area=document.createElement("section");area.className="xy-data-section xy-sb-section";area.id="xySupabasePanel";
    area.innerHTML=
      '<h3>Supabase 云端备份</h3>'+
      '<p>项目配置只保存在这个 APK 的本机。先填写 Supabase Dashboard → Project Settings → API Keys 中的 Project URL 与 Publishable Key。<b>不要填 Secret / service_role Key。</b></p>'+
      '<label>Project URL<input id="xySbUrl" type="url" spellcheck="false" autocomplete="off" placeholder="https://xxxxxxxx.supabase.co" value="'+e(cfg.url||"")+'"></label>'+
      '<label>Publishable Key<input id="xySbKey" type="password" spellcheck="false" autocomplete="off" placeholder="sb_publishable_..." value="'+e(cfg.key||"")+'"></label>'+
      '<div class="xy-sb-actions"><button id="xySbSave" type="button">保存配置</button><button id="xySbTest" type="button">测试连接</button></div>'+
      '<div class="xy-sb-setup"><p>首次使用：在 Supabase 的 SQL Editor 运行一次建表脚本，然后用邮箱注册或登录。备份按用户隔离，旧版本不会自动覆盖。</p>'+
      '<button id="xySbCopySql" type="button">复制建表 SQL</button>'+
      '<textarea id="xySbSqlText" hidden readonly rows="6" aria-label="Supabase 建表 SQL"></textarea></div>'+
      '<label>账号邮箱<input id="xySbEmail" type="email" autocomplete="username" placeholder="your@email.com" value="'+e(s?.user?.email||"")+'"></label>'+
      '<label>登录密码<input id="xySbPassword" type="password" autocomplete="current-password" placeholder="至少 6 位，密码不会保存"></label>'+
      '<div class="xy-sb-actions"><button id="xySbSignup" type="button">注册</button><button id="xySbLogin" type="button">登录</button><button id="xySbLogout" type="button">退出</button></div>'+
      '<p id="xySbWho" class="xy-sb-who"></p>'+
      '<div class="xy-sb-actions"><button id="xySbUpload" type="button">上传新备份</button><button id="xySbList" type="button">查看云端版本</button></div>'+
      '<div class="xy-sb-versions" id="xySbVersions"></div>'+
      '<p id="xySbStatus" role="status" class="xy-sb-status"></p>';
    const status=body.querySelector("#xyDataStatus");
    if(status)body.insertBefore(area,status);else body.append(area);
    updateLoginState();
    const bind=(id,fn)=>{$("#"+id).addEventListener("click",ev=>busy(ev.currentTarget,fn))};
    bind("xySbSave",async()=>{saveConfig()});
    bind("xySbTest",testConnection);
    bind("xySbSignup",()=>authenticate("signup"));
    bind("xySbLogin",()=>authenticate("login"));
    bind("xySbLogout",async()=>{saveSession(null);updateLoginState();$("#xySbVersions").replaceChildren();show("已退出云端账号。")});
    bind("xySbUpload",upload);
    bind("xySbList",listVersions);
    bind("xySbCopySql",copySql);
  }
  const priorOpenPanel=openPanel;
  openPanel=function(type){
    const r=priorOpenPanel(type);
    if(type==="data")render();
    return r;
  };
  window.xySupabase={validateConfig,config};
})();