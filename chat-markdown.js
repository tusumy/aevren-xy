(()=>{
"use strict";
// Minimal Markdown formatter for bubbles. All user/model text is escaped first;
// only fixed safe tags are emitted. Preserves the existing sticker renderer.
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const plain=s=>window.xyStickerShelf?.renderText?.(s)??escapeHtml(s);
function inline(value,depth=0){
  const s=String(value??"");
  if(depth>3)return plain(s);
  const re=/(`[^`\n]+`|\*\*[^\n]+?\*\*|__[^\n]+?__|~~[^\n]+?~~|\*[^\n*]+?\*|(^|[^\w])_[^\n_]+?_(?!\w))/g;
  let html="",last=0,match;
  while((match=re.exec(s))){
    const token=match[0];
    html+=plain(s.slice(last,match.index));
    if(token.startsWith("`"))html+="<code class=\"xy-md-code\">"+escapeHtml(token.slice(1,-1))+"</code>";
    else if(token.startsWith("**")||token.startsWith("__"))html+="<strong>"+inline(token.slice(2,-2),depth+1)+"</strong>";
    else if(token.startsWith("~~"))html+="<del>"+inline(token.slice(2,-2),depth+1)+"</del>";
    else if(token.startsWith("*"))html+="<em>"+inline(token.slice(1,-1),depth+1)+"</em>";
    else {
      const underscore=token.indexOf("_");
      html+=plain(token.slice(0,underscore))+"<em>"+inline(token.slice(underscore+1,-1),depth+1)+"</em>";
    }
    last=re.lastIndex;
  }
  return html+plain(s.slice(last));
}
function line(value){
  const s=String(value??"");
  const heading=s.match(/^\s{0,3}(#{1,4})\s+(.+)$/);
  if(heading)return '<strong class="xy-md-heading">'+inline(heading[2])+'</strong>';
  const quote=s.match(/^\s*>\s?(.+)$/);
  if(quote)return '<span class="xy-md-quote">'+inline(quote[1])+'</span>';
  const bullet=s.match(/^\s*[-+*]\s+(.+)$/);
  if(bullet)return '<span class="xy-md-list">• '+inline(bullet[1])+'</span>';
  return inline(s);
}
function render(value){
  const raw=String(value??"");
  const segments=raw.split(/(```[\s\S]*?```)/g);
  return segments.map(s=>{
    if(s.startsWith("```")&&s.endsWith("```")){
      const body=s.slice(3,-3).replace(/^[a-zA-Z0-9_+-]+[ \t]*\n/,"");
      return '<span class="xy-md-pre"><code>'+escapeHtml(body)+'</code></span>';
    }
    return s.split("\n").map(line).join("\n");
  }).join("");
}
const style=document.createElement("style");
style.textContent=".bubble-text strong{font-weight:700}.bubble-text em{font-style:italic}.bubble-text .xy-md-heading{font-size:1.06em}.bubble-text .xy-md-quote{display:block;border-left:3px solid #b1c3b7;padding-left:10px}.bubble-text .xy-md-code{background:rgba(90,105,93,.12);padding:1px 4px;border-radius:4px;font-size:.9em}.bubble-text .xy-md-pre{display:block;font-size:.9em;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;padding:12px;border-radius:10px;background:rgba(70,86,74,.10)}.bubble-text del{opacity:.7}";
document.head.appendChild(style);
window.xyChatMarkdown={render};
})();