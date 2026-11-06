import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const server=spawn(process.execPath,["serve.mjs"],{cwd:new URL("../",import.meta.url),env:{...process.env,PORT:"0"},stdio:["ignore","pipe","inherit"]});
const [ready]=await once(server.stdout,"data");
const origin=ready.toString().trim().split(" ").pop();
process.on("exit",()=>server.kill());
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||undefined,headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:1024}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.goto(origin);
await page.waitForSelector("#topics button");
if(process.env.QA_LIVE_VOICE){
 page.on("console",m=>{if(m.type()==="error" || m.text().startsWith("Voice test"))console.log(m.text().slice(0,300))});
 for(const [lang,source] of [["en","The library now stays open until nine."],["zh","图书馆现在晚上九点关门。"]]){
  const result=await page.evaluate(async({lang,source})=>{
   const worker=new Worker("./narration-worker.js",{type:"module"});
   try{
    const blob=await new Promise((resolve,reject)=>{
     const timeout=setTimeout(()=>reject(Error("Voice preparation timed out")),300000);
     let previous="";
     worker.onerror=e=>{clearTimeout(timeout);reject(Error(e.message))};
     worker.onmessage=({data})=>{
      if(data.blob||data.error){clearTimeout(timeout);data.error?reject(Error(data.error)):resolve(data.blob);return}
      const stage=data.status?.split(" · ").slice(0,2).join(" ");
      if(stage!==previous){console.log("Voice test "+stage);previous=stage}
     };
     worker.postMessage({lang,source});
    });
    const ctx=new AudioContext();
    try{const samples=await ctx.decodeAudioData(await blob.arrayBuffer());return {duration:samples.duration,hasSignal:samples.getChannelData(0).some(x=>Math.abs(x)>.02)}}finally{await ctx.close()}
   }finally{worker.terminate()}
  },{lang,source});
  assert.ok(result.duration>0.3 && result.hasSignal);
  console.log("Live voice passed",lang,result);
 }
}
if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT});
for(const dir of ["en","zh"]){
 await page.locator('[data-dir="'+dir+'"]').click();
 await page.locator("#demo").click();
 await page.waitForFunction(()=>document.querySelector("#sampleAudio").duration>0);
 await page.locator("#playbackSpeed").selectOption("1.5");
 assert.equal(await page.locator("#sampleAudio").evaluate(a=>a.playbackRate),1.5);
 console.log(dir+" demo seconds",await page.locator("#sampleAudio").evaluate(a=>a.duration));
 await page.locator("#record").click();
 await page.waitForFunction(()=>/microphone|device|denied|type your interpretation/i.test(document.querySelector("#sessionstatus").textContent));
}
await page.getByRole("link",{name:"Training plan",exact:true}).click();
await page.locator("[name=minutes]").fill("20");await page.getByText("Save plan",{exact:true}).click();
await page.reload();assert.equal(await page.locator("[name=minutes]").inputValue(),"20");
await page.getByRole("link",{name:"History",exact:true}).click();
for(const d of ["en","zh"]){
 await page.locator("#examplesDir").selectOption(d);
 for(const [v,n] of [["faithful",100],["number",90],["omission",80]]){
 await page.locator('#samples [data-id="example-'+d+'-'+v+'"]').click();
 assert.equal(await page.locator(".score").textContent(),n+"%");await page.locator(".close").click();
 }}
// Exercise cold, warm and cleared browser storage through the real Generate button.
await page.addInitScript(()=>{
 Object.defineProperty(navigator,"gpu",{value:{requestAdapter:async()=>({})},configurable:true});
 window.statusMessages=[];
 new MutationObserver(records=>{
  for(const r of records)if(r.target.id==="sessionstatus")window.statusMessages.push(r.target.textContent);
 }).observe(document,{subtree:true,childList:true});
});
await page.route("https://esm.run/@mlc-ai/web-llm@0.2.79",r=>r.fulfill({contentType:"text/javascript",headers:{"Access-Control-Allow-Origin":"*"},body:`
 export async function hasModelInCache(){return !!(await caches.match("/qa-model-file"))}
 export async function CreateMLCEngine(id,options){
  await new Promise(resolve=>setTimeout(resolve,20));
  if(!await hasModelInCache()){
   await (await caches.open("qa-model")).put("/qa-model-file",new Response("fixture"));
  }
  options.initProgressCallback({text:"Loading model from cache",progress:1});
  return {chat:{completions:{create:async(request)=>{window.testPrompt=request.messages.at(-1).content;return {choices:[{message:{content:JSON.stringify({title:"Test",ideas:window.drafts?.shift()??["speech ".repeat(128)]})}}]}}}}};
 }`}));
