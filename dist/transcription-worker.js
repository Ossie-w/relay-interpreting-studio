let recognizerPromise=null,report=()=>{};
self.onmessage=async({data:{id,samples,dir}})=>{
 report=status=>postMessage({id,status});
 try{
  if(!recognizerPromise)recognizerPromise=(async()=>{
   report("Loading Whisper · saved files are reused; first use downloads missing files");
   const {pipeline,env}=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js");
   env.allowLocalModels=false;env.useBrowserCache=true;
   return pipeline("automatic-speech-recognition","Xenova/whisper-tiny",{
    device:"wasm",dtype:"q8",
    progress_callback:r=>{if(r.status==="progress")report("Loading Whisper files · "+Math.round(r.progress)+"%")}
   });
  })().catch(e=>{recognizerPromise=null;throw e});
  const recognize=await recognizerPromise;
  report("Transcribing your recording in "+(dir==="en"?"Mandarin":"English")+"…");
  const result=await recognize(samples,{language:dir==="en"?"chinese":"english",task:"transcribe",chunk_length_s:30,stride_length_s:5});
  postMessage({id,text:result.text.trim()});
 }catch(error){postMessage({id,error:error.message||"Transcription failed."})}
};
