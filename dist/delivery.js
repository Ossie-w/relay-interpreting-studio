export function measureDelivery(samples,rate,transcript,dir,boundaries=[],expectedSeconds){
 const duration=samples.length/rate;
 if(expectedSeconds&&duration+1.5<expectedSeconds)return {reason:'Recording appears truncated. Review the full recording before scoring delivery.'};
 const step=Math.max(1,Math.round(rate*.04)),levels=[];
 for(let i=0;i<samples.length;i+=step){
  const end=Math.min(i+step,samples.length);let energy=0;
  for(let j=i;j<end;j++)energy+=samples[j]*samples[j];
  levels.push(Math.sqrt(energy/(end-i)));
 }
 const sorted=[...levels].sort((a,b)=>a-b),loud=sorted[Math.floor(sorted.length*.95)]||0;
 if(loud<.002)return {reason:'Too little audible speech. Check the microphone and re-record.'};
 const gate=Math.max(.001,loud*.045),voiced=levels.map(v=>v>=gate);
 const first=voiced.indexOf(true),last=voiced.lastIndexOf(true),talk=voiced.filter(Boolean).length*.04;
 const words=dir==='en'?(transcript.match(/[\p{Script=Han}]/gu)||[]).length:transcript.trim().split(/\s+/).length;
 if(talk<1||!words||(talk>10&&words/talk<(dir==='en'?.65:.35)))return {reason:'Transcript or recording appears incomplete. Replay it and verify the text.'};
 const gaps=[];
 for(let i=first;i<=last;i++){
  if(voiced[i])continue;
  const start=i;while(i<=last&&!voiced[i])i++;
  if((i-start)*.04>=2&&!boundaries.some(t=>t>=start*.04-.15&&t<=i*.04+.15))gaps.push({start:start*.04,end:i*.04});
 }
 const span=(last-first+1)*.04,excess=gaps.reduce((n,g)=>n+g.end-g.start-1.5,0);
 return {points:Math.max(0,20-Math.round(20*Math.min(1,(excess+gaps.length*.4)/Math.max(10,span)*2))),gaps};
}
