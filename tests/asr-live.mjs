// Real enhanced ASR, language switching, concurrent warmup, and persistent cache.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();let requests=0;
 context.on('request',r=>{if(/whisper-small.*\.onnx(?:$|\?)/.test(r.url())){requests++;console.log('Model request',r.method(),r.url(),r.headers()['range']||'')}});
 page.on('console',m=>{if(m.text().startsWith('ASR:'))console.log(m.text())});
 await page.goto(origin+'/#history');
 async function transcribe(lang){return page.evaluate(async lang=>{
  const asr=await import('./transcription.js?v=20261113c');
  const blob=await(await fetch('./commute-'+lang+'.wav')).blob();
  let last='';const report=text=>{const stage=text.split(' · ')[0];if(stage!==last){last=stage;console.log('ASR: '+text)}};
  asr.prepareTranscription(report);
  const start=performance.now(),text=await asr.transcribeRecording(blob,lang==='en'?'zh':'en',report);
  return {text,engine:asr.transcriptionEngine(),elapsedMs:performance.now()-start};
 },lang)}
 const en=await transcribe('en');assert.match(en.text,/30 electric buses/i);assert.match(en.engine,/small/);console.log('Enhanced English',JSON.stringify(en));
 const zh=await transcribe('zh');assert.match(zh.text,/30輛|30辆|三十/);console.log('Enhanced Mandarin',JSON.stringify(zh));
 const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('relay-asr-model-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('blocks').objectStore('blocks').getAllKeys();q.onsuccess=()=>{resolve(q.result.filter(k=>k.endsWith('.onnx')));db.close()};q.onerror=()=>reject(q.error)}}));
 assert.equal(stored.length,2,'Both model files have complete persisted manifests');
 const before=requests;await page.reload();
 await context.route(/whisper-small.*\.onnx/,r=>r.abort());
 const cached=await transcribe('en');assert.match(cached.text,/30 electric buses/i);assert.equal(requests,before,'Refresh must not redownload model weights');
 console.log('Enhanced cache after reload, weight requests blocked',JSON.stringify(cached));
}finally{await browser.close();server.kill()}
