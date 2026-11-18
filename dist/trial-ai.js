import {withDeepSeek} from './deepseek-access.js';
import {fitManuscript} from './manuscript.js';
import {targetUnits,speechUnits} from './timing.js';
export {assess,transcribe} from './ai.js?v=20261113d';
export async function generateSpeech(dir,topic,target,status,difficulty='Beginner',revision=null,request=null){
 if(!request)return withDeepSeek("Generate manuscript",call=>generateSpeech(dir,topic,target,status,difficulty,revision,call));
 status('Generating your manuscript with DeepSeek Flash…');
 const units=revision?.units??Math.round(targetUnits(target,dir)*(dir==='zh'?1.14:1));
 const brief={language:dir==='en'?'English':'Mandarin Chinese',topic,difficulty,length:Math.ceil(units*1.22),unit:dir==='en'?'words':'Chinese characters',previous:revision?.source};
 const r=await request('manuscript',{model:'deepseek-flash',thinking:{type:'disabled'},messages:[{role:'system',content:'Write a fresh spoken briefing for advanced university language students. Match the supplied topic, level and length. Use concrete facts, short breath groups and natural punctuation. If a previous draft is supplied, revise its length preserving its facts. Return JSON with title and ideas, an array of complete spoken paragraphs.'},{role:'user',content:JSON.stringify(brief)}],response_format:{type:'json_object'},max_tokens:4600});
 const draft=JSON.parse((await r.json()).choices[0].message.content);
 if(typeof draft.title!=='string'||!Array.isArray(draft.ideas)||!draft.ideas.length||!draft.ideas.every(x=>typeof x==='string'&&x.trim()))throw Error('Incomplete manuscript; please retry.');
const title=draft.title,ideas=fitManuscript(draft.ideas,dir,units);const source=ideas.join('\n\n');
 return {dir,topic,target,difficulty,title,ideas,source,estimatedSeconds:Math.round(target*speechUnits(source,dir)/targetUnits(target,dir)),mode:'DeepSeek'};
}
export function reviseSpeechDuration(speech,units,status,request){return generateSpeech(speech.dir,speech.topic,speech.target,status,speech.difficulty,{units,source:speech.source},request)}
