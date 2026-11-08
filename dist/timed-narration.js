import {renderNarration} from "./narration.js";
import {audioFits,fitPCM,speechUnits} from "./timing.js";
import {encodeWave} from "./recording.js";
const CACHE="relay-timed-narration-v1";
async function key(speech){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([speech.source,speech.dir,speech.target])));
 return new URL("/__relay_timed__/"+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join(""),location.origin).href;
}
export async function cachedTimedNarration(speech){
 try{return await (await (await caches.open(CACHE)).match(await key(speech)))?.blob()||null}catch{return null}
}
async function decode(blob){
 const context=new AudioContext();
 try{return await context.decodeAudioData(await blob.arrayBuffer())}finally{await context.close()}
}
export async function prepareTimedSpeech(original,status,revise,active=()=>true){
 let speech={...original};
 const cached=await cachedTimedNarration(speech);
 if(cached&&audioFits((await decode(cached)).duration,speech.target))return {speech,blob:cached,saved:true,reused:true};
 for(let pass=0;pass<3;pass++){
  if(!active())throw new DOMException("Preparation cancelled.","AbortError");
  const result=await renderNarration(speech.source,speech.dir,status);
  if(!active())throw new DOMException("Preparation cancelled.","AbortError");
  const audio=await decode(result.blob),ratio=speech.target/audio.duration;
  status("Checking actual narration length · "+audio.duration.toFixed(1)+"s / "+speech.target+"s");
  if(Math.abs(ratio-1)<=0.1){
   const pcm=fitPCM(audio.getChannelData(0),audio.sampleRate,speech.target),wave=encodeWave([pcm],audio.sampleRate);
   let saved=false;
   try{
    const cache=await caches.open(CACHE);await cache.put(await key(speech),new Response(wave.blob));
    const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-24)))await cache.delete(old);
    saved=true;
   }catch{}
   return {...result,speech:{...speech,estimatedSeconds:speech.target,timingVerified:true},blob:wave.blob,saved,reused:false};
  }
  if(pass<2){
   status("Narration is "+audio.duration.toFixed(1)+"s; "+(ratio>1?"expanding":"shortening")+" the manuscript to reach "+speech.target+"s…");
   speech=await revise(speech,Math.round(speechUnits(speech.source,speech.dir)*ratio),status);
  }
 }
 throw Error("The narration could not meet the selected duration. No mismatched audio was substituted. Try Regenerate.");
}
