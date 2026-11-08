import {encodeWave} from "./recording.js";
export function microphoneProblem(error){
 if(error.name==="NotAllowedError")return "Microphone permission was blocked. Allow microphone access for both this website and the host app in Windows privacy settings. If this is an embedded browser, copy this page into standalone Edge or Chrome.";
 if(error.name==="NotFoundError")return "No microphone is available. Connect a microphone and refresh the device list.";
 if(error.name==="NotReadableError")return "The microphone could not be opened. Close other apps using it and check Windows microphone privacy settings.";
 if(error.name==="OverconstrainedError")return "That microphone is no longer available. Select System default microphone and retry.";
 return error.message;
}
function analyze(channels,sampleRate){
 let chosen=channels[0],energy=-1,peak=0;
 for(const channel of channels){
  let sum=0,p=0;
  for(const value of channel){sum+=value*value;p=Math.max(p,Math.abs(value))}
  if(sum>energy){energy=sum;chosen=channel;peak=p}
 }
 const rms=Math.sqrt(Math.max(0,energy)/Math.max(1,chosen.length)),quiet=peak<0.0001||rms<0.00002;
 const gain=quiet?1:Math.max(1,Math.min(8,0.85/peak)),pcm=chosen.slice();
 if(gain>1)for(let i=0;i<pcm.length;i++)pcm[i]*=gain;
 return {...encodeWave([pcm],sampleRate),quiet,peak,rms,gain,seconds:pcm.length/sampleRate};
}
export async function openMicrophone(deviceId,onLevel,onEnded){
 if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error("Microphone capture requires HTTPS and a browser that supports recording.");
 const policy=document.permissionsPolicy||document.featurePolicy;
 if(policy?.allowsFeature&&!policy.allowsFeature("microphone"))throw new DOMException("This embedded page is not allowed to use the microphone. Open the site directly in Edge or Chrome.","NotAllowedError");
 const context=new AudioContext(),resumed=context.resume().catch(()=>{});
 let stream,node,input,splitter,silent,meterTimer,native,permission="unknown",ended=false;
 const analysers=[],pendingTimers=new Set(),chunks=[];
 const bounded=(promise,ms,fallback)=>new Promise(resolve=>{
  const timer=setTimeout(()=>{pendingTimers.delete(timer);resolve(fallback)},ms);pendingTimers.add(timer);
  promise.then(value=>{clearTimeout(timer);pendingTimers.delete(timer);resolve(value)},()=>{clearTimeout(timer);pendingTimers.delete(timer);resolve(fallback)});
 });
 async function release(){
  clearInterval(meterTimer);for(const timer of pendingTimers)clearTimeout(timer);
  if(node)node.port.onmessage=null;
  [node,input,splitter,silent,...analysers].forEach(n=>n?.disconnect());
  if(native&&native.state!=="inactive")native.stop();
  stream?.getTracks().forEach(t=>{t.onended=null;t.stop()});
  if(context.state!=="closed")await context.close();
 }
 try{
  // Use browser defaults for processing: forcing all processing off can be
  // incompatible with host-app capture bridges and communications devices.
  stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId}}:true});
  const track=stream.getAudioTracks()[0];
  if(!track||track.readyState!=="live")throw Error("The browser returned no live microphone track.");
  track.enabled=true;
  navigator.permissions?.query({name:"microphone"}).then(p=>permission=p.state).catch(()=>{});
  await bounded(resumed,1500);
  let nativeDone=Promise.resolve(null),pcmDone=Promise.resolve(null),frames=0;
  if(window.MediaRecorder){
   try{
    const mime=["audio/webm;codecs=opus","audio/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
    native=new MediaRecorder(stream,mime?{mimeType:mime}:{});
    nativeDone=new Promise(resolve=>{
     native.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
     native.onstop=()=>resolve(chunks.length?new Blob(chunks,{type:native.mimeType}):null);
     native.onerror=()=>resolve(null);
    });
    native.start(250);
   }catch{native=null}
  }
  input=context.createMediaStreamSource(stream);
  silent=context.createGain();silent.gain.value=0;silent.connect(context.destination);
  splitter=context.createChannelSplitter(2);input.connect(splitter);
  for(let channel=0;channel<2;channel++){
   const analyser=context.createAnalyser();analyser.fftSize=1024;
   splitter.connect(analyser,channel);analyser.connect(silent);analysers.push(analyser);
  }
  try{
   await context.audioWorklet.addModule(new URL("./capture-worklet.js",import.meta.url));
   node=new AudioWorkletNode(context,"relay-capture");input.connect(node);node.connect(silent);
   pcmDone=new Promise(resolve=>{
    node.port.onmessage=({data})=>{if(data.pcm)resolve(data.pcm);else frames=data.frames};
    node.onprocessorerror=()=>resolve(null);
   });
  }catch{if(!native)throw Error("This browser cannot start either recording engine. Open the site in standalone Edge or Chrome.")}
  const take={
   state:"recording",label:track.label||"Microphone",deviceId:track.getSettings().deviceId||deviceId,
   pause(){if(this.state==="recording"){this.state="paused";node?.port.postMessage("pause");if(native?.state==="recording")native.pause()}},
   async resume(){await bounded(context.resume(),1500);this.state="recording";node?.port.postMessage("start");if(native?.state==="paused")native.resume()},
   async stop(){
    if(this.state==="inactive")return;
    this.state="inactive";ended=true;clearInterval(meterTimer);
    node?.port.postMessage("stop");if(native&&native.state!=="inactive")native.stop();
    try{
     const [pcm,blob]=await Promise.all([bounded(pcmDone,2500,null),bounded(nativeDone,5000,null)]);
     let captured=pcm?.length?analyze([pcm],context.sampleRate):null;
     if((!captured||captured.quiet)&&blob){
      try{
       const buffer=await context.decodeAudioData(await blob.arrayBuffer());
       const alternative=analyze(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate);
       if(!captured||!alternative.quiet)captured={...alternative,compatibility:true};
      }catch{}
     }
     if(!captured)throw Error("The browser did not deliver decodable microphone audio. Try this page in standalone Edge or Chrome.");
     return captured;
    }finally{await release()}
   }
  };
  const samples=new Float32Array(1024);let elapsed=0,last=performance.now();
  meterTimer=setInterval(()=>{
   if(ended)return;
   const now=performance.now();if(take.state==="recording")elapsed+=(now-last)/1000;last=now;
   let level=0;
   for(const analyser of analysers){
    analyser.getFloatTimeDomainData(samples);let sum=0;for(const sample of samples)sum+=sample*sample;
    level=Math.max(level,Math.sqrt(sum/samples.length));
   }
   onLevel(level,elapsed,{permission,track:track.readyState,muted:track.muted,context:context.state,frames,native:native?.state||"unavailable"});
  },100);
  track.onended=onEnded;node?.port.postMessage("start");
  return take;
 }catch(error){await release();throw error}
}
