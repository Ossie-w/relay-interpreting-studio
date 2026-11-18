import test from 'node:test';
import assert from 'node:assert/strict';
import {measureDelivery} from '../dist/delivery.js';
const rate=16000;
const transcript='Tomorrow the city will add thirty new electric buses and keep fares at current levels.'.repeat(3);
function pcm(gaps){
 const data=new Float32Array(18*rate).fill(.08);
 for(const [a,b] of [[0,2],[16,18],...gaps])data.fill(0,a*rate,b*rate);
 return data;
}
test('delivery excludes edge silence, breaths and manual seams; repeated holds are seekable',()=>{
 const score=(gaps,marks=[])=>measureDelivery(pcm(gaps),rate,transcript,'zh',marks,18);
 assert.equal(score([]).points,20);assert.equal(score([[4,4.5]]).points,20);
 const pauses=[[4,6.5],[10,13]];
 const stalled=score(pauses);assert.ok(stalled.points<20);assert.equal(stalled.gaps.length,2);
 assert.ok(Math.abs(stalled.gaps[0].start-4)<.05);assert.equal(score(pauses,[5,12]).points,20);
});
test('quiet, truncated or implausibly sparse transcripts are unscored',()=>{
 for(const r of [measureDelivery(new Float32Array(rate*18),rate,transcript,'zh'),measureDelivery(pcm([]),rate,transcript,'zh',[],25),measureDelivery(pcm([]),rate,'Hello','zh')])assert.equal(r.points,undefined);
});
