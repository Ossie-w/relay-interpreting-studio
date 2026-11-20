import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','ignore']});
const [ready]=await once(server.stdout,'data');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
const p=await browser.newPage();await p.goto(ready.toString().trim().split(' ').pop());
await p.evaluate(async()=>{
 const {storeAttemptAudio}=await import('./attempt-audio.js'),{encodeWave}=await import('./recording.js');
 const samples=Float32Array.from({length:64000},(_,i)=>.1*Math.sin(i/10));
 await storeAttemptAudio('clip-check',encodeWave([samples],16000).blob);
 const rec={id:'clip-check',date:new Date().toISOString(),title:'Clip test',dir:'en',rubricVersion:'relay-sentence-2',delivery:{points:20},rows:[{source:'Test',evidence:'一句译文',coverage:2},{source:'Other',evidence:'另一句',coverage:2}],segments:[{text:'一句译文。',start:1,end:2.2},{text:'另一句和第三句一起',start:2.2,end:4}],bank:[],score:80};
 localStorage.setItem('relay-history',JSON.stringify([rec]));

});await p.reload();await p.evaluate(()=>{const AudioClass=window.Audio;window.Audio=class extends AudioClass{constructor(src){super(src);window.testClip=this}};location.hash='#history'});await p.click('#history [data-id="clip-check"]');
await p.waitForSelector('#report .score');assert.equal(await p.locator('#report audio,[data-sentence-clip],[data-review-time]').count(),0);console.log('PASS legacy report has no replay controls');
}finally{await browser.close();server.kill()}
