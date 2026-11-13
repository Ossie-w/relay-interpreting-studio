import test from 'node:test';
import assert from 'node:assert/strict';
import {fitManuscript,recoverManuscript,joinPassages,isSourceLanguage,isOutline} from '../dist/manuscript.js';
import {speechUnits,textFits,targetUnits} from '../dist/timing.js';

test('retain only complete JSON strings from a token-limited response',()=>{
 const first='The city will add 30 buses. It calls the trial "Better journeys".';
 const second='票价保持不变。';
 const raw='{"title":"A new service","ideas":['+JSON.stringify(first)+','+JSON.stringify(second)+',"This unfinished passage';
 assert.deepEqual(recoverManuscript(raw),{title:'A new service',ideas:[first,second]});
 assert.deepEqual(recoverManuscript(raw.replace('"ideas"','"paragraphs"')),{title:'A new service',ideas:[first,second]});
 assert.deepEqual(recoverManuscript('{"title":"A new service","paragraph_1":'+JSON.stringify(first)+',"paragraph_2":'+JSON.stringify(second)+',"paragraph_3":"unfinished'),{title:'A new service',ideas:[first,second]});
 assert.equal(recoverManuscript('{"title":"Broken'),null);
 assert.equal(recoverManuscript('{"title":"Test","ideas":["Partial'),null);
});
test('overlong English and Chinese drafts fit at intact sentence boundaries',()=>{
 for(const dir of ['en','zh'])for(const seconds of [60,75,300]){
  const target=targetUnits(seconds,dir);
  const sentence=dir==='en'?'The trial will add 30 buses to the busiest route next year.':'公交公司明年将增加三十辆电动公交车。';
  const ideas=Array.from({length:100},()=>sentence);
  const result=fitManuscript(ideas,dir,target);
  assert.ok(textFits(speechUnits(result.join('\n\n'),dir),target));
  assert.ok(result.every(x=>x===sentence),'Never split a word or number to reach the target');
 }
});
test('a draft just below target survives for continuation; an unusably long sentence is not cut',()=>{
 const first='word '.repeat(120).trim()+'.',second='detail '.repeat(60).trim()+'.';
 assert.deepEqual(fitManuscript([first,second],'en',153),[first]);
 assert.deepEqual(fitManuscript([second],'en',20),[second]);
});
test('validate new continuation language independently and exclude exact repeated passages',()=>{
 assert.equal(isSourceLanguage('公交服务改善。','en'),false);
 assert.equal(isSourceLanguage('An English continuation.','zh'),false);
 assert.equal(isSourceLanguage('公交服务改善。','zh'),true);
 assert.equal(isOutline(['第一部分：志愿者的故事'],'zh'),true);
 assert.equal(isOutline(['公交公司明年将增加三十辆公交车。'],'zh'),false);
 assert.deepEqual(joinPassages(['The city will add 30 buses.'],['The city will add 30 buses.','Fares will stay the same.']),['The city will add 30 buses.','Fares will stay the same.']);
 assert.deepEqual(joinPassages(['The city will add 30 buses.'],['The city will add 30 buses. Fares will stay the same.']),['The city will add 30 buses.','Fares will stay the same.']);
});
