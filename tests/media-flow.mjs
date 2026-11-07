import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const server=spawn(process.execPath,["serve.mjs"],{cwd:new URL("../",import.meta.url),env:{...process.env,PORT:"0"},stdio:["ignore","pipe","inherit"]});
const [ready]=await once(server.stdout,"data"),origin=ready.toString().trim().split(" ").pop();
process.on("exit",()=>server.kill());
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 let generates=0,failNext=false;
 await page.route("**/ai.js",r=>r.fulfill({contentType:"text/javascript",body:
  'export {transcribeRecording as transcribe} from "./transcription.js";'+
  'export async function generateSpeech(dir,topic,target,status,difficulty){'+
  'const response=await fetch("/qa/generate");if(!response.ok)throw Error("Test failure");const n=await response.text();'+
  'return {dir,topic,target,difficulty,title:"Daily practice "+n,source:"The library opens at nine.",ideas:["The library opens at nine."],mode:"AI-generated"}}'+
  'export async function assess(){throw Error("Not part of this test")}'
 }));
 await page.route("**/qa/generate",r=>{
  if(failNext){failNext=false;return r.fulfill({status:503,body:"failed"})}
  return r.fulfill({body:String(++generates)});
 });
 let voiceJobs=0;
 await page.route("**/narration-worker.js",r=>{
  voiceJobs++;
  return r.fulfill({contentType:"text/javascript",body:
   'self.onmessage=async({data:{id}})=>{const blob=await (await fetch("./commute-en.wav")).blob();postMessage({id,blob})}'
  });
 });
 await page.goto(origin);
 await page.waitForSelector("#regenerate");
 assert.equal(generates,1);
 assert.equal(await page.locator("#heroTitle").innerText(),await page.locator("#session h2").innerText());
 await page.reload();await page.waitForSelector("#regenerate");
 assert.equal(generates,1,"Same-day recommendation must survive reload without generating again");
 await page.locator("#regenerate").click();
 await page.waitForFunction(()=>document.querySelector("#session h2").textContent==="Daily practice 2");
 assert.equal(await page.locator("#heroTitle").innerText(),"Daily practice 2");
 failNext=true;await page.locator("#regenerate").click();
 await page.waitForFunction(()=>document.querySelector("#sessionstatus").textContent.includes("Test failure"));
 assert.equal(await page.locator("#session h2").innerText(),"Daily practice 2","Failed regeneration must preserve the exercise");
 await page.locator("#naturalVoice").click();await page.waitForSelector("#sampleAudio");
 await page.waitForFunction(()=>document.querySelector("#sampleAudio").duration>0);
 assert.equal(voiceJobs,1);
 await page.reload();await page.waitForSelector("#sampleAudio");
 assert.equal(voiceJobs,1,"Reopening the same manuscript must restore its audio without synthesis");
 assert.match(await page.locator("#voiceStatus").textContent(),/restored/);
 await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem("relay-daily"));saved.date="2000-01-01";localStorage.setItem("relay-daily",JSON.stringify(saved))});
 await page.reload();await page.waitForFunction(()=>document.querySelector("#session h2")?.textContent==="Daily practice 3");
 assert.equal(generates,3,"A new local day must generate a new recommendation");
 console.log("Daily recommendation, regeneration failure recovery and persistent narration cache passed.");
 // Exercise the actual IndexedDB weight cache across worker lifetimes, including
 // an interrupted download and boundaries between several 4 MB storage blocks.
 const cacheResults=await page.evaluate(async()=>{
  const code='import {installVoiceModelCache} from '+JSON.stringify(new URL("./model-cache.js",location.href).href)+';'+
   'let downloads=0;const size=9*1024*1024+127;'+
   'self.fetch=async()=>{downloads++;let offset=0;return new Response(new ReadableStream({pull(c){if(offset===size){c.close();return}const n=Math.min(700001,size-offset),data=new Uint8Array(n);for(let i=0;i<n;i++)data[i]=(offset+i)%251;offset+=n;c.enqueue(data)}}),{headers:{"Content-Length":String(size)}})};'+
   'installVoiceModelCache(()=>{});self.onmessage=async({data:cold})=>{try{'+
   'const url="https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/onnx/model.onnx";'+
   'if(cold){const interrupted=await fetch(url),reader=interrupted.body.getReader();await reader.read();await reader.cancel()}'+
   'const data=new Uint8Array(await (await fetch(url)).arrayBuffer());'+
   'if(data.length!==size||!data.every((value,i)=>value===i%251))throw Error("Saved model bytes changed");'+
   'const metadata=await fetch(url,{headers:{Range:"bytes=0-0"}});'+
   'postMessage({downloads,range:metadata.status,rangeBytes:(await metadata.arrayBuffer()).byteLength});'+
   '}catch(error){postMessage({error:error.message})}}';
  const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"})),results=[];
  try{
   for(const cold of [true,false]){
    const worker=new Worker(url,{type:"module"});
    try{results.push(await new Promise((resolve,reject)=>{
     worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data);
     worker.onerror=e=>reject(Error(e.message));worker.postMessage(cold);
    }))}finally{worker.terminate()}
   }
  }finally{URL.revokeObjectURL(url)}
  return results;
 });
 assert.deepEqual(cacheResults,[{downloads:2,range:206,rangeBytes:1},{downloads:0,range:206,rangeBytes:1}]);
 console.log("Interrupted and restored model cache bytes passed.");
 // Real Web Audio capture, including a device with a silent first channel.
 async function input(lang,silent=false){
  await page.evaluate(async({lang,silent})=>{
   window.fixtureContext=new AudioContext();
   const context=window.fixtureContext;
   const buffer=await context.decodeAudioData(await (await fetch("./commute-"+lang+".wav")).arrayBuffer());
   const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
   const merger=context.createChannelMerger(2),destination=context.createMediaStreamDestination();
   const gain=context.createGain();gain.gain.value=silent?0:0.2;
   source.connect(gain);gain.connect(merger,0,1);merger.connect(destination);
   navigator.mediaDevices.getUserMedia=async()=>{await context.resume();source.start();return destination.stream};
   navigator.mediaDevices.enumerateDevices=async()=>[{kind:"audioinput",deviceId:"fixture",label:"Test microphone"}];
  },{lang,silent});
 }
 // Silence must be diagnosed beside the recorder, never sent to ASR.
 await input("en",true);
 await page.locator("#record").click();await page.waitForTimeout(900);
 await page.locator("#finishRecording").click();
 await page.waitForFunction(()=>!document.querySelector("#record").disabled);
 console.log("Silence result",await page.locator("#micStatus").innerText(),await page.locator("#sessionstatus").innerText());
 assert.match(await page.locator("#micStatus").innerText(),/No usable/);
 assert.match(await page.locator("#transcriptStatus").textContent(),/No speech signal/);
 await page.evaluate(()=>fixtureContext.close());
 page.on("dialog",dialog=>dialog.accept());
 if(process.env.QA_REAL_ASR){
  page.on("console",m=>{if(m.type()==="error")console.log("Browser",m.text().slice(0,250))});
  for(const [sourceDir,spokenLang] of [["zh","en"],["en","zh"]]){
   await page.locator('[data-dir="'+sourceDir+'"]').click();
   await page.locator("#generate").click();
   await page.waitForFunction(()=>!document.querySelector("#generate").disabled);
   await input(spokenLang);
   await page.locator("#record").click();
   await page.waitForFunction(()=>document.querySelector("#micLevel").value>0.001);
   await page.waitForTimeout(7000);
   await page.locator("#record").click();
   await page.waitForTimeout(600);
   await page.locator("#record").click();
   await page.waitForTimeout(1200);
   await page.locator("#finishRecording").click();
   await page.waitForFunction(()=>document.querySelector("#replay").duration>0);
   const signal=await page.locator("#replay").evaluate(async audio=>{
    const context=new AudioContext(),buffer=await context.decodeAudioData(await (await fetch(audio.src)).arrayBuffer());
    const samples=buffer.getChannelData(0);let sum=0;for(const x of samples)sum+=x*x;
    await context.close();
    audio.currentTime=audio.duration/2;await audio.play();
    await new Promise(r=>setTimeout(r,250));audio.pause();
    return {rms:Math.sqrt(sum/samples.length),duration:buffer.duration,seek:audio.currentTime,muted:audio.muted};
   });
   assert.ok(signal.rms>0.005&&signal.duration>7&&signal.seek>3&&!signal.muted,JSON.stringify(signal));
   console.log("Actual captured WAV signal",spokenLang,signal);
   await page.waitForFunction(()=>document.querySelector("#corrected").value||!document.querySelector("#retryASR").hidden,null,{timeout:600000});
   const text=await page.locator("#corrected").inputValue();
   assert.ok(text.length>5,await page.locator("#transcriptStatus").innerText());
   assert.match(text,spokenLang==="en"?/city|bus|transport/i:/交通|公交|本市|电动/);
   assert.equal(text,await page.locator("#originalText").textContent());
   console.log("REAL Whisper transcript",spokenLang,text);
   await page.evaluate(()=>fixtureContext.close());
  }
 }
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT,fullPage:true});
 console.log("Media and daily workflow passed.");
}finally{await browser.close();server.kill()}
