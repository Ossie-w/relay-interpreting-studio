import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
process.on('exit',()=>server.kill());const [ready]=await once(server.stdout,'data');const origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/ai\.js\?/,r=>r.fulfill({contentType:'text/javascript',body:`
 export async function generateSpeech(){};export async function reviseSpeechDuration(){};
 export async function transcribe(){return 'My recorded interpretation.'};
 export async function assess(s,t){if(!window.assessmentWorks)throw Error('Assessment evidence could not be verified.');return {rows:s.ideas.map(source=>({source,evidence:t,points:1,reason:'Meaning preserved'})),score:100,suggestion:'Practise the next passage.'}}
 `}));
 await page.goto(origin+'/#history');await page.click('#offlineExercise');
 await page.fill('#corrected','My typed interpretation.');await page.click('#evaluate');
 await page.waitForFunction(()=>document.querySelector('#sessionstatus').textContent.includes('Practice saved to history. Assessment unavailable'));
 let records=await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-history')));assert.equal(records.length,1);assert.equal(records[0].score,undefined);assert.equal(records[0].transcript,'My typed interpretation.');
 await page.reload();await page.goto(origin+'/#history');await page.locator('#history [data-id]').first().click();
 assert.match(await page.locator('#report').innerText(),/My typed interpretation/);assert.match(await page.locator('#report').innerText(),/NOT SCORED/);
 await page.click('#retryAssessment');await page.waitForFunction(()=>document.querySelector('#reportStatus').textContent.includes('remains saved'));
 await page.evaluate(()=>window.assessmentWorks=true);await page.click('#retryAssessment');await page.waitForSelector('#report .score');assert.equal(await page.locator('#report .score').innerText(),'100%');
 records=await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-history')));assert.equal(records.length,1);
 await page.click('.close');await page.click('#offlineExercise');
 // Store a real WAV through upload, then verify persisted audio survives reload.
 const wav=await page.evaluate(async()=>{const {encodeWave}=await import('./recording.js');const pcm=new Float32Array(24000);for(let i=0;i<pcm.length;i++)pcm[i]=Math.sin(i*2*Math.PI*440/24000)*.2;return Array.from(new Uint8Array(await encodeWave([pcm],24000).blob.arrayBuffer()))});
 await page.locator('#uploadRecording').setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});
 await page.waitForFunction(()=>document.querySelector('#corrected').value==='My recorded interpretation.');
 await page.click('#saveOnly');await page.waitForSelector('#report audio');
 await page.reload();await page.goto(origin+'/#history');await page.locator('#history [data-id]').first().click();await page.waitForSelector('#report audio');
 const duration=await page.locator('#report audio').evaluate(a=>new Promise(resolve=>{if(a.readyState)resolve(a.duration);else a.onloadedmetadata=()=>resolve(a.duration)}));assert.ok(duration>.9);
 await page.click('.close');await page.click('#offlineExercise');await page.fill('#corrected','Storage failure test');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='relay-history')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)}});
 await page.click('#saveOnly');assert.match(await page.locator('#sessionstatus').innerText(),/could not save/);assert.equal(await page.locator('#corrected').inputValue(),'Storage failure test');
 assert.deepEqual(errors,[]);console.log('PASS: assessment failure saves, reload recovery, retry updates same record, audio survives refresh, storage failure remains truthful');
}finally{await browser.close();server.kill()}
