import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanTranscript,transcriptBatches,translateBatch} from '../dist/learning.js';

test('plugin header and stage cues removed while spoken words survive',()=>{
 const source=cleanTranscript('(16) Tourism | TEDx - YouTube\nhttps://www.youtube.com/watch?\nv=Imbj0F-gUSw\nTranscript:\n(17:09) [applause] We can save tourism [clears throat] from itself.');
 assert.equal(source,'We can save tourism from itself.');
});
test('short continuations stay with their context and long bilingual paragraphs are bounded',()=>{
 const en='Your kids ask, “Can we go now?” after 5 minutes. You may have done this yourself. ';
 const zh='学生会比较不同的选择，理解每种选择的成本和收益，再根据预算决定下一步应该怎么办。';
 for(const [text,dir,cap] of [[en,'en',340],[zh,'zh',150]]){
  const input=text.repeat(18),rows=transcriptBatches(input,dir).flat();
  assert.ok(rows.length>1&&rows.every(x=>x.length<=cap));
  assert.equal(rows.join('').replace(/\s/g,''),input.replace(/\s/g,''));
  assert.ok(!rows.includes('after 5 minutes.'));
 }
});
test('translation rejects merged rows and restores numbered paragraph mapping',async()=>{
 let attempts=0;
 const request=async()=>({json:async()=>({choices:[{message:{content:JSON.stringify({pairs:++attempts===1?[{end:2,translation:'错位'}]:[{end:1,translation:'第一段'},{end:2,translation:'第二段'}]})}}]})});
 const rows=await translateBatch(request,['First.','Second.'],'en','test');
 assert.deepEqual(rows.map(x=>x.translation),['第一段','第二段']);
});
