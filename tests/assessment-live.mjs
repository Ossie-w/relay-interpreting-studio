import {extract,grade} from '../dist/assessment.js';
import {readFile} from 'node:fs/promises';
const model=process.argv[2]||'deepseek-flash';
async function request(_,body){
 let key=(await readFile(new URL('../../api.txt',import.meta.url),'utf8')).match(/\bsk-[A-Za-z0-9_-]+/)?.[0];
 if(!key)throw Error('Missing test credential');
 try{const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('HTTP '+r.status);return r}finally{key=''}
}
const en='Next year the city will add thirty electric buses. Fares will not rise. Residents will be surveyed in June.';
const zh='明年本市将增购三十辆电动公交车。票价不会上涨。六月将征求居民意见。';
const cases=[
 {dir:'en',source:en,answers:[zh,zh.replace('三十','十三'),zh.split('六月')[0],zh.replace('不会','会')]},
 {dir:'zh',source:zh,answers:[en,en.replace('thirty','thirteen'),en.split(' Residents')[0],en.replace('not rise','rise')]}
];
let failures=0;
for(const speech of cases){
 const units=await extract(request,speech.source,model);
 const scores=await Promise.all(speech.answers.map(async(t,type)=>{
  const runs=[];
  for(let j=0;j<3;j++){
   const result=await grade(request,speech,t,units,model);
   const diagnostic=type===0||result.rows.some(r=>type===2?r.coverage===0&&/六月|June|survey|居民/i.test(r.source):r.accuracy<2&&r.coverage===2&&(type===1?/bus|辆|三十|30/i:/fare|票价|涨/i).test(r.source));
   if(!diagnostic)failures++;
   runs.push(result.contentScore);
  }
  console.log(speech.dir,type,runs.join(','));return runs;
 }));
 if(scores.some(v=>Math.max(...v)-Math.min(...v)>5)||Math.min(...scores[0])<=Math.max(...scores.slice(1).flat()))failures++;
}
console.log('Quality gate failures:',failures);process.exitCode=failures?1:0;
