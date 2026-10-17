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
  // The native card reads only the twelve captured plain-text fields.
  // Its first-party markup is isolated from the imported HTML template.
  const fields=Array.from({length:12},(_,i)=>String(captures[i+1]||"").slice(0,7500));
  return {code:result,kind:"tavern-status",fields,autoOpen:false};
}
// Native fallback for model-generated status when imported regex misses.
const STATUS_BLOCK=/<jn_status\b[^>]*>[\s\S]*?<\/jn_status\s*>/i;
function fallbackStatus(raw){
  const block=STATUS_BLOCK.exec(String(raw??""))?.[0];
  if(!block||block.length>20000)return null;
  const body=block.replace(/^<jn_status\b[^>]*>/i,"").replace(/<\/jn_status\s*>$/i,"").trim();
  const expected={base:4,avatar:2,info:2,mind:3,if:1};
  const fieldsByType={};
  const pattern=/\[\s*(Base|Avatar|Info|Mind|IF)\s*\|([\s\S]*?)\](?=\s*(?:\[\s*(?:Base|Avatar|Info|Mind|IF)\s*\||$))/gi;
  let found;
  while((found=pattern.exec(body))){
    const type=found[1].toLowerCase();
    if(fieldsByType[type])continue;
    const parts=found[2].split("|");
    const count=expected[type];
    fieldsByType[type]=Array.from({length:count},(_,i)=>
      String(i===count-1?parts.slice(i).join("|"):parts[i]||"").trim().slice(0,7500));
  }
  if(Object.keys(fieldsByType).length<3)return null;
  const fields=["base","avatar","info","mind","if"].flatMap(k=>
    fieldsByType[k]||Array(expected[k]).fill(""));
  return {kind:"tavern-status",fields,raw:block,code:"",fallback:true,autoOpen:false};
}
function findStatus(text,role){
  const t=String(text??"");
  if(!STATUS_BLOCK.test(t))return null;
  const rules=rulesFor(role);
  for(const rule of rules){
    if(rule?.kind!=="status")continue;
    const prepared=buildStatus(rule,t);
    if(prepared)return prepared;
  }
  return fallbackStatus(t);
}
function strip(text,role){
  const raw=String(text??"");
  // Preserve raw original message in storage; display ordinary prose only.
  return raw.replace(/<jn_status\b[^>]*>[\s\S]*?<\/jn_status\s*>/gi,"")
    .replace(/<\/?jn_status\s*>/gi,"").trim();
}
window.xyTavernDisplay={findStatus,strip,rulesFor};
})();