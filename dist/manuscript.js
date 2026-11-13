import {speechUnits,textFits} from './timing.js';

// If the token budget ends halfway through the next JSON string, retain only
// the earlier, complete strings. Never invent missing text or accept a partial
// passage. This recovery is for manuscripts only, never assessment results.
export function recoverManuscript(raw){
 const jsonString='"(?:[^"\\\\]|\\\\.)*"';
 const titleMatch=new RegExp('"title"\\s*:\\s*('+jsonString+')').exec(raw);
 const array=/"(?:paragraphs|ideas)"\s*:\s*\[/.exec(raw);
 if(!titleMatch)return null;
 try{
  const title=JSON.parse(titleMatch[1]),ideas=[];
  if(!array){
   const fields=new RegExp('"paragraph_(\\d+)"\\s*:\\s*('+jsonString+')','g');
   for(const match of raw.matchAll(fields)){
    if(Number(match[1])!==ideas.length+1)break;
    const text=JSON.parse(match[2]);if(!text.trim())break;ideas.push(text);
   }
   return title.trim()&&ideas.length?{title,ideas}:null;
  }
  let rest=raw.slice(array.index+array[0].length);
  const entry=new RegExp('^\\s*('+jsonString+')');
  while(true){
   const match=entry.exec(rest);if(!match)break;
   const text=JSON.parse(match[1]);if(text.trim())ideas.push(text);
   rest=rest.slice(match[0].length).trimStart();
   if(!rest.startsWith(','))break;
   rest=rest.slice(1);
  }
  return title.trim()&&ideas.length?{title,ideas}:null;
 }catch{return null}
}

// Reduce an overlong draft only at sentence boundaries. Never cut a word,
// number or Chinese clause merely to satisfy the target counter.
export function fitManuscript(ideas,dir,target){
 const segmenter=new Intl.Segmenter(dir==='en'?'en':'zh',{granularity:'sentence'});
 const original=ideas.map(x=>x.trim()).filter(Boolean);
 const source=original.join('\n\n');
 if(speechUnits(source,dir)<=target||textFits(speechUnits(source,dir),target))return original;
 const kept=[];let best=[],under=[],bestDistance=Infinity;
 for(const paragraph of original){
  kept.push('');
  for(const {segment} of segmenter.segment(paragraph)){
   kept[kept.length-1]+=(kept.at(-1)&&dir==='en'?' ':'')+segment.trim();
   const count=speechUnits(kept.join('\n\n'),dir),distance=Math.abs(count-target);
   if(distance<bestDistance){bestDistance=distance;best=[...kept]}
   if(count>=target)return textFits(speechUnits(best.join('\n\n'),dir),target)?best:under.length?under:best;
   under=[...kept];
  }
 }
 return best.length?best:original;
}

export function isSourceLanguage(source,dir){
 const chinese=(source.match(/[\u3400-\u9fff]/g)||[]).length,latin=(source.match(/[a-z]/gi)||[]).length;
 return dir==='en'?latin>0&&chinese<=latin*.15:chinese>0&&chinese>=latin*.4;
}

export function isOutline(ideas,dir){
 return ideas.some(text=>dir==='zh'?/^第[一二三四五六七八九十\d]+(?:部分|章|节)[：:]/.test(text.trim()):/^(?:part|section|point)\s+\d+\s*:/i.test(text.trim()));
}

// Consecutive generation rounds occasionally repeat a whole previous passage.
// Remove exact repeats only, leaving meaning and actual quantities unchanged.
export function joinPassages(previous,next,dir='en'){
 const segmenter=new Intl.Segmenter(dir==='en'?'en':'zh',{granularity:'sentence'});
 const key=text=>text.trim().replace(/\s+/g,' ').toLowerCase();
 const seen=new Set(previous.flatMap(text=>[...segmenter.segment(text)].map(({segment})=>key(segment))));
 const added=next.map(text=>[...segmenter.segment(text)].filter(({segment})=>{
  const value=key(segment);if(seen.has(value))return false;seen.add(value);return true;
 }).map(({segment})=>segment.trim()).join(dir==='en'?' ':'')).filter(Boolean);
 return [...previous,...added];
}
