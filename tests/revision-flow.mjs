import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createRequire} from "node:module";
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||"playwright");
const server=spawn(process.execPath,["serve.mjs"],{cwd:new URL("../",import.meta.url),env:{...process.env,PORT:"0"},stdio:["ignore","pipe","inherit"]});
const [ready]=await once(server.stdout,"data"),origin=ready.toString().trim().split(" ").pop();
process.on("exit",()=>server.kill());
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const date=new Date(),day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
  if(!localStorage.getItem("relay-daily"))localStorage.setItem("relay-daily",JSON.stringify({date:day,speech:{
   title:"Short draft",dir:"en",topic:"Education",difficulty:"Intermediate",target:75,source:"Short draft.",ideas:["Short draft."],mode:"AI-generated"
  }}));
 });
 await page.route(/\/ai\.js(?:\?.*)?$/,r=>r.fulfill({contentType:"text/javascript",body:
  'export async function generateSpeech(dir,topic,target,status,difficulty){return {dir,topic,target,difficulty,title:difficulty+" practice",source:difficulty+" source.",ideas:[difficulty+" source."],mode:"AI-generated"}}'+
  'export async function reviseSpeechDuration(speech,units){window.requestedUnits=units;return {...speech,title:"Expanded practice",source:"Expanded manuscript.",ideas:["Expanded manuscript."]}}'+
  'export async function transcribe(){return "Test transcript"};export async function assess(){}'
 }));
 await page.route("**/narration-worker.js",r=>r.fulfill({contentType:"text/javascript",body:
  'import {encodeWave} from "./recording.js";self.onmessage=({data:{id,source}})=>{const duration=source==="Short draft."?27:70;const pcm=Float32Array.from({length:duration*8000},(_,i)=>.2*Math.sin(i*2*Math.PI*220/8000));postMessage({id,blob:encodeWave([pcm],8000).blob})}'
 }));
 await page.goto(origin);await page.waitForSelector("#naturalVoice");
 await page.locator("#naturalVoice").click();
 await page.waitForFunction(()=>document.querySelector("#sampleAudio")?.duration===75);
 assert.equal(await page.locator("#session h2").innerText(),"Expanded practice");
 assert.equal(await page.locator("#heroTitle").innerText(),"Expanded practice");
 assert.equal(await page.locator("#manuscript").textContent(),"Expanded manuscript.");
 assert.ok(await page.evaluate(()=>window.requestedUnits>2));
 await page.reload();await page.waitForFunction(()=>document.querySelector("#sampleAudio")?.duration===75);
 for(const [button,level] of [["easier","Beginner"],["harder","Intermediate"],["harder","Advanced"]]){
  await page.locator("#"+button).click();
  await page.waitForFunction(level=>document.querySelector("#session h2")?.textContent===level+" practice",level);
  assert.match(await page.locator("#session .meta").textContent(),/Education.*1:15/);
 }
 assert.ok(await page.locator("#harder").isDisabled());
 await page.locator("#easier").click();await page.waitForFunction(()=>document.querySelector("#session h2")?.textContent==="Intermediate practice");
 // Simulate a host Permissions Policy denial, without overriding getUserMedia.
 await page.evaluate(()=>Object.defineProperty(document,"permissionsPolicy",{value:{allowsFeature:()=>false},configurable:true}));
 await page.locator("#testMic").click();
 await page.waitForFunction(()=>document.querySelector("#micStatus").textContent.includes("permission was blocked"));
 assert.match(await page.locator("#micStatus").textContent(),/host app/);
 assert.deepEqual(errors,[]);
 console.log("27s → 75s manuscript correction, exact audio length, cache, difficulty controls and permission diagnosis passed.");
}finally{await browser.close();server.kill()}
