import {withDeepSeek} from './deepseek-access.js';
import {fitManuscript,isSourceLanguage} from './manuscript.js';
import {targetUnits,speechUnits,textFits} from './timing.js';
export {assess} from './assessment.js';
export {transcribe} from './ai.js?v=20261113d';
export async function generateSpeech(dir,topic,target,status,difficulty='Beginner',revision=null,request=null,model="deepseek-v4-flash",custom={}){
 if(!request)return withDeepSeek("Generate manuscript",call=>generateSpeech(dir,topic,target,status,difficulty,revision,call,model,custom));
 status('Generating your manuscript with DeepSeek…');
 const units=revision?.units??Math.round(targetUnits(target,dir)*(dir==='zh'?1.14:1));
 const brief={language:dir==='en'?'English':'Mandarin Chinese',topic,difficulty,length:Math.ceil(units*1.22),unit:dir==='en'?'words':'Chinese characters',learnerRequest:custom.instruction,previous:revision?.source??custom.previous};
 for(let pass=0;pass<3;pass++){
 const r=await request('manuscript',{model,thinking:{type:'disabled'},messages:[{role:'system',content:'Write a fresh spoken briefing for advanced university language students. Match the supplied topic, level and length. For upper-year interpreting majors develop a realistic decision, tradeoff, evidence and consequences in connected paragraphs. Use concrete facts, short breath groups and natural punctuation. If a previous draft is supplied, revise its length preserving its facts. Return JSON exactly shaped {"title":"Speech title","ideas":["Full spoken paragraph","Next full paragraph"]}. Both languages must use these English field names. No objects inside ideas.'},{role:'user',content:JSON.stringify(brief)}],response_format:{type:'json_object'},max_tokens:4600});
 const draft=JSON.parse((await r.json()).choices[0].message.content);
 if(typeof draft.title!=='string'||!Array.isArray(draft.ideas)||!draft.ideas.length||!draft.ideas.every(x=>typeof x==='string'&&x.trim())){brief.feedback='Use the exact JSON schema with paragraphs as strings.';continue}
const title=draft.title,ideas=fitManuscript(draft.ideas,dir,units);const source=ideas.join('\n\n');
 if(!textFits(speechUnits(source,dir),units)||!isSourceLanguage(source,dir)){brief.feedback="Rewrite the entire speech in the requested language. Previous length: "+speechUnits(source,dir)+". Required: "+units;brief.previous=source;continue}
 return {instruction:custom.instruction,model,dir,topic,target,difficulty,title,ideas,source,estimatedSeconds:Math.round(target*speechUnits(source,dir)/targetUnits(target,dir)),mode:'DeepSeek'};
}
 throw Error("The manuscript did not meet the language and length requirements after three drafts.");
}
export function reviseSpeechDuration(speech,units,status,request){return generateSpeech(speech.dir,speech.topic,speech.target,status,speech.difficulty,{units,source:speech.source},request,speech.model,{instruction:speech.instruction})}
