import {encodeWave} from "./recording.js";
export async function openMicrophone(deviceId,onLevel,onEnded){
 const context=new AudioContext();
 let stream,node,input,timeout;
 // Resume from the recording gesture before waiting on microphone permission.
 const resumed=context.resume();
 async function release(){
  clearTimeout(timeout);if(node)node.port.onmessage=null;node?.disconnect();input?.disconnect();
  stream?.getTracks().forEach(t=>{t.onended=null;t.stop()});
  if(context.state!=="closed")await context.close();
 }
 try{
  await resumed;
  stream=await navigator.mediaDevices.getUserMedia({audio:{
   ...(deviceId?{deviceId:{exact:deviceId}}:{}),
   echoCancellation:false,noiseSuppression:false,autoGainControl:true
  }});
  await context.audioWorklet.addModule(new URL("./capture-worklet.js",import.meta.url));
  input=context.createMediaStreamSource(stream);
  node=new AudioWorkletNode(context,"relay-capture");
  input.connect(node);node.connect(context.destination);
  let finish;
  const done=new Promise(resolve=>{finish=resolve});
  node.port.onmessage=({data})=>{
   if(data.pcm)finish(data.pcm);else onLevel(data.level,data.frames/context.sampleRate);
  };
  const take={
   state:"recording",label:stream.getAudioTracks()[0]?.label||"Microphone",
   deviceId:stream.getAudioTracks()[0]?.getSettings().deviceId||deviceId,
   pause(){if(this.state==="recording"){this.state="paused";node.port.postMessage("pause")}},
   async resume(){await context.resume();this.state="recording";node.port.postMessage("start")},
   async stop(){
    if(this.state==="inactive")return;
    this.state="inactive";node.port.postMessage("stop");
    try{
     const pcm=await Promise.race([done,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error("The microphone stopped responding. Please record again.")),5000)})]);
     let peak=0,sum=0;
     for(const sample of pcm){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample}
     const rms=Math.sqrt(sum/Math.max(1,pcm.length)),quiet=peak<0.0001||rms<0.00002;
     const gain=quiet?1:Math.max(1,Math.min(8,0.85/peak));
     if(gain>1)for(let i=0;i<pcm.length;i++)pcm[i]*=gain;
     return {...encodeWave([pcm],context.sampleRate),quiet,peak,rms,seconds:pcm.length/context.sampleRate,gain};
    }finally{await release()}
   }
  };
  stream.getAudioTracks().forEach(track=>{track.onended=onEnded});
  node.port.postMessage("start");
  return take;
 }catch(error){await release();throw error}
}
