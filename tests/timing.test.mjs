import test from "node:test";
import assert from "node:assert/strict";
import {audioFits,fitPCM,textFits,targetUnits,speechUnits} from "../dist/timing.js";
test("reject the reported 27-second recording for a 75-second target",()=>{
 assert.equal(audioFits(27,75),false);
 assert.equal(textFits(77,targetUnits(75,"en")),false);
 assert.equal(speechUnits("今年新增三十辆公交车。","zh"),10);
});
test("small tempo corrections preserve pitch and produce the exact sample count",()=>{
 for(const target of [60,75,300]){
  const rate=8000,duration=target*.97,frequency=220;
  const input=Float32Array.from({length:Math.round(duration*rate)},(_,i)=>.4*Math.sin(2*Math.PI*frequency*i/rate));
  const output=fitPCM(input,rate,target);
  assert.equal(output.length,rate*target);
  let crossings=0;
  for(let i=1;i<output.length;i++)if(output[i-1]<=0&&output[i]>0)crossings++;
  assert.ok(Math.abs(crossings/target-frequency)<1,"Tempo correction should not transpose the voice");
  assert.ok(output.every(Number.isFinite));
 }
 assert.throws(()=>fitPCM(new Float32Array(27*8000),8000,75),/rewriting/);
});
