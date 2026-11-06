import test from "node:test";
import assert from "node:assert/strict";
import {demoSpeech,example,validateAssessment,score} from "../dist/practice.js";
import {readFile} from "node:fs/promises";
for(const dir of ["en","zh"]){
 test(dir+" demo, prepared rubric and real audio",async()=>{
 const speech=demoSpeech(dir);
 assert.equal(speech.source,speech.ideas.join("\n\n"));
 for(const [variant,expected] of [["faithful",100],["number",90],["omission",80]]){
 const r=example(dir,variant);
 assert.equal(validateAssessment(speech.ideas,r.transcript,r).score,expected);
 assert.equal(score(r.rows),expected);
 }
 const wav=await readFile(new URL("../dist/commute-"+dir+".wav",import.meta.url));
 assert.equal(wav.toString("ascii",0,4),"RIFF");
 assert.ok(wav.length>1_000_000);
 });
}
test("reject hallucinated evidence, missing rows and invalid credit",()=>{
 const r=example();for(const bad of [
 {...r,rows:r.rows.slice(1)},
 {...r,rows:r.rows.map(x=>({...x,evidence:"invented quote"}))},
 {...r,rows:r.rows.map(x=>({...x,points:.75}))}])
 assert.throws(()=>validateAssessment(r.ideas,r.transcript,bad));
});

