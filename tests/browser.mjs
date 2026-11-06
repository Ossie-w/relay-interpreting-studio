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
if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT});
for(const dir of ["en","zh"]){
 await page.locator('[data-dir="'+dir+'"]').click();
 await page.locator("#demo").click();
 await page.waitForFunction(()=>document.querySelector("#sampleAudio").duration>0);
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
  return {chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify({title:"Test",ideas:["speech ".repeat(128)]})}}]})}}};
 }`}));
await page.goto(origin+"/#studio");
for(const warm of [false,true,false]){
 await page.reload();
 if(!warm)await page.evaluate(()=>caches.delete("qa-model"));
 await page.locator("#generate").click();
 await page.waitForSelector("#corrected");
 const messages=await page.evaluate(()=>statusMessages);
 assert.equal(messages.some(m=>m.includes("2 GB")),!warm);
}
// Replace the model boundary only in this browser test. Exercise the real UI and storage.
await page.route("**/ai.js",r=>r.fulfill({contentType:"text/javascript",body:`
export async function generateSpeech(dir,topic,target){return {dir,topic,target,title:"QA session",source:"Source passage",ideas:["Source passage"],mode:"AI-generated"}}
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
    Object.defineProperty(speechSynthesis,method,{value:()=>window.speechCalls.push(method)});
   }
  });
  const speech=page.locator("#sourcePlay"),record=page.locator("#record");
  await speech.click();await speech.click();assert.match(await speech.innerText(),/Resume/);
  await speech.click();await record.click();assert.match(await record.innerText(),/Pause/);
  assert.ok(await speech.isDisabled());
  await page.waitForTimeout(550);await record.click();
  assert.match(await record.innerText(),/Resume/);assert.ok(await speech.isEnabled());
  await speech.click();await page.waitForTimeout(1200);
  await record.click();assert.match(await speech.innerText(),/Resume/);
  await page.waitForTimeout(550);await record.click();
  await page.locator("#finishRecording").click();
  await page.waitForFunction(()=>document.querySelector("#corrected").value==="Recognized words");
  assert.equal(await page.locator("#replay").isVisible(),true);
  assert.equal(await page.evaluate(()=>speechCalls.filter(x=>x==="speak").length),1);
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