await page.goto(origin+"/#studio");
for(const [warm,level] of [[false,"Beginner"],[true,"Intermediate"],[false,"Advanced"]]){
 await page.reload();
 await page.locator("#difficulty").selectOption(level);
 if(!warm)await page.evaluate(()=>caches.delete("qa-model"));
 await page.locator("#generate").click();
 await page.waitForSelector("#corrected");
 assert.ok((await page.evaluate(()=>window.testPrompt)).includes("Difficulty: "+level));
 assert.ok((await page.locator("#session .meta").textContent()).includes(level));
 const messages=await page.evaluate(()=>statusMessages);
 assert.equal(messages.some(m=>m.includes("2 GB")),!warm);
}
// Reproduce two off-target drafts and check the usable manuscript that reaches playback.
for(const [dir,unit,draftLengths,expectedLength] of [
 ["en","speech ",[40,85],85],
 ["zh","车",[330,360],330]
]){
 await page.locator('[data-dir="'+dir+'"]').click();
 await page.locator("#difficulty").selectOption("Beginner");
 await page.evaluate(({unit,draftLengths})=>{
  window.drafts=draftLengths.map(n=>[unit.repeat(n)]);
 },{unit,draftLengths});
 await page.locator("#generate").click();
 await page.waitForFunction(()=>document.querySelector("#sourcePlay")||document.querySelector("#sessionstatus")?.textContent.startsWith("Generation unavailable"));
 assert.ok(await page.locator("#sourcePlay").count(),"Off-target length should still yield a practice session");
 assert.ok((await page.locator("#session details p").first().textContent()).includes(unit.repeat(expectedLength).trim()));
 assert.match(await page.locator("#session .meta").textContent(),/Estimated/);
}
// Replace the model boundary only in this browser test. Exercise the real UI and storage.
await page.route("**/ai.js",r=>r.fulfill({contentType:"text/javascript",body:`
export async function generateSpeech(dir,topic,target){return {dir,topic,target,title:"QA session",source:"Source passage",ideas:["First sentence. Second sentence."],mode:"AI-generated"}}
export async function transcribe(){return "Recognized words"}
export async function assess(s,t){return {score:100,rows:[{source:s.source,evidence:t,points:1,reason:"Test"}],suggestion:"Practice the number."}}`}));
await page.goto(origin+"/#studio");await page.reload();
for(const [dir,target] of [["en",60],["zh",300]]){
 await page.locator('[data-dir="'+dir+'"]').click();
 await page.locator("#duration").press(target===300?"End":"Home");
 await page.locator("#generate").click();
 if(dir==="en"){
  // Drive a real MediaRecorder with a synthetic microphone. Headless Edge has no speaking voice.
  await page.evaluate(()=>{
   const context=new AudioContext(),osc=context.createOscillator(),dest=context.createMediaStreamDestination();
   osc.connect(dest);osc.start();
   navigator.mediaDevices.getUserMedia=async()=>{await context.resume();return dest.stream};
   window.speechCalls=[];
   for(const method of ["speak","pause","resume","cancel"]){
    Object.defineProperty(speechSynthesis,method,{value:line=>{window.speechCalls.push(method);if(line)window.latestLine=line}});
   }
  });
  const speech=page.locator("#sourcePlay"),record=page.locator("#record");
  await page.locator("#playbackSpeed").selectOption("0.75");
  await speech.click();
  assert.equal(await page.evaluate(()=>latestLine.rate),0.75);
  await page.locator("#playbackSpeed").selectOption("2");
  assert.match(await page.evaluate(()=>latestLine.text),/First sentence\. Second sentence\./);
  await page.waitForFunction(()=>latestLine.rate===2);
  assert.equal(await page.evaluate(()=>latestLine.rate),2);
  await page.evaluate(()=>{window.interruptedLine=latestLine});
  await speech.click();assert.match(await speech.innerText(),/Resume/);
  await page.evaluate(()=>interruptedLine.onend());
  await speech.click();
  assert.ok(await page.evaluate(()=>latestLine!==interruptedLine));
  await record.click();assert.match(await record.innerText(),/Pause/);
  assert.ok(await speech.isDisabled());
  await page.waitForTimeout(550);await record.click();
  assert.match(await record.innerText(),/Resume/);assert.ok(await speech.isEnabled());
  await speech.click();await page.waitForTimeout(1200);
  await record.click();assert.match(await speech.innerText(),/Resume/);
  await page.waitForTimeout(550);await record.click();
  await page.locator("#finishRecording").click();
  await page.waitForFunction(()=>document.querySelector("#corrected").value==="Recognized words");
  assert.equal(await page.locator("#replay").isVisible(),true);
  const replay=page.locator("#replay");
  await page.waitForFunction(()=>Number.isFinite(document.getElementById("replay").duration));
  const playback=await replay.evaluate(async audio=>{
   const blob=await (await fetch(audio.src)).blob();
   const context=new AudioContext(),buffer=await context.decodeAudioData(await blob.arrayBuffer());
   let peak=0;for(const sample of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(sample));
   await context.close();
   audio.currentTime=audio.duration*0.5;await audio.play();
   await new Promise(r=>audio.addEventListener("ended",r,{once:true}));
   await audio.play();
   return {peak,position:audio.currentTime,length:audio.duration,type:blob.type};
  });
  assert.ok(playback.peak>0.1 && playback.position<playback.length/2);
  assert.equal(playback.type,"audio/wav");
  await replay.evaluate(audio=>audio.pause());
  const seek=page.locator("#sourceSeek");
  await seek.press("Home");
  await seek.press("ArrowRight");
  await speech.click();
  assert.equal(await page.evaluate(()=>latestLine.text.trim()),"sentence. Second sentence.");
  await speech.click();
  const before=await page.evaluate(()=>speechCalls.filter(x=>x==="speak").length);
  await speech.click();
  assert.equal(await page.evaluate(()=>speechCalls.filter(x=>x==="speak").length),before+1);
  await seek.press("Home");
  assert.match(await speech.innerText(),/Pause/);
  assert.match(await page.evaluate(()=>latestLine.text),/^First sentence/);
 }
 if(process.env.QA_LIVE_VOICE){
  await page.locator("#naturalVoice").click();
  await page.waitForFunction(()=>document.querySelector("#sampleAudio")?.duration>0 || document.querySelector("#voiceStatus")?.textContent.includes("unavailable"),null,{timeout:240000});
  assert.ok(await page.locator("#sampleAudio").count(),await page.locator("#voiceStatus").innerText());
  await page.locator("#playbackSpeed").selectOption("1.25");
  const heard=await page.locator("#sampleAudio").evaluate(async audio=>{
   audio.currentTime=audio.duration/2;await audio.play();await new Promise(resolve=>setTimeout(resolve,150));audio.pause();
   return !audio.error && audio.currentTime>=audio.duration/2 && audio.playbackRate===1.25;
  });
  assert.ok(heard);
 }
 await page.locator("#corrected").fill("My reviewed transcript");
 await page.locator("#evaluate").click();await page.waitForSelector("#detail[open]");
 await page.locator(".close").click();
}
await page.getByRole("link",{name:"History",exact:true}).click();await page.reload();
const data=await page.evaluate(()=>JSON.parse(localStorage.getItem("relay-history")));
assert.equal(data.length,2);assert.deepEqual(data.map(r=>[r.dir,r.target]),[["zh",300],["en",60]]);
assert.ok(data[1].recordSeconds>=1 && data[1].recordSeconds<2.2);
await page.locator('#history [data-id="'+data[0].id+'"]').click();assert.equal(await page.locator(".score").textContent(),"100%");await page.locator(".close").click();
await page.setViewportSize({width:390,height:844});await page.getByRole("link",{name:"Studio",exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);console.log("Browser workflow passed, including persistence, rubric examples and microphone fallback.");
}finally{await browser.close();server.kill()}

