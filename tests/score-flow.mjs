import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||"playwright");
const server=spawn(process.execPath,["serve.mjs"],{cwd:new URL("../",import.meta.url),env:{...process.env,PORT:"0"},stdio:["ignore","pipe","inherit"]});
const [ready]=await once(server.stdout,"data"),origin=ready.toString().trim().split(" ").pop();
process.on("exit",()=>server.kill());
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true,args:[
 "--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream",
 "--use-file-for-fake-audio-capture="+fileURLToPath(new URL("../dist/commute-en.wav",import.meta.url))
]});
try{
 for(const compatibility of [false]){
  const page=await browser.newPage();
  await page.route(/\/ai\.js(?:\?.*)?$/,r=>r.fulfill({contentType:"text/javascript",body:
   'export async function generateSpeech(){};export async function reviseSpeechDuration(){};export async function transcribe(){return "Browser microphone captured"};export async function assess(){}'
  }));
  if(compatibility)await page.addInitScript(()=>{window.AudioWorkletNode=class {constructor(){throw Error("Worklet unavailable in this test")}}});
  let failure='401',extractions=0;
  await page.route('https://api.deepseek.com/chat/completions',r=>{
   if(failure==='401')return r.fulfill({status:401,body:'Invalid'});
   if(failure==='network')return r.abort('failed');
   const extract=r.request().postDataJSON().messages[0].content.includes('Extract the distinct');
   if(extract)extractions++;
   const value=extract?{units:['Transit update']}:{rows:[{unit:1,coverage:2,accuracy:2,vocabulary:2,evidence:[1],reason:'Faithful'}],weakness:'Practise numbers',strength:'Clear facts',suggestion:'Repeat the figures',reference:'交通简报',bank:Array.from({length:5},(_,i)=>({source:'Source '+i,target:'Target '+i}))};
   return r.fulfill({json:{choices:[{message:{content:JSON.stringify(value)}}]}});
  });
  const key=async()=>{await page.locator('dialog[open] input[type=password]').fill('test-fake');await page.locator('dialog[open] form [type=submit]').click()};
  await page.goto(origin+"/#history");await page.locator("#offlineExercise").click();
  assert.ok(await page.evaluate(()=>navigator.mediaDevices.getUserMedia.toString().includes("[native code]")));
  await page.locator("#testMic").click();
  await page.waitForFunction(()=>document.querySelector("#micStatus").textContent.includes("test passed"),null,{timeout:15000});
  const testAudio=await page.locator("#micTestReplay").evaluate(async a=>{
   const c=new AudioContext(),b=await c.decodeAudioData(await (await fetch(a.src)).arrayBuffer());await c.close();
   let peak=0;for(const v of b.getChannelData(0))peak=Math.max(peak,Math.abs(v));
   await a.play();await new Promise(r=>setTimeout(r,150));a.pause();
   return {duration:b.duration,peak,position:a.currentTime,muted:a.muted,volume:a.volume};
  });
  assert.ok(testAudio.duration>4&&testAudio.duration<7&&testAudio.peak>0.02&&testAudio.position>0);
  assert.equal(testAudio.muted,false);assert.equal(testAudio.volume,1);
  assert.equal(await page.locator("#corrected").inputValue(),"","A microphone test must not replace the practice transcript");
  if(compatibility)assert.match(await page.locator("#micStatus").innerText(),/compatibility recorder/);
  await page.locator("#record").click();
  await page.waitForFunction(()=>document.querySelector("#micLevel").value>0.001);
  await page.waitForTimeout(1800);
  await page.locator("#record").click();await page.waitForTimeout(500);
  await page.locator("#record").click();await page.waitForTimeout(1100);
  await page.locator("#finishRecording").click();
  await page.waitForFunction(()=>document.querySelector("#corrected").value==="Browser microphone captured");
  const signal=await page.locator("#replay").evaluate(async a=>{
   const c=new AudioContext(),b=await c.decodeAudioData(await (await fetch(a.src)).arrayBuffer());await c.close();
   let peak=0;for(const v of b.getChannelData(0))peak=Math.max(peak,Math.abs(v));
   a.currentTime=a.duration/2;await a.play();await new Promise(r=>setTimeout(r,150));a.pause();
   return {peak,duration:b.duration,position:a.currentTime};
  });
  assert.ok(signal.peak>0.02&&signal.duration>2&&signal.duration<5&&signal.position>1,JSON.stringify(signal));
  await page.fill('#corrected','这座城市明年将增加公交车。');
  await page.click('#evaluate');await key();await page.waitForFunction(()=>document.querySelector('#sessionstatus').textContent.includes('401'));
  await page.reload();await page.goto(origin+'/#history');await page.locator('#history [data-id]').first().click();
  failure='network';await page.click('#retryAssessment');await key();await page.waitForFunction(()=>document.querySelector('#reportStatus').textContent.includes('remains saved'));
  failure='';await page.click('#retryAssessment');await key();await page.waitForSelector('#report .score');
  assert.match(await page.locator('#report .score').innerText(),/100\/100/);assert.equal(extractions,1);
  await page.reload();await page.locator('#history [data-id]').first().click();await page.waitForSelector('#report audio');
  assert.match(await page.locator('#report').innerText(),/Word bank/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-history')).length),1);
  console.log(compatibility?"Native fallback":"Worklet + native capture",signal);
  if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT,fullPage:true});
  await page.close();
 }
 console.log("Browser permission/device capture passed without replacing getUserMedia.");
}finally{await browser.close();server.kill()}
