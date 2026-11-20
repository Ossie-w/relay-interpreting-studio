import {videoID,setupVideo,ask} from './learning.js';
import {withDeepSeek} from './deepseek-access.js';
import {transcribeRecording} from './transcription.js?v=20261113c';
import {assess} from './assessment.js';
import {renderAssessment} from './assessment-report.js';
import {storeAttemptAudio} from './attempt-audio.js';

const el=id=>document.getElementById(id);
let speech,take,lookup,revision=0;
const flags=new Set();
function lock(name,on){
 if(on)flags.add(name);else flags.delete(name);
 for(const id of ['videoURL','videoDir','take','recognize','evaluateVideo','confirmed','startVideo'])el(id).disabled=flags.size>0;
}
async function captions(){
 const version=++revision;
 lookup?.abort();lookup=new AbortController();
 let id;try{id=videoID(el('videoURL').value.trim())}catch{return}
 const direction=el('videoDir').value;
 const before=el('captions').value;
 el('videoStatus').textContent='正在查找公开字幕…';
 try{
  const r=await fetch('https://superlative-parfait-1e35c2.netlify.app/.netlify/functions/video-captions?id='+id+'&lang='+direction,{signal:lookup.signal});
  if(!r.ok)throw Error();
  const data=await r.json();if(!data.text)throw Error();
  if(version===revision&&el('captions').value===before){el('captions').value=data.text;el('videoStatus').textContent='字幕已读取，可核对后生成对照稿。'}
 }catch{if(version===revision)el('videoStatus').textContent='未能读取公开字幕。请展开 YouTube 的「显示文字记录」并粘贴，或导入源音频。'}
}
let timer;
function changed(){++revision;lookup?.abort();clearTimeout(timer);el('captions').value='';timer=setTimeout(captions,350)}
el('videoURL').oninput=changed;el('videoDir').onchange=changed;if(el('videoURL').value)changed();
el('subtitleFile').onchange=async()=>{
 const file=el('subtitleFile').files[0];if(!file)return;
 try{
  const content=(await file.text()).replace(/^\uFEFF/,'');
  const lines=content.split(/\r?\n/).filter(line=>!/^\s*(?:WEBVTT|NOTE|STYLE|REGION|Kind:|Language:)/.test(line)&&!line.includes('-->')&&!/^\s*\d+\s*$/.test(line));
  const text=lines.map(line=>line.replace(/<[^>]*>/g,'').trim()).filter(Boolean).join(' ');
  if(!text)throw Error('字幕文件中未找到文字。');
  el('captions').value=text;el('videoStatus').textContent='字幕已导入，点击生成对照稿。';
 }catch(error){el('videoStatus').textContent=error.message}
};
setupVideo(()=>({dir:el('videoDir').value}),async material=>{
 if(speech&&(take||el('notes').value)&&!confirm('打开新的演讲并清空当前笔记和录音？'))return false;
 speech={...material,id:crypto.randomUUID()};take=null;el('take').value='';el('notes').value='';el('confirmed').value='';el('feedback').textContent='';el('results').hidden=true;
 const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+speech.videoId;frame.title='演讲视频';frame.allowFullscreen=true;frame.style.cssText='width:100%;aspect-ratio:16/9;border:0';
 const link=document.createElement('a');link.textContent='在 YouTube 打开原视频';link.href='https://www.youtube.com/watch?v='+speech.videoId;link.target='_blank';link.rel='noopener';
 el('player').replaceChildren(frame,link);
 el('pairs').replaceChildren(...speech.pairs.map(pair=>{const li=document.createElement('li'),p=document.createElement('p');li.textContent=pair.source;p.textContent=pair.translation;li.append(p);return li}));
 el('work').hidden=false;el('work').scrollIntoView({behavior:'instant'});return true;
});
el('take').onchange=()=>{take=el('take').files[0];el('confirmed').value='';speech.original='';speech.id=crypto.randomUUID();el('results').hidden=true;el('feedback').textContent=''};
el('recognize').onclick=async()=>{
 if(!take){el('feedback').textContent='请先选择你的口译录音。';return}
 lock('asr',true);
 try{
  const text=await transcribeRecording(take,speech.dir,s=>el('feedback').textContent=s,'cloud');
  if(!text.trim())throw Error('录音中未识别到讲话。');
  speech.original=text;el('confirmed').value=text;el('feedback').textContent='转写完成，请核对后评级。';
 }catch(e){el('feedback').textContent=e.message}finally{lock('asr',false)}
};
function save(rec){const records=JSON.parse(localStorage.getItem('relay-history')||'[]');localStorage.setItem('relay-history',JSON.stringify([rec,...records.filter(x=>x.id!==rec.id)]))}
el('evaluateVideo').onclick=async()=>{
 const transcript=el('confirmed').value.trim();
 if(!transcript){el('feedback').textContent='请先核对口译转写。';return}
 lock('score',true);
 try{
  const rec={...speech,transcript,notes:el('notes').value,date:new Date().toISOString(),assessmentStatus:'pending'};
  if(take){await storeAttemptAudio(rec.id,take);rec.audioSaved=true}
  save(rec);const report=await assess({...rec,blob:take},transcript,s=>el('feedback').textContent=s);
  Object.assign(rec,report,{assessmentStatus:'complete'});save(rec);
  el('results').innerHTML=renderAssessment(rec);el('results').hidden=false;
  el('feedback').textContent='已保存，可在历史记录中查看。';
  const button=document.createElement('button'),details=document.createElement('p');
  button.textContent='拓展本篇背景知识与常用搭配';el('results').append(button,details);
  button.onclick=async()=>{button.disabled=true;try{
   const value=await withDeepSeek('生成主题拓展',request=>ask(request,'Based on this talk give topic background, three bilingual phrases and collocations with oral examples. Distinguish claims made in the talk from general context. Write in Chinese. Return {"guide":"..."}',{source:rec.source,bank:rec.bank}));
   if(!value.guide?.trim())throw Error('未取得拓展内容');details.textContent=value.guide;
  }catch(e){details.textContent=e.message}finally{button.disabled=false}};
  el('results').scrollIntoView();
 }catch(e){el('feedback').textContent=e.message}finally{lock('score',false)}
};

