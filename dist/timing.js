export const timingTolerance=0.05;
export const speechUnits=(source,dir)=>dir==="en"?(source.trim().match(/\S+/g)||[]).length:(source.match(/[\u3400-\u9fff]/g)||[]).length;
export const targetUnits=(seconds,dir)=>Math.round(seconds*(dir==="en"?2.55:4));
export const textFits=(count,target)=>Math.abs(count-target)<=Math.max(3,target*0.08);
export const audioFits=(seconds,target)=>Number.isFinite(seconds)&&Math.abs(seconds-target)<=timingTolerance;

// Waveform-similarity overlap-add: change duration slightly without changing
// pitch. Large mismatches must be fixed in the manuscript, never stretched.
export function fitPCM(input,sampleRate,target){
 const length=Math.round(sampleRate*target),ratio=length/input.length;
 if(Math.abs(ratio-1)>0.1)throw Error("The manuscript needs rewriting before duration adjustment.");
 if(length===input.length)return input;
 const window=Math.round(sampleRate*0.04),hop=Math.floor(window/2),search=Math.round(sampleRate*0.008);
 if(input.length<window*3)throw Error("Not enough speech for timing adjustment.");
 const output=new Float32Array(length);
 output.set(input.subarray(0,window));
 for(let out=hop;out<length;out+=hop){
  const expected=Math.round(out/ratio);
  const min=Math.max(0,expected-search),max=Math.min(input.length-window,expected+search);
  let best=Math.max(0,Math.min(input.length-window,expected)),bestScore=-Infinity;
  for(let candidate=min;candidate<=max;candidate+=Math.max(1,Math.floor(sampleRate/12000))){
   let dot=0,a=0,b=0;
   for(let j=0;j<hop&&out+j<length;j+=4){
    const x=output[out+j],y=input[candidate+j];dot+=x*y;a+=x*x;b+=y*y;
   }
   const correlation=dot/Math.sqrt(a*b+1e-14);
   if(correlation>bestScore){bestScore=correlation;best=candidate}
  }
  for(let j=0;j<window&&out+j<length;j++){
   const value=input[best+j]||0;
   output[out+j]=j<hop?output[out+j]*(1-j/hop)+value*(j/hop):value;
  }
 }
 // Retain the complete last syllable and natural trailing silence.
 const tail=Math.min(hop,length);
 for(let j=0;j<tail;j++){
  const mix=j/tail,at=length-tail+j;
  output[at]=output[at]*(1-mix)+input[input.length-tail+j]*mix;
 }
 return output;
}
