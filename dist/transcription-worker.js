import {installASRModelCache} from './asr-model-cache.js';
let recognizerPromise=null,engine='',activeId=null;
const listeners=new Set();
const report=status=>{for(const id of listeners)postMessage({id,status,engine})};
installASRModelCache(report);
async function loadRecognizer(mode){
 let gpu=false;
 if(mode!=='lightweight')try{gpu=!!(await navigator.gpu?.requestAdapter())}catch{}
 engine=gpu?'Whisper small · WebGPU':'Whisper tiny · CPU';
 if(mode!=='lightweight'&&!gpu)report('GPU acceleration unavailable. Using lightweight Whisper tiny on this device.');
 report(gpu?'Loading enhanced Whisper small · first use saves about 586 MB; later uses load saved files':'Loading lightweight Whisper tiny · saved files are reused');
 const version=gpu?'4.3.2':'3.7.2';
 const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@'+version+'/dist/transformers.min.js');
 env.allowLocalModels=false;
 // Small uses our block cache; tiny retains its existing Cache API files.
 env.useBrowserCache=!gpu;
 const percentages=new Map();
 return pipeline('automatic-speech-recognition',gpu?'onnx-community/whisper-small':'Xenova/whisper-tiny',{
  device:gpu?'webgpu':'wasm',dtype:gpu?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',
  progress_callback:p=>{if(p.status==='progress'){const percent=Math.round(p.progress);if(percentages.get(p.file)!==percent){percentages.set(p.file,percent);report(engine+' · loading '+p.file+' · '+percent+'%')}}}
 });
}
self.onmessage=async({data:{id,samples,dir,warmup,mode='enhanced'}})=>{
 if(!warmup&&activeId){postMessage({id,error:'Another recording is being transcribed.'});return}
 if(!warmup)activeId=id;
 listeners.add(id);
 try{
  recognizerPromise??=loadRecognizer(mode).catch(error=>{recognizerPromise=null;throw error});
  const recognize=await recognizerPromise;
  if(warmup){postMessage({id,ready:true,engine});return}
  report(engine+' · transcribing your '+(dir==='en'?'Mandarin':'English')+' recording…');
  // Never pass the source manuscript or a corrected answer to recognition.
  const result=await recognize(samples,{language:dir==='en'?'chinese':'english',task:'transcribe',chunk_length_s:30,stride_length_s:5});
  postMessage({id,text:result.text.trim(),engine});
 }catch(error){postMessage({id,error:(error.message||'Transcription failed.')+(engine.includes('small')?' You can select Lightweight and retry the same recording.':''),engine})}
 finally{listeners.delete(id);if(activeId===id)activeId=null}
};
