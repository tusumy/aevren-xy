(()=>{let pending=null;const NAME="xy-voice-archive",STORE="clips";
function open(){if(pending)return pending;pending=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return}
const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};
r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("Cannot open voice archive"))});return pending.catch(error=>{pending=null;throw error})}
async function put(blob){const db=await open(),id="voice_"+Date.now()+"_"+Math.random().toString(36).slice(2,10);return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(blob,id);tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error||new Error("Voice storage failed"));tx.onabort=()=>reject(tx.error||new Error("Voice storage aborted"))})}
async function get(id){if(!id)return null;const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(String(id));req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error("Voice read failed"))})}
window.xyAudioArchive={put,get};
})();
