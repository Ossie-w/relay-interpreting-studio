// Local evaluation of the official sherpa-onnx v1.12.35 browser release.
// Download/extract the release outside dist before running. No uploaded audio.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {resolve,basename} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const trial=resolve(process.env.SENSEVOICE_TRIAL||'../sensevoice-browser-trial/sherpa-onnx-wasm-simd-1.12.35-vad-asr-zh_en_ja_ko_cantonese-sense_voice_small');
const server=createServer(async(req,res)=>{try{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Local ASR comparison</title>')}
 const name=basename(new URL(req.url,'http://localhost').pathname),file=resolve(name.endsWith('.wav')?'dist':trial,name),s=await stat(file);
 res.writeHead(200,{'Content-Length':s.size,'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end()}}).listen(0,'127.0.0.1');
await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const loadMs=await page.evaluate(async()=>{
  const start=performance.now();window.asrReady=new Promise((resolve,reject)=>{window.Module={onRuntimeInitialized:resolve,onAbort:reject}});
  const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script)});
  await load('./sherpa-onnx-asr.js');await load('./sherpa-onnx-wasm-main-vad-asr.js');await asrReady;
  window.recognizer=new OfflineRecognizer({modelConfig:{tokens:'./tokens.txt',senseVoice:{model:'./sense-voice.onnx',useInverseTextNormalization:1},numThreads:1,debug:0}},Module);
  return performance.now()-start;
 });console.log('SenseVoice local load (excludes release download)',loadMs);
 for(const lang of ['en','zh','en']){
  const result=await page.evaluate(async lang=>{
   const ac=new AudioContext(),decoded=await ac.decodeAudioData(await(await fetch('./commute-'+lang+'.wav')).arrayBuffer());
   const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
   const samples=(await offline.startRendering()).getChannelData(0);await ac.close();
   const start=performance.now(),stream=recognizer.createStream();
   try{stream.acceptWaveform(16000,samples);recognizer.decode(stream);return {audioSeconds:decoded.duration,inferenceMs:performance.now()-start,text:recognizer.getResult(stream).text}}
   finally{stream.free()}
  },lang);console.log(JSON.stringify({candidate:'sensevoice',lang,...result}));
 }
}finally{await browser.close();server.close()}
