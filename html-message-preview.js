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
  return root;
}
function decorate(){
  const c=typeof chat==="function"?chat():null;
  const box=document.querySelector("#messages");
  if(!c||!box)return;
  (c.messages||[]).forEach((m,index)=>{
    if(m?.role!=="assistant"||!m.text||m.localOnly)return;
    const source=extract(m.text);
    if(!source)return;
    const target=box.querySelector('.message.assistant[data-message="'+index+'"] .message-stack');
    if(!target||target.querySelector(".xy-html-widget"))return;
    const widget=buildWidget(source);
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