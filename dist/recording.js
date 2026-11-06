// PCM WAV has an explicit sample count, so native players can seek and replay
// even when the microphone's original streaming container has no seek index.
export async function playableRecording(blob){
 const context=new AudioContext();
 let audio;
 try{audio=await context.decodeAudioData(await blob.arrayBuffer())}
 finally{await context.close()}
 return encodeWave(Array.from({length:audio.numberOfChannels},(_,ch)=>audio.getChannelData(ch)),audio.sampleRate);
}

export function encodeWave(channelData,sampleRate){
 const channels=channelData.length;
 const length=channelData[0].length;
 const dataBytes=length*channels*2;
 const bytes=new ArrayBuffer(44+dataBytes),view=new DataView(bytes);
 const tag=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
 tag(0,"RIFF");view.setUint32(4,36+dataBytes,true);tag(8,"WAVE");tag(12,"fmt ");
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*2,true);
 view.setUint16(32,channels*2,true);view.setUint16(34,16,true);tag(36,"data");
 view.setUint32(40,dataBytes,true);
 let peak=0;
 for(let ch=0;ch<channels;ch++){
  const samples=channelData[ch];
  for(let i=0;i<samples.length;i++){
   const v=Math.max(-1,Math.min(1,samples[i]));
   peak=Math.max(peak,Math.abs(v));
   view.setInt16(44+2*(i*channels+ch),Math.round(v*(v<0?32768:32767)),true);
  }
 }
 return {blob:new Blob([bytes],{type:"audio/wav"}),quiet:peak<0.0001};
}
