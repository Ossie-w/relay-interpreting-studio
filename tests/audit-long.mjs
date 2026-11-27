import assert from 'node:assert/strict';
import {completeAudit} from '../dist/assessment-audit.js';
const pairs=Array.from({length:15},(_,i)=>({id:i+1,source:'Pilot programme, serves 30 students.',learner:'试点项目，为30名学生服务。'}));
const counts=new Map();
const checks=await completeAudit(pairs,async group=>({checks:group.filter(p=>{const n=counts.get(p.id)||0;counts.set(p.id,n+1);return ![9,12].includes(p.id)||n>0}).reverse().map(p=>({id:p.id,missingIds:p.id===12?[2]:[],expressionIds:[],note:p.id===12?'测试：核查数量细节':'完整'}))}));
assert.equal(checks.length,15);assert.equal(checks[11].missing,'serves 30 students.');assert.equal(counts.get(9),2);assert.equal(counts.get(12),2);assert.equal(counts.get(1),1);
console.log('15-unit audit: items 9 and 12 recovered without rechecking completed items');
