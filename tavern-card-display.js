(()=>{
"use strict";
// Restricted compatibility layer for SillyTavern character-card display regex.
// NEVER execute imported Tavern Helper scripts or arbitrary regexes. Only
// explicit <jn_status> templates are interpreted and hosted by the strict
// scriptless HTML preview iframe.
const KEY="xy.study.v1";
let lastJson=null,cache=null;
function rulesFor(role){
  const raw=localStorage.getItem(KEY)||"";
  if(raw!==lastJson){
    lastJson=raw;
    try{cache=JSON.parse(raw)?.byCharacter||{}}catch{cache={}}
  }
  const card=cache?.[String(role||"")]?.card;
  return Array.isArray(card?.displayRules)?card.displayRules:[];
}
const enc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function stripMarkdownFence(template){
  const s=String(template||"").trim();
  const match=/^```html\s*\r?\n([\s\S]*?)\r?\n?```$/i.exec(s);
  return match?match[1]:s;
}
function styleStatusWithoutScripts(html){
  // Replace ONLY the known three-tab <jn_status> template's onclick buttons
  // with native CSS radios. Native <details> already expands without JS.
  if(!html.includes('class="jn-content-wrap"'))return html;
  const labels=new Set;
  html=html.replace(/<button\s+class="jn-tab-btn(?: active)?"\s+onclick="switchJnTab\(this,\s*([123])\)">([\s\S]*?)<\/button>/g,(_all,n,label)=>{
    labels.add(n);
    return '<label class="jn-tab-btn" for="xy-jn-tab-'+n+'">'+label+'</label>';
  });
  if(labels.size<3)return html;
  const radios=[1,2,3].map(n=>'<input type="radio" class="xy-jn-radio" name="xy-jn-tabs" id="xy-jn-tab-'+n+'" '+(n===1?'checked':'')+'>').join("");
  html=html.replace('<div class="jn-content-wrap">','<div class="jn-content-wrap">'+radios);
  // The radios and tab panels are siblings. These rules work in a sandbox
  // where JavaScript is totally disabled.
  const css='<style>'+
    '.xy-jn-radio{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}'+
    '.jn-content-wrap .jn-tab-content,.jn-content-wrap .jn-tab-content.active{display:none!important}'+
    [1,2,3].map(n=>
      '#xy-jn-tab-'+n+':checked ~ .jn-tab'+n+'{display:flex!important}'+
      '#xy-jn-tab-'+n+':checked ~ .jn-tabs label[for="xy-jn-tab-'+n+'"]{background:rgba(255,255,255,.8)!important;color:#ff5277!important;font-weight:700}'
    ).join('')+
    '.jn-tabs label.jn-tab-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}'+
    '.jn-avatar-area:focus-within .jn-bubble,.jn-avatar-area:hover .jn-bubble{transform:translateY(-50%) scale(1)}'+
    '.jn-music-btn{display:none!important}'+
    '</style>';
  return html+css;
}
function buildStatus(rule,text){
  const segment=/<jn_status>[\s\S]*?<\/jn_status>/i.exec(text);
  if(!segment||segment[0].length>20000)return null;
  const find=String(rule.findRegex||"");
  // Only accept the exact marker family, NEVER a generic user regex.
  if(!/jn_status/i.test(find)||find.length>2000)return null;
  const parts=/^\/([\s\S]+)\/([gimsuy]*)$/.exec(find);
  if(!parts)return null;
  let captures;
  try{captures=new RegExp(parts[1],parts[2].replace(/g/g,"")).exec(segment[0])}catch{return null}
  if(!captures)return null;
  const tpl=stripMarkdownFence(rule.replaceString);
  if(!tpl||tpl.length>40000)return null;
  // Escape captures BEFORE inserting them into HTML, so status data can't
  // escape the CSS-only preview or create scripts, tags or event handlers.
  // Rewrite trusted template structure BEFORE filling in escaped model
  // values. Otherwise an escaped quoted phrase like "onerror=..." could be
  // mistaken for an HTML event attribute and stripped from the story.
  let result=styleStatusWithoutScripts(tpl);
  result=result.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,"");
  result=result.replace(/<audio\b[^>]*>[\s\S]*?<\/audio\s*>/gi,"");
  result=result.replace(/<video\b[^>]*>[\s\S]*?<\/video\s*>/gi,"");
  // Remove any remaining inline events from the original template.
  result=result.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,"");
  result=result.replace(/\$(1[0-2]|[1-9])(?!\d)/g,(_full,index)=>enc(captures[Number(index)]||""));
  result=result.replace(/<!doctype[^>]*>/gi,"")
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi,"");
  if(result.length>120000)return null;
  return {code:result,kind:"tavern-status",autoOpen:true};
}
function findStatus(text,role){
  const t=String(text??"");
  if(!t.includes("<jn_status>")||!t.includes("</jn_status>"))return null;
  const rules=rulesFor(role);
  for(const rule of rules){
    if(rule?.kind!=="status")continue;
    const prepared=buildStatus(rule,t);
    if(prepared)return prepared;
  }
  return null;
}
function strip(text,role){
  const raw=String(text??"");
  if(!findStatus(raw,role))return raw;
  // Raw markup is still saved intact as part of the chat history. Only the
  // visible bubble omits this data so it won't duplicate the pretty card.
  return raw.replace(/<jn_status>[\s\S]*?<\/jn_status>/i,"").trim();
}
window.xyTavernDisplay={findStatus,strip,rulesFor};
})();