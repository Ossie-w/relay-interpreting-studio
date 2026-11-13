// Live browser benchmark. Uses the same bundled, synthetic recordings for every model.
// Not a substitute for testing learner accents/noise. Run candidates sequentially.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage();
 page.on('console',m=>{if(m.text().startsWith('BENCH'))console.log(m.text())});
 await page.goto(origin+'/#history');
 const gpu=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();return a?{available:true,info:a.info}: {available:false}});
 console.log('GPU',JSON.stringify(gpu));
 const candidate=process.env.ASR_CANDIDATE||'tiny';
 const config=candidate==='small'?{model:'onnx-community/whisper-small',device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'q4'},version:'4.3.2'}:
 {model:'Xenova/whisper-'+candidate,device:'wasm',dtype:'q8',version:'3.7.2'};
 await page.route('**/benchmark-worker.js',r=>r.fulfill({contentType:'text/javascript',body:`
 let pipe;
 self.onmessage=async({data:{config,samples,lang}})=>{try{
 const t=performance.now();
 if(!pipe){const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@'+config.version+'/dist/transformers.min.js');env.allowLocalModels=false;env.useBrowserCache=true;
 pipe=await pipeline('automatic-speech-recognition',config.model,{device:config.device,dtype:config.dtype,progress_callback:p=>{if(p.status==='initiate'||p.status==='done')postMessage({status:p.status+' '+p.file})}})}
 const loadMs=performance.now()-t,begin=performance.now();
 const result=await pipe(samples,{language:lang==='zh'?'chinese':'english',task:'transcribe',chunk_length_s:30,stride_length_s:5});
 postMessage({result:{loadMs,inferenceMs:performance.now()-begin,text:result.text}});
 }catch(e){postMessage({error:e.message||String(e)})}};
 `}));
 for(const lang of ['en','zh','en']){
  const result=await page.evaluate(async({config,lang,seconds})=>{
   const ac=new AudioContext(),decoded=await ac.decodeAudioData(await(await fetch('./commute-'+lang+'.wav')).arrayBuffer());
   const duration=seconds||decoded.duration,offline=new OfflineAudioContext(1,Math.ceil(duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
   const samples=(await offline.startRendering()).getChannelData(0);await ac.close();
   window.benchWorker??=new Worker('./benchmark-worker.js',{type:'module'});
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Benchmark exceeded 10 minutes')),600000);
    benchWorker.onmessage=({data})=>{if(data.status)console.log('BENCH '+data.status);else{clearTimeout(timer);data.error?reject(Error(data.error)):resolve({...data.result,audioSeconds:duration})}};
    benchWorker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};benchWorker.postMessage({config,lang,samples},[samples.buffer]);
   });
  },{config,lang,seconds:Number(process.env.ASR_SECONDS||0)});
  console.log(JSON.stringify({candidate,lang,...result}));
 }
}finally{await browser.close();server.kill()}
