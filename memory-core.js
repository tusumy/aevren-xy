(()=>{
  const CORE_TAGS=new Set(['角色','身份','规则','核心']);
  const STOP=/[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》…—_\-~`@#$%^&*+=|\\/]+/g;
  const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const clean=s=>String(s||'').toLowerCase().replace(STOP,'');
  const grams=s=>{
    const raw=clean(s),out=new Set();
    if(!raw)return out;
    (String(s||'').toLowerCase().match(/[a-z0-9_]{2,}/g)||[]).forEach(x=>out.add(x));
    for(let n=2;n<=3;n++)for(let i=0;i+n<=raw.length;i++)out.add(raw.slice(i,i+n));
    return out;
  };
  const trigger=q=>/(之前|上次|以前|还记得|记不记得|那个|那件|又|后来|当时|第一次|前几天|曾经|以前说|提过)/.test(q);
  const score=(query,candidate)=>{
    const q=clean(query),text=clean(candidate.text),qt=grams(query),ct=grams(candidate.text+' '+(candidate.tag||''));
    if(!q||!text)return 0;
    let s=0,hit=0;
    if(text.includes(q)&&q.length>=3)s+=10;
    if(q.includes(text)&&text.length>=4)s+=6;
    qt.forEach(t=>{if(ct.has(t)){hit++;s+=t.length===3?2.2:1.15}});
    if(hit>=3)s+=2;
    if(candidate.kind==='memory')s+=1.2;
    if(CORE_TAGS.has(candidate.tag))s+=1.8;
    return s;
  };
  function characterId(){return window.xyCurrentCharacter?.()?.id||chat()?.characterId||''}
  function candidates(){
    const id=characterId(),allMem=parse('xy.memories',[]),out=[];
    allMem.filter(m=>!id||m.characterId===id).forEach((m,i)=>out.push({kind:'memory',tag:m.tag||'记忆',text:String(m.text||''),source:'memory',index:i}));
    const currentId=chat()?.id;
    (Array.isArray(chats)?chats:parse('xy.chats',[])).filter(c=>(!id||c.characterId===id)&&c.id!==currentId).forEach(c=>{
      const ms=Array.isArray(c.messages)?c.messages:[];
      for(let i=0;i<ms.length;i++){
        if(ms[i]?.role!=='user')continue;
        const a=ms[i+1]?.role==='assistant'?ms[i+1]:null;
        const user=String(ms[i]?.text||'').trim(),assistant=String(a?.text||'').trim();
        if(!user&&!assistant)continue;
        const text=('你：'+user+(assistant?'\n'+(window.xyCurrentCharacter?.()?.name||'角色')+'：'+assistant:'')).slice(0,520);
        out.push({kind:'chat',tag:'旧聊天',text,source:String(c.title||'旧对话'),chatId:c.id,index:i});
      }
    });
    return out;
  }
  function recall(query,limit=6){
    const broad=trigger(String(query||'')),pool=candidates(),ranked=pool.map(x=>({...x,score:score(query,x)})).filter(x=>x.score>=(broad?1.2:2.4)).sort((a,b)=>b.score-a.score);
    const picked=[],seen=new Set();
    for(const x of ranked){
      const key=x.kind+'|'+clean(x.text).slice(0,120);if(seen.has(key))continue;seen.add(key);picked.push(x);if(picked.length>=limit)break;
    }
    return picked;
  }
  function selectMemories(ch,query){
    const id=ch?.id||characterId(),all=parse('xy.memories',[]).filter(m=>!id||m.characterId===id);
    const core=all.filter(m=>CORE_TAGS.has(m.tag)).slice(0,3).map(m=>({...m,tag:m.tag||'核心'}));
    const found=recall(query,6).map(x=>x.kind==='memory'?{text:x.text,tag:x.tag,characterId:id}:{text:'来自「'+x.source+'」：\n'+x.text,tag:'旧聊天',characterId:id});
    const out=[],seen=new Set();
    [...core,...found].forEach(m=>{const k=clean(m.text);if(!k||seen.has(k))return;seen.add(k);out.push(m)});
    return out.slice(0,7);
  }
  window.xyRecallMemory=recall;
  window.xySelectMemories=selectMemories;
})();
