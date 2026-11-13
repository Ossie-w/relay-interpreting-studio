// Large ASR weights exceed some browsers' per-response Cache API limits.
// Store 4 MiB blocks, marking a file complete only after the last transaction.
const ROOT='https://huggingface.co/onnx-community/whisper-small/resolve/main/onnx/';
const ALLOWED=new Set(['encoder_model.onnx','decoder_model_merged_q4.onnx'].map(name=>ROOT+name));
const BLOCK=4*1024*1024;
export function installASRModelCache(report=()=>{}){
 const originalFetch=self.fetch.bind(self);let dbPromise;
 const database=()=>dbPromise??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('relay-asr-model-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('blocks');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{dbPromise=null;reject(request.error)};
  request.onblocked=()=>{dbPromise=null;reject(Error('Model storage is blocked'))};
 });
 async function get(key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('blocks').objectStore('blocks').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function put(key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('blocks','readwrite');tx.objectStore('blocks').put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error)})}
 self.fetch=async(input,options)=>{
  const request=new Request(input,options),url=request.url;
  if(!ALLOWED.has(url)||!['GET','HEAD'].includes(request.method))return originalFetch(input,options);
  let meta,save=true;
  try{meta=await get(url)}catch{save=false;report('Browser storage unavailable; model files may need downloading next time.')}
  if(meta){
   if(request.method==='HEAD')return new Response(null,{headers:{'Content-Length':String(meta.size),'Content-Type':'application/octet-stream'}});
   // Transformers.js probes one byte to detect external ONNX weight data.
   if(request.headers.get('range')==='bytes=0-0'){
    const first=await get(url+':0');
    if(first)return new Response(first.slice(0,1),{status:206,headers:{'Content-Length':'1','Content-Range':'bytes 0-0/'+meta.size}});
   }
   if(request.headers.has('range'))return originalFetch(input,options);
   report('Loading saved Whisper small model · no model download');let index=0;
   return new Response(new ReadableStream({async pull(controller){
    try{if(index===meta.chunks){controller.close();return}const block=await get(url+':'+index++);if(!block)throw Error('Saved ASR model is incomplete. Clear this site’s model storage and retry.');controller.enqueue(block)}catch(e){controller.error(e)}
   }}),{headers:{'Content-Length':String(meta.size),'Content-Type':'application/octet-stream'}});
  }
  const response=await originalFetch(input,options);
  if(!response.ok||!response.body||request.method==='HEAD'||request.headers.has('range'))return response;
  const reader=response.body.getReader();let block=new Uint8Array(BLOCK),filled=0,size=0,index=0;
  async function flush(){if(!filled)return;if(save)try{await put(url+':'+index++,block.slice(0,filled))}catch{save=false;report('Model cache is full; this session can continue, but next time may require a download.')}filled=0}
  return new Response(new ReadableStream({async pull(controller){try{
   const {done,value}=await reader.read();
   if(done){await flush();if(save)try{await put(url,{chunks:index,size})}catch{report('Model files could not be saved for next time.')}controller.close();return}
   size+=value.length;
   for(let offset=0;save&&offset<value.length;){const n=Math.min(BLOCK-filled,value.length-offset);block.set(value.subarray(offset,offset+n),filled);filled+=n;offset+=n;if(filled===BLOCK)await flush()}
   controller.enqueue(value);
  }catch(e){controller.error(e)}},cancel:reason=>reader.cancel(reason)}),{status:response.status,headers:response.headers});
 };
}
