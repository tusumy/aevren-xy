/* One world = one book; worlds have multiple independent narrative branches. */
(()=>{
"use strict";
const C=window.xyCreative;if(!C)return;
const {esc}=C;let active="",line="",mode="shelf",error="";
const panel=document.querySelector("#panel"),host=document.querySelector("#panelBody");
function selected(kind){return [...host.querySelectorAll('[data-creative-pick="'+kind+'"]:checked')].map(x=>x.value)}
function chips(ids,kind){return '<div class="xy-c-roles">'+C.chars().map(c=>'<label><input type="checkbox" data-creative-pick="'+kind+'" value="'+esc(c.id)+'" '+((ids||[]).includes(String(c.id))?"checked":"")+'><span>'+esc(c.name)+'</span></label>').join("")+'</div>'}
function listing(){let b=C.books().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 return '<div class="xy-c-hero"><small>STORY ATELIER</small><h2>创作角</h2><p>一个设定一本书。不同的世界，随时重来。</p></div>'+
 '<div class="xy-c-actions"><button data-c="new">＋ 新建设定书</button><button data-c="group">＋ 多人群聊</button></div>'+
 (b.length?'<div class="xy-c-stack">'+b.map((x,i)=>'<button class="xy-c-book" data-c="book" data-id="'+esc(x.id)+'" style="--i:'+i+';--h:'+[12,187,258,330,80][i%5]+'deg"><small>WORLD '+String(i+1).padStart(2,"0")+'</small><strong>'+esc(x.title||"未命名设定")+'</strong><span>'+esc(C.names(x.characterIds)||"自由设定")+' · '+(x.lines||[]).length+' 条线</span></button>').join("")+'</div>':'<div class="xy-c-empty">书架还空着。写下一本新书吧。</div>')+
 '<h3 class="xy-c-section">群聊剧场</h3>'+
 (C.groups().length?C.groups().map(g=>'<button class="xy-c-listbtn" data-c="open-group" data-id="'+esc(g.id)+'"><b>'+esc(g.title)+'</b><small>'+esc(C.names(g.characterIds))+' · '+(g.messages||[]).length+' 条消息</small></button>').join(""):'<div class="xy-c-empty">尚无群聊，可以挑选两个以上角色开始。</div>');
}
function bookView(b){return '<div class="xy-c-head"><button data-c="shelf">← 书架</button><button class="warning" data-c="remove-book">删除本书</button></div><h2>《'+esc(b.title)+'》</h2>'+
 '<label>书名<input id="xyCtitle" maxlength="90" value="'+esc(b.title)+'"></label>'+
 '<label>这个世界的设定<textarea id="xyCworld" rows="6" placeholder="时代、地点、关系、故事规则……">'+esc(b.world||"")+'</textarea></label>'+
 '<div class="xy-c-label">可选角色（不限数量，可不绑定）</div>'+chips(b.characterIds,"book")+
 '<button class="xy-c-primary" data-c="save-book">保存设定</button><h3 class="xy-c-section">故事分支</h3>'+
 (b.lines||[]).map((x,i)=>'<button class="xy-c-listbtn" data-c="line" data-id="'+esc(x.id)+'"><b>✦ '+esc(x.title)+'</b><small>'+((x.entries||[]).length)+' 节</small></button>').join("")+
 '<div class="xy-c-actions"><input id="xyClineTitle" placeholder="分支名，如：另一个结局"><button data-c="new-line">添加分支</button></div>'+
 '<button class="xy-c-primary" data-c="book-group">以这本书开启多人聊天</button>';
}
function lineView(b,l){return '<div class="xy-c-head"><button data-c="book" data-id="'+esc(b.id)+'">← '+esc(b.title)+'</button><button class="warning" data-c="remove-line">删除分支</button></div><h2>'+esc(l.title)+'</h2>'+
 (l.entries||[]).map((x,i)=>'<article class="xy-c-chapter"><header>第 '+(i+1)+' 节<button data-c="remove-entry" data-id="'+esc(x.id)+'">×</button></header><p>'+esc(x.text)+'</p></article>').join("")+
 '<label>续写一节<textarea id="xyCchapter" rows="6" placeholder="这一条故事线独立保存……"></textarea></label><button class="xy-c-primary" data-c="append">保存本节</button>';
}
function render(){
 const b=C.book(active);let view=mode==="book"&&b?bookView(b):mode==="line"&&b?lineView(b,b.lines?.find(l=>l.id===line)||{title:"故事线",entries:[]}):listing();
 host.innerHTML='<div id="xyCreationView">'+(error?'<p class="xy-c-error">'+esc(error)+'</p>':"")+view+'</div>';error="";
}
function open(){
 mode="shelf"; panel.classList.add("xy-creative-panel","open");
 document.querySelector("#sidebar")?.classList.remove("open");
 document.querySelector("#panelEyebrow").textContent="STORY ATELIER";
 document.querySelector("#panelTitle").textContent="创作角";
 document.querySelector("#scrim")?.classList.add("show");
 window.xyEnsureOverlayHistory?.();render();
}
function saveFields(b){b.title=host.querySelector("#xyCtitle")?.value.trim().slice(0,90)||b.title;b.world=host.querySelector("#xyCworld")?.value.slice(0,25000)||"";b.characterIds=selected("book");C.saveBook(b)}
host.addEventListener("click",e=>{
 const cmd=e.target.closest("#xyCreationView [data-c]");if(!cmd)return;e.preventDefault();
 const task=cmd.dataset.c,target=cmd.dataset.id,b=C.book(active);
 if(task==="shelf"){mode="shelf";return render()}
 if(task==="new"){const b={id:C.id(),title:"新世界",world:"",characterIds:[],lines:[],createdAt:Date.now()};C.saveBook(b);active=b.id;mode="book"}
 if(task==="book"){active=target;mode="book"}
 if(task==="save-book"&&b)saveFields(b);
 if(task==="remove-book"&&b){if(!confirm("删除此书及所有分支？不可撤销"))return;C.drop(C.B,b.id);active="";mode="shelf"}
 if(task==="new-line"&&b){const title=host.querySelector("#xyClineTitle")?.value.trim().slice(0,80)||"新的故事线";saveFields(b);const x={id:C.id(),title,entries:[]};b.lines??=[];b.lines.push(x);C.saveBook(b);line=x.id;mode="line"}
 if(task==="line"){line=target;mode="line"}
 if(task==="remove-line"&&b){if(!confirm("删除此分支？"))return;b.lines=(b.lines||[]).filter(x=>x.id!==line);C.saveBook(b);mode="book"}
 if(task==="append"&&b){const txt=host.querySelector("#xyCchapter")?.value.trim();if(txt){const l=b.lines.find(x=>x.id===line);l.entries.push({id:C.id(),text:txt.slice(0,24000),at:Date.now()});C.saveBook(b)}}
 if(task==="remove-entry"&&b){const l=b.lines.find(x=>x.id===line);l.entries=l.entries.filter(x=>x.id!==target);C.saveBook(b)}
 if(task==="book-group"&&b){saveFields(b);return window.xyCreativeGroup?.newGroup?.(b)}
 if(task==="group")return window.xyCreativeGroup?.newGroup?.();
 if(task==="open-group")return window.xyCreativeGroup?.open?.(target);
 render();
});
const prev=openPanel;
openPanel=function(type){
 if(type==="creation")return open();
 panel?.classList.remove("xy-creative-panel");
 return prev(type);
};
window.xyCreativeLibrary={open,render};
})();