// Match the complete recognized utterance; a substring has no acoustic boundaries.
const normalize = value => (value || '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
export function matchedClip(quote, segments = []) {
 const key=normalize(quote);
 if(!key)return null;
 const hits=segments.filter(s=>normalize(s.text).includes(key));
 if(hits.length!==1||normalize(hits[0].text)!==key)return null;
 const {start,end}=hits[0];
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)return null;
 const units=/[\u3400-\u9fff]/u.test(quote)?key.length:quote.trim().split(/\s+/).length*1.6;
 if(end-start>Math.min(30,2+units*.85))return null;
 return {start,end};
}

// Cut at a genuine pause when available. Longer uninterrupted speech keeps its
// context; the report only offers a button for a complete matched utterance.
export function utteranceEnd(samples,start,rate){
 let quiet=0;
 const frame=Math.round(rate*.02),limit=Math.min(samples.length,start+rate*20);
 for(let i=start;i+frame<=limit;i+=frame){
  let sum=0;for(let j=i;j<i+frame;j++)sum+=samples[j]*samples[j];
  quiet=sum/frame<.000025?quiet+frame:0;
  if(quiet>=rate*.38&&i-start>=rate*1.3&&quiet<i-start)return i+frame-Math.floor(quiet/2);
 }
 return limit;
}