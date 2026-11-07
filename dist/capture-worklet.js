// Paused frames never enter the recording. Output is silence to prevent feedback.
class RelayCapture extends AudioWorkletProcessor {
 constructor(){
  super();this.active=false;this.chunks=[];this.frames=0;this.tick=0;
  this.port.onmessage=({data})=>{
   if(data==="start")this.active=true;
   if(data==="pause")this.active=false;
   if(data==="stop"){
    this.active=false;
    const pcm=new Float32Array(this.frames);let offset=0;
    for(const chunk of this.chunks){pcm.set(chunk,offset);offset+=chunk.length}
    this.chunks=[];this.frames=0;
    this.port.postMessage({pcm},[pcm.buffer]);
   }
  };
 }
 process(inputs){
  const channels=inputs[0];
  if(!channels?.length)return true;
  // Some USB interfaces expose a silent channel beside the microphone.
  let signal=channels[0],energy=-1;
  for(const channel of channels){
   let sum=0;for(const value of channel)sum+=value*value;
   if(sum>energy){energy=sum;signal=channel}
  }
  if(this.active){this.chunks.push(signal.slice());this.frames+=signal.length}
  if(++this.tick>=20){
   this.tick=0;
   this.port.postMessage({level:Math.sqrt(Math.max(0,energy)/signal.length),frames:this.frames});
  }
  return true;
 }
}
registerProcessor("relay-capture",RelayCapture);
