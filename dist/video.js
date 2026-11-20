import {setupVideo,ask} from './learning.js?v=numbered1';
import {withDeepSeek} from './deepseek-access.js';
import {transcribeRecording} from './transcription.js?v=20261113c';
import {assess} from './assessment.js';
import {renderAssessment} from './assessment-report.js';
import {storeAttemptAudio} from './attempt-audio.js';

const el=id=>document.getElementById(id);
let speech,take,lastReport;
const flags=new Set();
function lock(name,on){
 if(on)flags.add(name);else flags.delete(name);
 for(const id of ['videoModel','videoDir','take','recognize','evaluateVideo','confirmed','startVideo'])el(id).disabled=flags.size>0;
}
setupVideo(()=>({dir:el('videoDir').value,model:el('videoModel').value}),async material=>{
 if(speech&&(take||el('notes').value)&&!confirm('打开新的演讲并清空当前笔记和录音？'))return false;
 speech={...material,id:crypto.randomUUID()};take=null;el('take').value='';el('notes').value='';el('confirmed').value='';el('feedback').textContent='';el('results').hidden=true;
 lastReport=null;el('vocabText').textContent='';el('wordStatus').textContent='';
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
  Object.assign(rec,report,{reference:rec.pairs.map(p=>p.translation).join('\n\n'),assessmentStatus:'complete'});save(rec);lastReport=rec;
  el('results').innerHTML=renderAssessment(rec);el('results').hidden=false;
  el('feedback').textContent='已保存，可在历史记录中查看。';
  el('results').scrollIntoView();
 }catch(e){el('feedback').textContent=e.message}finally{lock('score',false)}
};

el('vocab').onclick=async()=>{
 const current=speech,button=el('vocab');button.disabled=true;
 try{
  const r=await withDeepSeek('生成词汇与话题拓展',request=>ask(request,'Create two Chinese study sections. First select 5 to 8 important terms and collocations actually in the talk, with bilingual equivalents and short spoken examples. Then give 3 to 5 related bilingual expressions explicitly labeled as topic extension. Return {"guide":"formatted text"}.',{source:current.source},current.model));
  if(!r.guide?.trim())throw Error('词汇生成未完成，请重试。');if(speech===current)el('vocabText').textContent=r.guide;
 }catch(e){el('vocabText').textContent=e.message}finally{button.disabled=false}
};
el('exportWord').onclick=async()=>{
 const selected=new Set([...el('wordOptions').querySelectorAll('input:checked')].map(x=>x.value));
 const transcript=el('confirmed').value.trim(),out=el('wordStatus');
 try{
  if(!selected.size)throw Error('请选择至少一种文稿。');
  if(selected.has('learner')&&!transcript)throw Error('请先转写并核对自己的录音。');
  const comparison=selected.has('learner')&&selected.size>1;
  if(comparison&&(!lastReport||lastReport.transcript!==transcript||lastReport.id!==speech.id))throw Error('请先为当前转写评级，取得逐句对应关系。');
  const {Document,Packer,Paragraph,HeadingLevel,TextRun}=await import('./vendor/docx.js');
  const para=text=>new Paragraph({children:[new TextRun({text})],spacing:{after:90}});
  const body=[new Paragraph({text:speech.title,heading:HeadingLevel.TITLE})];
  if(selected.size===1&&selected.has('learner'))body.push(...transcript.split(/\n+/).map(para));
  else speech.pairs.forEach((p,i)=>{
   body.push(new Paragraph({text:'第 '+(i+1)+' 段',heading:HeadingLevel.HEADING_2}));
   if(selected.has('source'))body.push(para('原文　'+p.source));
   if(selected.has('reference'))body.push(para('参考译文　'+p.translation));
   if(comparison)body.push(para('我的口译　'+(lastReport.rows[i]?.evidence||'未找到对应译文')));
  });
  if(comparison){body.push(new Paragraph({text:'完整口译转写',heading:HeadingLevel.HEADING_2}),...transcript.split(/\n+/).map(para))}
  const blob=await Packer.toBlob(new Document({sections:[{children:body}]}));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Relay-视频长交传.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);out.textContent='Word 文档已生成。';
 }catch(e){out.textContent=e.message}
};
