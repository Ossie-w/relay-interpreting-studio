// Live Qwen generation and optional timed Kokoro audio. Dedicated test profile
// keeps public model downloads between runs, outside the source repository.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {readFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'4179'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const log=resolve('../generation-live-'+Date.now()+'.jsonl');
const context=await chromium.launchPersistentContext(resolve('../qa-generation-profile'),{executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await context.newPage();
 page.on('console',m=>{if(m.text().startsWith('GEN')){console.log(m.text());appendFile(log,m.text()+'\n').catch(()=>{})}});
 page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 await page.route(/\/ai\.js(?:\?.*)?$/,async r=>{
  let code=await readFile(new URL('../dist/ai.js',import.meta.url),'utf8');
  code=code.replace('const content=result.choices[0].message.content;','console.log("GEN_REPLY "+JSON.stringify({finish:result.choices[0].finish_reason,text:result.choices[0].message.content}));const content=result.choices[0].message.content;');
  await r.fulfill({contentType:'text/javascript',body:code});
 });
 await page.goto(origin+'/#history');
 const cases=JSON.parse(process.env.GEN_CASES||'[{"dir":"en","target":60,"difficulty":"Intermediate"}]');
 for(const c of cases){
  const result=await page.evaluate(async({c,audio})=>{
   window.liveAI??=await import('./ai.js?live');
   let previous='',stamp=0;const status=text=>{const stage=text.replace(/ · \d+%/g,'');if(stage!==previous||Date.now()-stamp>15000){console.log('GEN_STATUS '+text);previous=stage;stamp=Date.now()}};
   const start=performance.now();const speech=await liveAI.generateSpeech(c.dir,c.topic||'Public services',c.target,status,c.difficulty||'Intermediate');
   const result={...speech,elapsedMs:performance.now()-start};
   if(audio){const {prepareTimedSpeech}=await import('./timed-narration.js');const timed=await prepareTimedSpeech(speech,status,liveAI.reviseSpeechDuration);const ac=new AudioContext(),buffer=await ac.decodeAudioData(await timed.blob.arrayBuffer());let peak=0;for(const x of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(x));await ac.close();Object.assign(result,{finalSource:timed.speech.source,audioDuration:buffer.duration,peak,totalMs:performance.now()-start})}
   return result;
  },{c,audio:!!process.env.GEN_AUDIO&&!c.skipAudio});
  assert.ok(result.source.length>50);
  if(process.env.GEN_AUDIO&&!c.skipAudio){assert.ok(Math.abs(result.audioDuration-c.target)<.05);assert.ok(result.peak>.01)}
  console.log('GEN_RESULT '+JSON.stringify(result));await appendFile(log,'GEN_RESULT '+JSON.stringify(result)+'\n');
 }
 console.log('GEN_PASS '+log);
}finally{await context.close();server.kill()}
