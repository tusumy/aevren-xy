/* Independent creative library and chat storage. */
(()=>{
"use strict";
if(window.xyCreative)return;
const B="xy.creation.books.v1",G="xy.creation.groups.v1";
const read=k=>{try{const x=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(x)?x:[]}catch{return []}};
const write=(k,x)=>localStorage.setItem(k,JSON.stringify(x));
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const chars=()=>{const c=read("xy.characters").filter(x=>x&&x.id&&x.name);return c.length?c:[{id:"xuan-yan",name:"玄砚",system:""}]};
const names=ids=>(ids||[]).map(id=>chars().find(c=>String(c.id)===String(id))?.name||"已移除角色").join("、");
const save=(key,item)=>{const x=read(key),i=x.findIndex(v=>v.id===item.id);item.updatedAt=Date.now();if(i<0)x.unshift(item);else x[i]=item;write(key,x)};
const drop=(key,id)=>write(key,read(key).filter(v=>v.id!==id));
const core={B,G,read,write,id,esc,chars,names,books:()=>read(B),groups:()=>read(G),book:id=>read(B).find(x=>x.id===id),group:id=>read(G).find(x=>x.id===id),saveBook:x=>save(B,x),saveGroup:x=>save(G,x),drop};
window.xyCreative=core;
})();