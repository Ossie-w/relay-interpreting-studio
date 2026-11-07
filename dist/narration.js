// Model files and finished tracks have separate caches. A new manuscript still
// needs local synthesis; reopening an identical manuscript can reuse its track.
const CACHE="relay-narration-v1";
const VERSION="kokoro-zh-1.1-fp32-maple-001-speed1";
let worker=null,pending=null,generation=0;
async function keyFor(source,lang){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(VERSION+"\n"+lang+"\n"+source));
 return new URL("/__relay_audio__/"+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join(""),location.origin).href;
}
export async function cachedNarration(source,lang){
 try{
  const cache=await caches.open(CACHE),response=await cache.match(await keyFor(source,lang));
  return response?await response.blob():null;
 }catch{return null}
}
async function saveNarration(source,lang,blob){
 try{
  const cache=await caches.open(CACHE),key=await keyFor(source,lang);
  await cache.put(key,new Response(blob,{headers:{"Content-Type":"audio/wav"}}));
  const keys=await cache.keys();
  for(const old of keys.slice(0,Math.max(0,keys.length-24)))await cache.delete(old);
  return true;
 }catch{return false}
}
export function cancelNarration(){
 generation++;
 if(!pending)return;
 const reject=pending.reject;pending=null;worker?.terminate();worker=null;
 reject(new DOMException("Preparation cancelled.","AbortError"));
}
export async function renderNarration(source,lang,status){
 if(pending)throw Error("Another narration is still being prepared.");
 const token=generation;
 const cached=await cachedNarration(source,lang);
 if(token!==generation)throw new DOMException("Preparation cancelled.","AbortError");
 if(cached)return {blob:cached,saved:true,reused:true};
 navigator.storage?.persist?.().catch(()=>{});
 if(pending)throw Error("Another narration is still being prepared.");
 if(!worker){
  worker=new Worker(new URL("./narration-worker.js",import.meta.url),{type:"module"});
  worker.onerror=e=>{
   const job=pending;pending=null;worker?.terminate();worker=null;
   job?.reject(Error(e.message||"Unable to start the voice engine."));
  };
  worker.onmessage=({data})=>{
   if(!pending||data.id!==pending.id)return;
   if(data.blob||data.error){
    const job=pending;pending=null;
    data.error?job.reject(Error(data.error)):job.resolve(data);
   }else pending.status(data.status);
  };
 }
 const result=await new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();pending={id,resolve,reject,status};
  status("Opening voice engine · saved model files are reused");
  worker.postMessage({id,source,lang});
 });
 return {...result,saved:await saveNarration(source,lang,result.blob),reused:false};
}
