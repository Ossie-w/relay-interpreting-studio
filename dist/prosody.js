const rate = 24000;
const segmenter = new Intl.Segmenter('en', {granularity:'sentence'});

function phrases(text) {
 const parts = [];
 for (const paragraph of text.trim().split(/\n+/)) {
  const sentences = Array.from(segmenter.segment(paragraph), entry => entry.segment.trim()).filter(Boolean);
  for (const sentence of sentences) {
   const last = parts.at(-1);
   if (last && !last.paragraphEnd && /\b(?:Mr|Mrs|Ms|Dr|Prof|St|e\.g|i\.e)\.$/i.test(last.text)) last.text += ' '+sentence;
   else parts.push({text:sentence,paragraphEnd:false});
  }
  if (parts.length) parts.at(-1).paragraphEnd=true;
 }
 return parts.flatMap(splitBreathGroups);
}

// Prefer grammatical boundaries, preserving decimals, grouped numbers and short lists.
function splitBreathGroups(part) {
 const text=part.text;
 const length=s=>/[\u3400-\u9fff]/u.test(s)?Array.from(s.replace(/\s/g,'')).length/2:s.trim().split(/\s+/).length;
 if(length(text)<12)return [part];
 const edges=[...text.matchAll(/(?:[,;:]\s+|[，；：]|\s+[—–]\s+|\s+(?=(?:although|because|whereas|while|which means)\b))/gi)];
 const groups=[];
 let start=0;
 for(const edge of edges){
  const end=edge.index+edge[0].length;
  if(length(text.slice(start,end))<5||length(text.slice(end))<5)continue;
  groups.push({text:text.slice(start,end).trim(),clause:true});start=end;
 }
 groups.push({...part,text:text.slice(start).trim()});
 return groups;
}

function trimEdges(bytes) {
 if (!bytes.length || bytes.length%2) throw Error('Voice service returned incomplete audio');
 const samples=bytes.length/2;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let first=0,last=samples;
 while(first<last && Math.abs(view.getInt16(first*2,true))<32) first++;
 while(last>first && Math.abs(view.getInt16((last-1)*2,true))<32) last--;
 if(first===last)throw Error('Voice service returned silent audio');
 return bytes.subarray(Math.max(0,first-480)*2,Math.min(samples,last+600)*2);
}

export async function narrate(text,voice,target,call){
 const parts=phrases(text);
 if(!parts.length||parts.length>150)throw Error('Invalid practice settings');
 const clips=new Array(parts.length);
 let next=0;
 async function worker(){
  while(next<parts.length){
   const i=next++;
   try{
    const response=await call('voice',{text:parts[i].text,voice_id:voice,format:'pcm'});
    clips[i]=trimEdges(new Uint8Array(await response.arrayBuffer()));
   }catch(error){next=parts.length;throw error}
  }
 }
 const results=await Promise.allSettled(Array.from({length:Math.min(4,parts.length)},worker));
 const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
 const natural=clips.reduce((sum,clip)=>sum+clip.length/2,0);
 const gaps=parts.slice(0,-1).map(p=>p.clause?0.13:p.paragraphEnd?0.54:0.32);
 const nominal=gaps.reduce((sum,g)=>sum+g,0)*rate;
 const scale=nominal && target?Math.min(1.45,Math.max(.8,(target*rate-natural)/nominal)):1;
 const chunks=[];
 for(let i=0;i<clips.length;i++){
  chunks.push(clips[i]);
  if(i<gaps.length)chunks.push(new Uint8Array(2*Math.round(rate*gaps[i]*scale)));
 }
 const bytes=chunks.reduce((sum,c)=>sum+c.length,0);
 const header=new Uint8Array(44),v=new DataView(header.buffer),encoder=new TextEncoder();
 header.set(encoder.encode('RIFF'));v.setUint32(4,36+bytes,true);header.set(encoder.encode('WAVEfmt '),8);
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
 v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
 header.set(encoder.encode('data'),36);v.setUint32(40,bytes,true);
 return new Blob([header,...chunks],{type:'audio/wav'});
}
