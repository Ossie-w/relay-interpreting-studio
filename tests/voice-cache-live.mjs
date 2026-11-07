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
 const context=await browser.newContext();
 const page=await context.newPage();
 let weightRequests=0;
 context.on("request",r=>{if(/\.onnx(?:\?|$)/.test(r.url())){weightRequests++;console.log("Weight request",r.method(),r.url().split("?")[0])}});
 page.on("console",m=>{if(m.text().startsWith("Voice:")||m.type()==="warning"||m.type()==="error")console.log(m.type(),m.text().slice(0,500))});
 await page.goto(origin+"/#history");
 async function synth(source,lang){
  return page.evaluate(async({source,lang})=>{
   const {renderNarration}=await import("./narration.js");
   let stage="";
   const result=await renderNarration(source,lang,text=>{
    const next=text.split(" · ")[0];
    if(next!==stage){console.log("Voice: "+text);stage=next}
   });
   const context=new AudioContext(),buffer=await context.decodeAudioData(await result.blob.arrayBuffer());
   let peak=0;for(const sample of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(sample));
   await context.close();
   return {peak,duration:buffer.duration,saved:result.saved,reused:result.reused};
  },{source,lang});
 }
 const english=await synth("The library now stays open until nine.","en");
 assert.ok(english.peak>0.02&&english.duration>0.3&&english.saved);
 console.log("Natural English voice",english,"weight requests",weightRequests);
 console.log("Model persisted",await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open("relay-voice-model-v1");request.onsuccess=()=>{const db=request.result,read=db.transaction("files").objectStore("files").get("complete");read.onsuccess=()=>{resolve(read.result);db.close()};read.onerror=()=>reject(read.error)};request.onerror=()=>reject(request.error)})));
 const first=weightRequests;
 const chinese=await synth("图书馆现在晚上九点关门。","zh");
 assert.ok(chinese.peak>0.02&&chinese.saved);
 assert.equal(weightRequests,first,"Reuse the initialized model for the next manuscript");
 console.log("Natural Mandarin voice",chinese);
 await page.reload();
 const reused=await synth("The library now stays open until nine.","en");
 assert.equal(reused.reused,true);
 assert.equal(weightRequests,first,"Identical manuscript must use its saved audio after refresh");
 const changed=await synth("The library is open on Saturdays.","en");
 assert.ok(changed.peak>0.02&&changed.saved);
 assert.equal(weightRequests,first,"New page must reuse model weights from browser cache");
 console.log("Reloaded audio and model cache passed",reused,changed);
}finally{await browser.close();server.kill()}
