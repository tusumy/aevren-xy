(()=>{
  const OPTS_RE=/\n?⟦opts(\{[^⟧]*?\})⟧\s*$/;
  const OPTS_TAIL_RE=/\n?⟦opts[^⟧]*⟧\s*$/;
  const KEY="xy.replyOptions";
  const DEFAULTS={enabled:false,mode:"intimate"};
  const readSettings=()=>{try{return {...DEFAULTS,...(JSON.parse(localStorage.getItem(KEY))||{})}}catch{return {...DEFAULTS}}};
  const writeSettings=value=>localStorage.setItem(KEY,JSON.stringify({...DEFAULTS,...value}));
  const clip=(value,max=30)=>Array.from(String(value||"").trim()).slice(0,max).join("");

  function parseReplyOptions(text){
    const raw=String(text??"");
    const match=raw.match(OPTS_RE);
    if(match){
      const clean=raw.slice(0,match.index).replace(/\s+$/,"");
      try{
        const seen=new Set();
        const items=(JSON.parse(match[1])?.items||[])
          .map(x=>clip(x))
          .filter(x=>x&&!seen.has(x)&&seen.add(x))
          .slice(0,3);
        return {clean,options:items.length>=2?items:null,matched:true};
      }catch{return {clean,options:null,matched:true}}
    }
    const broken=raw.match(OPTS_TAIL_RE);
    if(broken)return {clean:raw.slice(0,broken.index).replace(/\s+$/,""),options:null,matched:true};
    return {clean:raw,options:null,matched:false};
  }

  function activeVariant(m){
    if(!Array.isArray(m?.variants)||!m.variants.length)return -1;
    return Math.min(Math.max(Number(m.activeVariant)||0,0),m.variants.length-1);
  }

  function sanitizeMessage(m){
    if(!m||m.role!=="assistant")return false;
    let changed=false;
    const oldOptions=Array.isArray(m.replyOptions)?[...m.replyOptions]:null;
    const oldSource=String(m.replyOptionsForText||m.text||"");
    const parsed=parseReplyOptions(m.text);

    if(parsed.matched){
      m.text=parsed.clean;
      if(parsed.options){
        m.replyOptions=parsed.options;
        m.replyOptionsForText=parsed.clean;
      }else{
        delete m.replyOptions;
        delete m.replyOptionsForText;
      }
      changed=true;
    }

    if(m.editedAt&&m.replyOptions){
      delete m.replyOptions;
      delete m.replyOptionsForText;
      changed=true;
    }

    if(Array.isArray(m.variants)){
      m.variants.forEach(v=>{
        const pv=parseReplyOptions(v?.text);
        if(pv.matched){
          v.text=pv.clean;
          if(pv.options){
            v.replyOptions=pv.options;
            v.replyOptionsForText=pv.clean;
          }else{
            delete v.replyOptions;
            delete v.replyOptionsForText;
          }
          changed=true;
        }
        if(v?.editedAt&&v.replyOptions){
          delete v.replyOptions;
          delete v.replyOptionsForText;
          changed=true;
        }
        if(!v.replyOptions&&oldOptions&&String(v?.text||"")===oldSource){
          v.replyOptions=[...oldOptions];
          v.replyOptionsForText=oldSource;
          changed=true;
        }
      });

      const ai=activeVariant(m);
      if(ai>=0){
        const v=m.variants[ai];
        if(Array.isArray(v?.replyOptions)&&v.replyOptions.length>=2){
          m.replyOptions=[...v.replyOptions];
          m.replyOptionsForText=String(v.replyOptionsForText||v.text||"");
        }else{
          delete m.replyOptions;
          delete m.replyOptionsForText;
        }
      }
    }
    return changed;
  }

  function expireOldOptions(c){
    const items=Array.isArray(c?.messages)?c.messages:[];
    let changed=false;
    items.forEach((m,index)=>{
      if(m?.role!=="assistant"||index===items.length-1)return;
      if(m.replyOptions){
        delete m.replyOptions;
        delete m.replyOptionsForText;
        changed=true;
      }
      if(Array.isArray(m.variants)){
        m.variants.forEach(v=>{
          if(v?.replyOptions){
            delete v.replyOptions;
            delete v.replyOptionsForText;
            changed=true;
          }
        });
      }
    });
    return changed;
  }

  function sanitizeAll(){
    let changed=false;
    for(const c of Array.isArray(chats)?chats:[]){
      for(const m of Array.isArray(c?.messages)?c.messages:[])if(sanitizeMessage(m))changed=true;
      if(expireOldOptions(c))changed=true;
    }
    return changed;
  }

  const baseSave=save;
  save=function(){
    sanitizeAll();
    return baseSave();
  };

  const intimateTerms=/(亲|亲亲|吻|接吻|抱|搂|贴着|贴紧|蹭|摸|抚|舔|咬|舌|喘|床|脱|衣服|胸|奶|屁股|腰|腿|唧唧|鸡巴|阴蒂|穴|湿|插|射|操|亲密|暧昧|想要|抱紧|压住|骑|进入)/i;
  function intimateScene(){
    const c=typeof chat==="function"?chat():null;
    const recent=(c?.messages||[]).slice(-6).map(m=>String(m?.text||"")).join("\n");
    if(!recent.trim())return false;
    const hits=recent.match(new RegExp(intimateTerms.source,"gi"))||[];
    return hits.length>=2||(/(亲密|暧昧|床|脱|鸡巴|阴蒂|穴|插|射)/i.test(recent)&&hits.length>=1);
  }

  const OPTION_INSTRUCTION=`正文停下之后，另起一行追加一个标记，给她三个可以直接点的下一步：
⟦opts{"items":["…","…","…"]}⟧
- 两条是她会说的话（她的口吻，短，像她平时打字那样），一条是走向（她能做的一个动作或一个转折，用“我”开头）。
- 三条方向要真的不同：一条顺着你，一条别着你，一条拐弯。
- 每条不超过 30 字。全部是她的视角，不是你对她说的话。
- 不解释这个标记，正文里不提它。正文本身不给选项、不问她要什么，选项只在标记里。`;

  const priorFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const cfg=readSettings();
    if(!cfg.enabled||cfg.mode!=="intimate"||!intimateScene()||!init?.body)return priorFetch(input,init);

    let payload;
    try{payload=typeof init.body==="string"?JSON.parse(init.body):null}catch{return priorFetch(input,init)}
    if(!payload||!Array.isArray(payload.messages))return priorFetch(input,init);

    const systemText=payload.messages
      .filter(m=>m?.role==="system")
      .map(m=>String(m.content||""))
      .join("\n");

    if(systemText.includes("⟦opts"))return priorFetch(input,init);

    const messages=payload.messages.map(m=>({...m}));
    const si=messages.findIndex(m=>m?.role==="system");
    if(si>=0)messages[si].content=String(messages[si].content||"").trim()+"\n\n"+OPTION_INSTRUCTION;
    else messages.unshift({role:"system",content:OPTION_INSTRUCTION});

    return priorFetch(input,{...init,body:JSON.stringify({...payload,messages})});
  };

  function clearOptions(m){
    if(!m)return;
    delete m.replyOptions;
    delete m.replyOptionsForText;
    const ai=activeVariant(m);
    if(ai>=0&&m.variants?.[ai]){
      delete m.variants[ai].replyOptions;
      delete m.variants[ai].replyOptionsForText;
    }
  }

  function sendOption(index,text){
    const c=typeof chat==="function"?chat():null;
    const m=c?.messages?.[index];
    const input=document.querySelector("#input");
    if(!m||!input)return;

    clearOptions(m);
    save();
    renderMessages();

    input.value=String(text||"");
    try{resize()}catch{}
    input.dispatchEvent(new Event("input",{bubbles:true}));
    Promise.resolve(send()).catch(()=>{});
  }

  function editOption(text){
    const input=document.querySelector("#input");
    if(!input)return;
    input.value=String(text||"");
    try{resize()}catch{}
    input.dispatchEvent(new Event("input",{bubbles:true}));
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
  }

  let drawing=false,observer=null;
  function renderLatestOptions(){
    if(drawing)return;
    drawing=true;
    observer?.disconnect();
    try{
      const box=document.querySelector("#messages");
      if(!box)return;

      box.querySelectorAll(".xy-reply-options").forEach(x=>x.remove());

      const cfg=readSettings();
      if(!cfg.enabled||sending||box.querySelector(".xy-pending")||box.querySelector("#typing"))return;

      const c=typeof chat==="function"?chat():null;
      const items=c?.messages||[];
      const index=items.length-1;
      const m=items[index];
      if(index<0||m?.role!=="assistant"||!Array.isArray(m.replyOptions)||m.replyOptions.length<2)return;

      const rows=[...box.querySelectorAll('.message.assistant[data-message="'+index+'"]')];
      const row=rows.at(-1);
      const stack=row?.querySelector(".message-stack");
      if(!stack)return;

      const wrap=document.createElement("div");
      wrap.className="xy-reply-options";

      for(const opt of m.replyOptions.slice(0,3)){
        const line=document.createElement("div");
        line.className="xy-reply-option";

        const sendButton=document.createElement("button");
        sendButton.type="button";
        sendButton.className="xy-option-send";
        sendButton.textContent=opt;
        sendButton.addEventListener("click",()=>sendOption(index,opt));

        const editButton=document.createElement("button");
        editButton.type="button";
        editButton.className="xy-option-edit";
        editButton.textContent="✎";
        editButton.setAttribute("aria-label","编辑后发送");
        editButton.addEventListener("click",()=>editOption(opt));

        line.append(sendButton,editButton);
        wrap.appendChild(line);
      }

      stack.appendChild(wrap);
    }finally{
      drawing=false;
      const target=document.querySelector("#messages");
      if(observer&&target)observer.observe(target,{childList:true,subtree:true});
    }
  }

  const priorRender=renderMessages;
  renderMessages=function(){
    const r=priorRender();
    requestAnimationFrame(renderLatestOptions);
    return r;
  };

  const box=document.querySelector("#messages");
  if(box){
    let queued=false;
    observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        renderLatestOptions();
      });
    }).observe(box,{childList:true,subtree:true});
  }

  function addSettingsToggle(type){
    if(type!=="settings")return;
    requestAnimationFrame(()=>{
      const body=document.querySelector("#panelBody");
      if(!body||body.querySelector("#xyReplyOptionsEnabled"))return;

      const cfg=readSettings();
      const card=document.createElement("div");
      card.className="setting-card xy-reply-options-setting";
      card.innerHTML='<label class="xy-reply-options-toggle"><span><strong>亲密场景快捷下一步</strong><small>检测到亲密场景时，在最新回复下显示三个一次性选项；不会写进对话历史</small></span><input id="xyReplyOptionsEnabled" type="checkbox"></label>';
      body.appendChild(card);

      const input=card.querySelector("#xyReplyOptionsEnabled");
      input.checked=!!cfg.enabled;
      input.addEventListener("change",()=>{
        writeSettings({...readSettings(),enabled:input.checked});
        renderMessages();
      });
    });
  }

  const priorOpenPanel=openPanel;
  openPanel=function(type){
    const r=priorOpenPanel(type);
    addSettingsToggle(type);
    return r;
  };

  window.xyParseReplyOptions=parseReplyOptions;
  window.xySanitizeReplyOptions=sanitizeMessage;
  window.xyRenderReplyOptions=renderLatestOptions;

  if(sanitizeAll())baseSave();
  requestAnimationFrame(renderLatestOptions);
})();