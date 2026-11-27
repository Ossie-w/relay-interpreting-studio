import assert from 'node:assert/strict';
import {completeAudit,parts} from '../dist/assessment-audit.js';
const pairs=[{id:3,source:'specific source',learner:'specific target'},{id:7,source:'other source',learner:'other target'}];
const ok=id=>({id,missing:'',expression:''});
assert.deepEqual((await completeAudit(pairs,async()=>({checks:[ok(7),ok(3)]}))).map(c=>c.id),[3,7]);
let calls=[];
await completeAudit(pairs,async p=>{calls.push(p.map(x=>x.id));return {checks:calls.length===1?[ok(3)]:[ok(7)]}});
assert.deepEqual(calls,[[3,7],[7]]);
let n=0;await completeAudit(pairs,async p=>{if(!n++)throw new SyntaxError('truncated');return {checks:p.map(x=>ok(x.id))}});
await assert.rejects(completeAudit(pairs,async()=>({checks:[]})),/自动补查/);
await assert.rejects(completeAudit(pairs,async()=>({checks:[{...ok(3),missing:'invented'},ok(7)]})),/自动补查/);
await assert.rejects(completeAudit(pairs,async()=>{throw Error('401')}),/401/);
console.log('Audit recovery: all checks passed');

const normalized=await completeAudit([{id:13,source:"The ‘pilot’ programme",learner:'这 是试点'}],async()=>({checks:[{id:1,missing:"The 'pilot' programme",expression:'这是试点'}]}));
assert.equal(normalized[0].id,13);
assert.equal(normalized[0].missing,"The ‘pilot’ programme");
assert.equal(normalized[0].expression,'这 是试点');
let repair=0;
await completeAudit([pairs[0]],async (p,feedback)=>{
 if(repair++) {assert.match(feedback[0].correction,/Previous quotes/);return {checks:[ok(3)]}}
 return {checks:[{...ok(3),missing:'not a quote'}]};
});
const {readFile}=await import('node:fs/promises');
const code=(await readFile(new URL('../dist/assessment.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const {grade}=await import('data:text/javascript,'+encodeURIComponent('const parts='+parts.toString()+';const completeAudit='+completeAudit.toString()+';const exactQuote='+ (await import('../dist/assessment-audit.js')).exactQuote.toString()+';'+code));
const long='这是保留完整证据的长句'.repeat(30)+'。';
let seen='';
await grade(async (kind,body)=>{
 const input=JSON.parse(body.messages[1].content);
 if(input.pairs){seen=input.pairs[0].learner;return {json:async()=>({choices:[{message:{content:JSON.stringify({checks:[ok(1)]})}}]})}}
 return {json:async()=>({choices:[{message:{content:JSON.stringify({rows:[{unit:1,coverage:2,accuracy:2,vocabulary:2,evidence:[1],reason:'准确'}],weakness:'练习',strength:'准确',suggestion:'继续',reference:'参考',bank:Array.from({length:5},()=>({source:'a',target:'甲'}))})}}]})};
},{dir:'en',source:'Source.'},long,['Source.']);
assert.equal(seen,long);
console.log('Long evidence, normalized quotes and repair feedback passed');

const indexed=await completeAudit([{id:12,source:'Pilot programmes, not permanent policy.',learner:'这些课程，不是政策。'}],async p=>{
 assert.ok(p[0].sourceParts.length===2);
 return {checks:[{id:12,missingIds:[1],expressionIds:[],note:'遗漏试点性质'}]};
});
assert.equal(indexed[0].missing,'Pilot programmes,');
await assert.rejects(completeAudit([pairs[0]],async()=>({checks:[{id:3,missingIds:[999],expressionIds:[],note:'越界'}]})),/自动补查/);
console.log('Indexed audit rejects invalid IDs and resolves valid evidence');
