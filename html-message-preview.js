(()=>{
"use strict";
// Render HTML/CSS as a separate untrusted document. Never place role-authored
// markup directly in the chat DOM: this app stores API keys and has native
// Android bridges. The iframe intentionally does NOT allow JavaScript.
const MAX_HTML=120000;
const SCRIPT_BLOCKED="default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";
function extract(raw){
  const text=String(raw??"");
  // A common SillyTavern/AI response contains a fenced html document.
  const fence=/(?:^|\n)[ \t]*```(?:html|htm)[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```/i.exec(text);
  if(fence&&fence[1].trim()){
    const code=fence[1].trim();
    return code.length>MAX_HTML?{error:"HTML 内容超过 120 KB，请缩短后预览"}:{code};
  }
  // Full HTML or standalone layout fragments also qualify, but prose,
  // plain Markdown and non-HTML code blocks must never be auto-interpreted.
  const candidate=text.trim();
  if(/^(?:<!doctype\s+html\b|<html\b|<body\b|<(?:div|section|article|main|header|footer|style|svg|table|form|canvas|details|aside|figure)\b)/i.test(candidate)&&
      /<\/?[a-z][^>]*>/i.test(candidate)){
    return candidate.length>MAX_HTML?{error:"HTML 内容超过 120 KB，请缩短后预览"}:{code:candidate};
  }
  return null;
}
function safeDoc(code){
  // Meta CSP precedes ALL model-controlled bytes, and the iframe sandbox
  // blocks script execution independently. Relative/external assets are off.
  const csp=SCRIPT_BLOCKED.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  return '<!doctype html><html lang="zh"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="'+csp+'">'+
    '<style>html{color-scheme:light dark}html,body{margin:0;min-height:100%;box-sizing:border-box}body{padding:14px;font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}*,*::before,*::after{box-sizing:border-box}img,video,canvas,svg{max-width:100%}</style></head><body>'+
    String(code||"")+'</body></html>';
}
function frame(code){
  const node=document.createElement("iframe");
  node.className="xy-html-frame";
  node.title="隔离的 HTML 消息预览";
  node.setAttribute("sandbox","");
  node.setAttribute("referrerpolicy","no-referrer");
  node.setAttribute("loading","lazy");
  node.srcdoc=safeDoc(code);
  return node;
}
// First-party rendering for the known twelve-field Tavern <jn_status> format.
// The original role template is untrusted; never inject it into the parent DOM.
function buildTavernStatus(source){
  const values=Array.isArray(source.fields)?source.fields:[];
  const v=i=>String(values[i-1]||"").trim().slice(0,7500);
  const root=document.createElement("section");
  root.className="xy-tavern-status-widget";
  root.innerHTML='<details class="xy-jn-card">'+
    '<summary class="xy-jn-cover">'+
      '<span class="xy-jn-avatar" aria-hidden="true">🐶</span>'+
      '<span class="xy-jn-cover-text"><strong>窝是一只可怜的狗儿</strong>'+
        '<span class="xy-jn-cover-mood"></span></span>'+
      '<span class="xy-jn-chevron" aria-hidden="true">⌄</span>'+
    '</summary>'+
    '<div class="xy-jn-paper">'+
      '<div class="xy-jn-tabs" role="tablist" aria-label="角色状态">'+
        '<button type="button" role="tab" data-jn-tab="1" aria-selected="true">汪汪日常</button>'+
        '<button type="button" role="tab" data-jn-tab="2" aria-selected="false">小秘密</button>'+
        '<button type="button" role="tab" data-jn-tab="3" aria-selected="false">假如狗狗</button>'+
      '</div>'+
      '<div class="xy-jn-tab-panel" data-jn-panel="1" role="tabpanel">'+
        '<div class="xy-jn-facts">'+
          '<div><small>日期</small><span data-jn-value="1"></span></div>'+
          '<div><small>时间</small><span data-jn-value="2"></span></div>'+
          '<div><small>位置</small><span data-jn-value="3"></span></div>'+
          '<div><small>天气</small><span data-jn-value="4"></span></div>'+
        '</div>'+
        '<div class="xy-jn-field"><small>穿搭</small><p data-jn-value="7"></p></div>'+
        '<div class="xy-jn-field"><small>正在</small><p data-jn-value="9"></p></div>'+
        '<div class="xy-jn-field"><small>狗语</small><p data-jn-value="10"></p></div>'+
      '</div>'+
      '<div class="xy-jn-tab-panel" data-jn-panel="2" role="tabpanel" hidden>'+
        '<div class="xy-jn-field"><small>狗狗想要涩涩</small><p data-jn-value="11"></p></div>'+
        '<div class="xy-jn-field"><small>假老婆的耐久度</small><p data-jn-value="8"></p></div>'+
      '</div>'+
      '<div class="xy-jn-tab-panel" data-jn-panel="3" role="tabpanel" hidden>'+
        '<div class="xy-jn-field"><small>✨ 假如小剧场 ✨</small><p data-jn-value="12"></p></div>'+
      '</div>'+
      '<p class="xy-jn-footnote">狗狗状态 · 来自角色卡</p>'+
    '</div></details>'+
    '<details class="xy-jn-source"><summary>HTML 源代码</summary><pre></pre></details>';
  root.querySelector(".xy-jn-cover-mood").textContent="汪：" + (v(5)||"……");
  const all=root.querySelectorAll("[data-jn-value]");
  all.forEach(el=>{
    const value=v(Number(el.getAttribute("data-jn-value")));
    el.textContent=value||"暂无记录";
  });
  const tabs=root.querySelectorAll("[data-jn-tab]");
  const panels=root.querySelectorAll("[data-jn-panel]");
  tabs.forEach(button=>button.addEventListener("click",()=>{
    const chosen=button.getAttribute("data-jn-tab");
    tabs.forEach(item=>item.setAttribute("aria-selected",String(item===button)));
    panels.forEach(item=>{item.hidden=item.getAttribute("data-jn-panel")!==chosen});
  }));
  root.querySelector(".xy-jn-source pre").textContent=source.code||"";
  return root;
}
function buildWidget(source){
  const root=document.createElement("section");
  root.className="xy-html-widget";
  root.innerHTML='<div class="xy-html-bar">'+
    '<span class="xy-html-tag">▤ HTML</span>'+
    '<button type="button" data-html-action="preview" aria-expanded="false">预览</button>'+
    '<button type="button" data-html-action="source" aria-expanded="false">源代码</button>'+
    '<button type="button" data-html-action="expand" hidden>放大</button>'+
    '<button type="button" data-html-action="close" hidden>收起</button>'+
    '</div><div class="xy-html-preview" hidden></div>'+
    '<p class="xy-html-footnote" hidden>已隔离预览 · 支持 HTML / CSS；不会执行脚本或连接外部资源。</p>';
  const preview=root.querySelector(".xy-html-preview");
  const note=root.querySelector(".xy-html-footnote");
  const buttons={};
  root.querySelectorAll("[data-html-action]").forEach(el=>buttons[el.dataset.htmlAction]=el);
  let mode="closed";
  if(source.kind==="tavern-status"){
    root.classList.add("xy-html-tavern");
    root.querySelector(".xy-html-tag").textContent="♡ 酒馆状态栏";
  }
  function toggle(next){
    if(source.error&&next==="preview"){showError();return}
    if(next===mode)next="closed";
    mode=next;
    preview.replaceChildren();
    preview.hidden=mode==="closed";
    note.hidden=mode==="closed";
    buttons.preview.setAttribute("aria-expanded",String(mode==="preview"));
    buttons.source.setAttribute("aria-expanded",String(mode==="source"));
    buttons.expand.hidden=mode!=="preview";
    buttons.close.hidden=mode==="closed";
    if(mode==="preview")preview.appendChild(frame(source.code));
    if(mode==="source"){
      const code=document.createElement("pre");code.className="xy-html-source";
      code.textContent=source.code||"";
      preview.appendChild(code);
    }
  }
  function showError(){
    mode="error";
    preview.replaceChildren();
    const error=document.createElement("p");error.className="xy-html-error";error.textContent=source.error;
    preview.appendChild(error);preview.hidden=false;note.hidden=true;
    buttons.close.hidden=false;buttons.expand.hidden=true;
  }
  buttons.preview.addEventListener("click",()=>toggle("preview"));
  buttons.source.addEventListener("click",()=>toggle("source"));
  buttons.close.addEventListener("click",()=>toggle("closed"));
  buttons.expand.addEventListener("click",()=>{
    if(mode!=="preview"||!source.code)return;
    const overlay=document.createElement("div");
    overlay.className="xy-html-overlay";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-label","HTML 全屏预览");
    const pane=document.createElement("div");pane.className="xy-html-overlay-pane";
    const top=document.createElement("div");top.className="xy-html-overlay-top";
    const title=document.createElement("strong");title.textContent="HTML 预览";
    const exit=document.createElement("button");exit.type="button";exit.textContent="关闭";exit.setAttribute("aria-label","关闭全屏预览");
    top.append(title,exit);pane.appendChild(top);pane.appendChild(frame(source.code));overlay.appendChild(pane);
    const keydown=e=>{if(e.key==="Escape")close()};
    const close=()=>{document.removeEventListener("keydown",keydown);overlay.remove()};
    exit.addEventListener("click",close);
    overlay.addEventListener("click",event=>{if(event.target===overlay)close()});
    document.addEventListener("keydown",keydown);
    document.body.appendChild(overlay);
    exit.focus();
  });
  if(source.autoOpen)toggle("preview");
  return root;
}
function decorate(){
  const c=typeof chat==="function"?chat():null;
  const box=document.querySelector("#messages");
  if(!c||!box)return;
  (c.messages||[]).forEach((m,index)=>{
    if(m?.role!=="assistant"||!m.text||m.localOnly)return;
    const source=window.xyTavernDisplay?.findStatus?.(m.text,c.characterId)||extract(m.text);
    if(!source)return;
    // Attach after the LAST visible segment, since Tavern's status marker
    // normally lives at the end of a long split assistant message.
    const targets=box.querySelectorAll('.message.assistant[data-message="'+index+'"] .message-stack');
    const target=targets?.[targets.length-1];
    if(!target||target.querySelector(".xy-html-widget"))return;
    const widget=source.kind==="tavern-status"&&Array.isArray(source.fields)?buildTavernStatus(source):buildWidget(source);
    const bubble=target.querySelector(".bubble");
    if(bubble)bubble.insertAdjacentElement("afterend",widget);
    else target.appendChild(widget);
  });
}
const previous=renderMessages;
renderMessages=function(){const result=previous.apply(this,arguments);decorate();return result};
window.xyHtmlPreview={extract,safeDoc,decorate};
decorate();
})();