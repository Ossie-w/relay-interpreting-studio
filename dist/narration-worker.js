import {encodeWave} from "./recording.js";

self.onmessage=async ({data:{source,lang}})=>{
 try{
  const {KokoroTTS,env}=await import("https://cdn.jsdelivr.net/npm/@uzen/kokoro-js@1.2.4/dist/kokoro.web.js");
  env.allowLocalModels=false;
  const model="onnx-community/Kokoro-82M-v1.1-zh-ONNX";
  const tts=await KokoroTTS.from_pretrained(model,{
   device:"wasm",dtype:"fp32",
   voicePath:"https://huggingface.co/"+model+"/resolve/main/voices",
   progress_callback:r=>{
    if(r.status==="progress" && Number.isFinite(r.progress))postMessage({status:"Loading natural voice · "+r.file+" · "+Math.round(r.progress)+"%"});
   }
  });
  const chunks=[];
  let read=0,length=0;
  const voice=lang==="en"?"af_maple":"zf_001";
  for await(const {audio,text} of tts.stream(source,{voice,speed:1,maxChunkLength:lang==="en"?270:88})){
   chunks.push(audio.audio);length+=audio.audio.length;read+=text.length;
   postMessage({status:"Preparing continuous narration · "+Math.min(99,Math.round(100*read/source.length))+"%"});
  }
  if(!length)throw Error("No audio was generated.");
  const pcm=new Float32Array(length);
  let offset=0;
  for(const chunk of chunks){pcm.set(chunk,offset);offset+=chunk.length}
  const wave=encodeWave([pcm],24000);
  if(wave.quiet || !pcm.every(Number.isFinite))throw Error("Voice synthesis produced no usable sound.");
  postMessage({blob:wave.blob});
 }catch(error){postMessage({error:error.message||"Voice model unavailable."})}
};
