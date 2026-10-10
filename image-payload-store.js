(()=>{
  const DB="xy-media-payload-v1",STORE="images";
  let cacheDb=null;
  function open(){
    if(cacheDb)return Promise.resolve(cacheDb);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
      req.onsuccess=()=>{cacheDb=req.result;resolve(cacheDb)};
      req.onerror=()=>reject(req.error||new Error("图片数据库无法打开"));
    });
  }
  async function put(id,value){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(value,id);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error("图片无法保存"));
    });
  }
  async function get(id){
    const db=await open();return new Promise((resolve,reject)=>{
      const req=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||"");
      req.onerror=()=>reject(req.error);
    });
  }
  async function archive(items){
    for(const a of items||[]){
      if(a?.kind!=="image"||!a.dataUrl)continue;
      a.mediaKey=a.mediaKey||"img-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      try{await put(a.mediaKey,a.dataUrl)}
      catch(error){throw new Error("图片保存失败，请检查手机存储空间："+String(error?.message||error))}
    }
  }
  async function hydrate(messages){
    for(const m of messages||[]){
      for(const a of m?.attachments||[]){
        if(a?.kind!=="image"||a.dataUrl||!a.mediaKey)continue;
        try{a.dataUrl=await get(a.mediaKey)}catch{}
      }
    }
  }
  window.xyImagePayload={archive,hydrate};
})();