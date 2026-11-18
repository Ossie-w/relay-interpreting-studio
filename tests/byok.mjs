import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data');const origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const p=await browser.newPage(),marker='TEST-ONLY-'+Date.now(),destinations=[];let fail=false,voiceCalls=0;
 p.on('request',r=>{if(JSON.stringify([r.url(),r.headers(),r.postData()]).includes(marker))destinations.push(new URL(r.url()).hostname)});
 await p.route('https://api.deepseek.com/**',r=>{
  assert.equal(r.request().headers().authorization,'Bearer '+marker);
  if(fail)return r.fulfill({status:401,body:'denied'});
  if(r.request().url().endsWith('/tts')){
   voiceCalls++;
   const pcm=Buffer.alloc(24000*60*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(Math.sin(i/15)*3500),i*2);
   return r.fulfill({contentType:'audio/pcm',body:pcm});
  }
  return r.fulfill({json:{choices:[{message:{content:JSON.stringify({title:'Private test',ideas:['One synthetic sentence.']})}}]}});
 });
 await p.goto(origin);await p.click('#generate');await p.locator('input[type=password]').fill(marker);
 await p.locator('dialog[open] [type=submit]').click();await p.waitForSelector('#naturalVoice');assert.equal(await p.locator('input[type=password]').count(),0);
 await p.click('#naturalVoice');await p.locator('input[type=password]').fill(marker);await p.locator('dialog[open] [type=submit]').click();
 await p.waitForSelector('#sampleAudio');assert.equal(voiceCalls,1);
 await p.click('#generate');await p.locator('dialog[open] [type=button]').click();await p.waitForSelector('#generationError:not([hidden])');
 fail=true;await p.click('#generate');await p.locator('input[type=password]').fill(marker);await p.locator('dialog[open] [type=submit]').click();await p.waitForFunction(()=>document.querySelector('#generationMessage').textContent.includes('401'));
 assert.equal(await p.locator('input[type=password]').count(),0);
 assert.ok(!(await p.evaluate(()=>JSON.stringify([localStorage,sessionStorage,document.body.innerHTML]))).includes(marker));
 assert.deepEqual([...new Set(destinations)],['api.deepseek.com']);console.log('PASS direct-only key routing, separate prompts, generated audio, cancellation, failure and cleanup');
}finally{await browser.close();server.kill()}
