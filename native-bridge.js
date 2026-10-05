(()=>{
  const bridge=window.AevrenNative;
  if(!bridge||typeof bridge.request!=="function")return;

  window.__XY_NATIVE_HTTP__=true;
  const pending=new Map();
  let seq=0;

  const toBase64=bytes=>{
    let out="";
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk){
      out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
    }
    return btoa(out);
  };
  const fromBase64=value=>{
    const bin=atob(value||"");
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return bytes;
  };
  const blobBase64=async blob=>toBase64(new Uint8Array(await blob.arrayBuffer()));

  async function encodeBody(body,headers){
    if(body==null)return {kind:"none"};
    if(typeof body==="string")return {kind:"text",data:body,contentType:headers.get("content-type")||""};
    if(body instanceof URLSearchParams)return {kind:"text",data:body.toString(),contentType:headers.get("content-type")||"application/x-www-form-urlencoded;charset=UTF-8"};
    if(body instanceof FormData){
      headers.delete("content-type");
      const parts=[];
      for(const [name,value] of body.entries()){
        if(typeof value==="string")parts.push({type:"text",name,value});
        else parts.push({type:"file",name,filename:value.name||"blob",contentType:value.type||"application/octet-stream",base64:await blobBase64(value)});
      }
      return {kind:"multipart",parts};
    }
    if(body instanceof Blob)return {kind:"base64",base64:await blobBase64(body),contentType:body.type||headers.get("content-type")||"application/octet-stream"};
    if(body instanceof ArrayBuffer)return {kind:"base64",base64:toBase64(new Uint8Array(body)),contentType:headers.get("content-type")||"application/octet-stream"};
    if(ArrayBuffer.isView(body))return {kind:"base64",base64:toBase64(new Uint8Array(body.buffer,body.byteOffset,body.byteLength)),contentType:headers.get("content-type")||"application/octet-stream"};
    return {kind:"text",data:String(body),contentType:headers.get("content-type")||"text/plain;charset=UTF-8"};
  }

  window.__xyNativeResolve=(id,raw)=>{
    const job=pending.get(id);if(!job)return;
    pending.delete(id);
    try{
      const data=JSON.parse(raw||"{}");
      if(data.error){job.reject(new TypeError(data.error));return}
      const body=data.bodyBase64?fromBase64(data.bodyBase64):(data.body||"");
      job.resolve(new Response(body,{status:Number(data.status||200),statusText:data.statusText||"",headers:data.headers||{}}));
    }catch(error){job.reject(error)}
  };

  window.__xyNativeReject=(id,message)=>{
    const job=pending.get(id);if(!job)return;
    pending.delete(id);job.reject(new TypeError(message||"Native request failed"));
  };

  window.fetch=async function(input,init={}){
    const url=typeof input==="string"?input:input instanceof URL?input.toString():input?.url;
    if(!/^https?:\/\//i.test(String(url||"")))throw new TypeError("Native HTTP only supports http/https URLs");

    const headers=new Headers(input instanceof Request?input.headers:undefined);
    if(init.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
    const method=String(init.method||(input instanceof Request?input.method:"GET")||"GET").toUpperCase();
    let body=init.body;
    if(body==null&&input instanceof Request&&method!=="GET"&&method!=="HEAD")body=await input.clone().blob();
    const encodedBody=await encodeBody(body,headers);
    const headerObject={};headers.forEach((v,k)=>{headerObject[k]=v});
    const id=`xy_${Date.now()}_${++seq}`;
    const payload={url:String(url),method,headers:headerObject,body:encodedBody};

    return new Promise((resolve,reject)=>{
      if(init.signal?.aborted){reject(new DOMException("The operation was aborted.","AbortError"));return}
      pending.set(id,{resolve,reject});
      if(init.signal)init.signal.addEventListener("abort",()=>{if(pending.delete(id))reject(new DOMException("The operation was aborted.","AbortError"))},{once:true});
      try{bridge.request(id,JSON.stringify(payload))}
      catch(error){pending.delete(id);reject(error)}
    });
  };
})();
