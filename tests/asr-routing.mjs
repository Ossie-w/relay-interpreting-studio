// Controlled runtime checks for worker coordination and failure recovery.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 for(const gpu of [true,false]){
  const page=await browser.newPage();let fail=true;
  const worker=await readFile(new URL('../dist/transcription-worker.js',import.meta.url),'utf8');
  await page.route('**/transcription-worker.js?*',r=>r.fulfill({contentType:'text/javascript',body:`Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>${gpu?'({})':'null'}}});\n`+worker}));
  await page.route('**/transformers.min.js',r=>r.fulfill({contentType:'text/javascript',body:`
   export const env={};
   export async function pipeline(task,model,options){await new Promise(r=>setTimeout(r,100));return async(samples,opts)=>{
    if(!samples.length)throw Error('No audio');
    const r=await fetch('/test-recognition');if(!r.ok)throw Error('Test runtime failure');
    return {text:opts.language==='chinese'?'明年增加十三辆公交车。':'Thirteen buses next year.'};
   }}
  `}));
  await page.route('**/test-recognition',r=>{if(fail){fail=false;return r.fulfill({status:503,body:'fail'})}return r.fulfill({body:'ok'})});
  await page.goto(origin+'/#history');await page.locator('#offlineExercise').click();
  assert.equal(await page.locator('#asrMode').inputValue(),'enhanced');
  await page.locator('#uploadRecording').setInputFiles(fileURLToPath(new URL('../dist/commute-zh.wav',import.meta.url)));
  await page.waitForFunction(()=>!document.querySelector('#retryASR').hidden);
  assert.match(await page.locator('#transcriptStatus').innerText(),/Test runtime failure/);
  assert.ok(await page.locator('#replay').getAttribute('src'),'Failed recognition preserves recording');
  await page.locator('#asrMode').selectOption('lightweight');
  await page.locator('#retryASR').click();
  await page.waitForFunction(()=>document.querySelector('#corrected').value);
  assert.equal(await page.locator('#corrected').inputValue(),'明年增加十三辆公交车。','Preserve a learner’s wrong number; do not correct from the source');
  assert.match(await page.locator('#transcriptStatus').innerText(),/tiny/);
  const result=await page.evaluate(async()=>{
   const a=await import('./transcription.js?v=20261113c');a.setTranscriptionMode('enhanced');
   const blob=await(await fetch('./commute-en.wav')).blob();a.prepareTranscription();
   const english=await a.transcribeRecording(blob,'zh',()=>{});
   const chinese=await a.transcribeRecording(blob,'en',()=>{});
   return {english,chinese,engine:a.transcriptionEngine()};
  });
  assert.equal(result.english,'Thirteen buses next year.');assert.match(result.chinese,/十三/);assert.match(result.engine,gpu?/small/:/tiny/);
  await page.goto(origin+'/#history');await page.reload();await page.locator('#offlineExercise').click();assert.equal(await page.locator('#asrMode').inputValue(),'lightweight');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();console.log('ASR warmup, direction, error/retry, saved preference and mobile width passed. GPU available:',gpu);
 }
}finally{await browser.close();server.kill()}
