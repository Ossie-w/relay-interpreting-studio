// Some browsers reject a single 340 MB Cache API response. Keep the voice
// weights in small IndexedDB records instead, and expose them as a stream.
// Only the exact public Kokoro model URL is intercepted.
const MODEL="https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/onnx/model.onnx";
const BLOCK=4*1024*1024;
let dbPromise;
function database(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open("relay-voice-model-v1",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("files");
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error("Voice model storage is blocked by another tab."));
 }).catch(error=>{dbPromise=null;throw error});
 return dbPromise;
}
async function get(key){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const request=db.transaction("files").objectStore("files").get(key);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function put(key,value){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("files","readwrite");tx.objectStore("files").put(value,key);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 });
}
function restoredBody(meta){
 let index=0;
 return new ReadableStream({
  async pull(controller){
   if(index===meta.chunks){controller.close();return}
   try{
    const block=await get("chunk-"+index++);
    if(!block)throw Error("Saved voice model is incomplete. Clear this site's voice model storage and retry.");
    controller.enqueue(block);
   }catch(error){controller.error(error)}
  }
 });
}
export function installVoiceModelCache(report){
 const originalFetch=self.fetch.bind(self),state={warning:""};
 self.fetch=async(input,options)=>{
  const request=new Request(input,options);
  if(request.url!==MODEL||request.method!=="GET")return originalFetch(input,options);
  let meta;
  try{meta=await get("complete")}catch{state.warning="Model storage is unavailable; another visit may need a download."}
  if(meta){
   report("Loading saved voice model into memory · no download");
   if(request.headers.get("range")==="bytes=0-0"){
    const first=await get("chunk-0");
    return new Response(first.slice(0,1),{status:206,headers:{"Content-Length":"1","Content-Range":"bytes 0-0/"+meta.size}});
   }
   if(!request.headers.has("range"))return new Response(restoredBody(meta),{headers:{"Content-Type":"application/octet-stream","Content-Length":String(meta.size)}});
  }
  const response=await originalFetch(input,options);
  if(!response.ok||request.headers.has("range")||!response.body)return response;
  report("Downloading voice model for first use · it will be saved on this browser");
  const reader=response.body.getReader(),total=Number(response.headers.get("content-length"));
  let block=new Uint8Array(BLOCK),size=0,loaded=0,index=0,last=-1,save=!state.warning;
  async function flush(){
   if(!size)return;
   if(save){
    try{await put("chunk-"+index++,block.slice(0,size))}
    catch{save=false;state.warning="The browser could not save the voice model. Free some storage before your next visit."}
   }
   size=0;
  }
  const body=new ReadableStream({
   async pull(controller){
    try{
     const {value,done}=await reader.read();
     if(done){
      await flush();
      if(save)try{await put("complete",{size:loaded,chunks:index})}catch{state.warning="The voice model could not be saved."}
      report(state.warning||"Voice model saved · future visits reuse these files");
      controller.close();return;
     }
     loaded+=value.length;
     if(save){
      let offset=0;
      while(offset<value.length&&save){
       const count=Math.min(BLOCK-size,value.length-offset);
       block.set(value.subarray(offset,offset+count),size);size+=count;offset+=count;
       if(size===BLOCK)await flush();
      }
     }
     const percent=total?Math.floor(loaded/total*100):null;
     if(percent!==last){last=percent;report("Downloading voice model · "+(percent===null?Math.round(loaded/1048576)+" MB":percent+"%"))}
     controller.enqueue(value);
    }catch(error){controller.error(error)}
   },
   cancel(reason){return reader.cancel(reason)}
  });
  return new Response(body,{status:response.status,headers:response.headers});
 };
 return state;
}
