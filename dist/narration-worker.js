import {encodeWave} from "./recording.js";
import {installVoiceModelCache} from "./model-cache.js";
import {installVoiceAssets} from "./voice-assets.js";

let ttsPromise=null,report=()=>{};
const modelCache=installVoiceModelCache(text=>report(text));
installVoiceAssets();
self.onmessage=async ({data:{id,source,lang}})=>{
 report=status=>postMessage({id,status});
 try{
  if(!ttsPromise)ttsPromise=(async()=>{
  const {KokoroTTS,env}=await import("https://cdn.jsdelivr.net/npm/@uzen/kokoro-js@1.2.4/dist/kokoro.web.js");
  env.allowLocalModels=false;
  const model="onnx-community/Kokoro-82M-v1.1-zh-ONNX";
  return KokoroTTS.from_pretrained(model,{
   device:"wasm",dtype:"fp32",
   voicePath:"https://huggingface.co/"+model+"/resolve/main/voices",
   progress_callback:r=>{
    if(r.status==="progress" && !r.file?.endsWith(".onnx") && Number.isFinite(r.progress))report("Loading voice files · saved files are reused · "+Math.round(r.progress)+"%");
   }
  });
  })().catch(e=>{ttsPromise=null;throw e});
  const tts=await ttsPromise;
  const chunks=[];
  report("Synthesizing this manuscript · 0% (not a model download)");
  let read=0,length=0;
  const voice=lang==="en"?"af_maple":"zf_001";
  for await(const {audio,text} of tts.stream(source,{voice,speed:1,maxChunkLength:lang==="en"?270:88})){
   chunks.push(audio.audio);length+=audio.audio.length;read+=text.length;
   report("Synthesizing this manuscript · "+Math.min(99,Math.round(100*read/source.length))+"% (not a model download)");
  }
  if(!length)throw Error("No audio was generated.");
  const pcm=new Float32Array(length);
  let offset=0;
  for(const chunk of chunks){pcm.set(chunk,offset);offset+=chunk.length}
  const wave=encodeWave([pcm],24000);
  if(wave.quiet || !pcm.every(Number.isFinite))throw Error("Voice synthesis produced no usable sound.");
  postMessage({id,blob:wave.blob,warning:modelCache.warning});
 }catch(error){postMessage({id,error:error.message||"Voice model unavailable."})}
};
