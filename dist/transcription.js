let worker=null,pending=null;
export async function transcribeRecording(blob,dir,status){
 if(pending)throw Error("A recording is already being transcribed.");
 status("Preparing your recording for automatic transcription…");
 const context=new AudioContext();let samples;
 try{
  const buffer=await context.decodeAudioData(await blob.arrayBuffer());
  const offline=new OfflineAudioContext(1,Math.max(1,Math.ceil(buffer.duration*16000)),16000);
  const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();
  samples=(await offline.startRendering()).getChannelData(0);
 }finally{await context.close()}
 navigator.storage?.persist?.().catch(()=>{});
 if(!worker){
  worker=new Worker(new URL("./transcription-worker.js",import.meta.url),{type:"module"});
  worker.onerror=e=>{
   const job=pending;pending=null;worker?.terminate();worker=null;
   if(job){clearTimeout(job.timeout);job.reject(Error(e.message||"Unable to start transcription."))}
  };
  worker.onmessage=({data})=>{
   if(!pending||data.id!==pending.id)return;
   if(data.error||typeof data.text==="string"){
    const job=pending;pending=null;clearTimeout(job.timeout);
    data.error?job.reject(Error(data.error)):job.resolve(data.text);
   }else pending.status(data.status);
  };
 }
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const timeout=setTimeout(()=>{
   if(pending?.id!==id)return;
   pending=null;worker?.terminate();worker=null;
   reject(Error("Transcription took too long. Your recording is kept; retry when the model connection is available."));
  },600000);
  pending={id,resolve,reject,status,timeout};
  worker.postMessage({id,dir,samples},[samples.buffer]);
 });
}
