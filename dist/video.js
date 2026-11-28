import {converse} from './video-conversation.js';
import {parseSubtitles,subtitleText} from './subtitles.js';
import {setupVideo,ask,videoID} from './learning.js?v=subtitles-20261127';
import {withDeepSeek} from './deepseek-access.js';
import {transcribeRecording} from './transcription.js?v=20261113c';
import {assess} from './assessment.js';
import {renderAssessment} from './assessment-report.js';
import {storeAttemptAudio} from './attempt-audio.js';

const el=id=>document.getElementById(id);
let speech,take,lastReport;
let discussion=[];
function renderPairs(){
 el('pairs').replaceChildren(...speech.pairs.map(pair=>{const li=document.createElement('li'),p=document.createElement('p');const source=document.createElement('div');source.className='pairSource';source.textContent=pair.source;if(Number.isFinite(pair.start)){const time=document.createElement('small');time.textContent='字幕时间 '+new Date(pair.start*1000).toISOString().slice(11,19)+' – '+new Date(pair.end*1000).toISOString().slice(11,19);source.append(document.createElement('br'),time)}p.textContent=pair.translation;li.append(source,p);return li}));
}
function renderDiscussion(){
 el('videoChat').replaceChildren(...discussion.map(turn=>{const article=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=turn.question;p.textContent=turn.answer;p.style.whiteSpace='pre-wrap';article.append(h,p);return article}));
}
function saveDraft(){
 if(!speech)return;
 try{localStorage.setItem('relay-video-draft-v1',JSON.stringify({speech,discussion,notes:el('notes').value,confirmed:el('confirmed').value,captions:el('captions').value,youtubeLink:el('youtubeLink').value}));return true}
 catch{el('chatStatus').textContent='浏览器存储空间不足，当前修改尚未自动保存，请先导出文稿。';return false}
}
const flags=new Set();
function lock(name,on){
 if(on)flags.add(name);else flags.delete(name);
 for(const id of ['videoModel','videoDir','take','recognize','evaluateVideo','confirmed','startVideo'])el(id).disabled=flags.size>0;
}
setupVideo(()=>({dir:el('videoDir').value,model:el('videoModel').value}),async material=>{
 if(speech&&(take||el('notes').value)&&!confirm('打开新的演讲并清空当前笔记和录音？'))return false;
 speech={...material,id:crypto.randomUUID()};take=null;el('take').value='';el('notes').value='';el('confirmed').value='';el('feedback').textContent='';el('results').hidden=true;
 discussion=[];el('videoChat').replaceChildren();el('chatStatus').textContent='';
 lastReport=null;el('vocabText').textContent='';el('wordStatus').textContent='';
 renderPairs();
 saveDraft();el('work').hidden=false;el('work').scrollIntoView({behavior:'instant'});return true;
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
  const r=await withDeepSeek('生成词汇与话题拓展',request=>ask(request,'Return JSON with arrays terms, phrases, patterns, extension. Each item has strings en and zh. For a full talk aim for 10-14 key terms, 8-12 collocations, 5-8 reusable sentence frames, and 10-14 additional topic expressions. Ground the first three categories in the talk. For short input choose fewer relevant items. Avoid duplicates, examples and Markdown.',{source:current.source},current.model));
  const fragment=document.createDocumentFragment();
  for(const [key,title] of Object.entries({terms:'原稿重点词汇',phrases:'常用短语与搭配',patterns:'可复用句型',extension:'话题拓展表达'})){
   const rows=r[key];if(!Array.isArray(rows)||!rows.length)throw Error('词汇分类不完整，请重试。');
   const heading=document.createElement('h3'),list=document.createElement('ul');heading.textContent=title;
   for(const item of rows){
    if(typeof item?.en!=='string'||typeof item.zh!=='string')throw Error('词条内容不完整，请重试。');
    const li=document.createElement('li');li.textContent=(item.en+'　'+item.zh).replace(/[#*]/g,'');list.append(li);
   }
   fragment.append(heading,list);
  }
  if(speech===current)el('vocabText').replaceChildren(fragment);
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

el('loadYoutube').onclick=()=>{
 try{
  const id=videoID(el('youtubeLink').value.trim());
  el('youtubePlayer').src='https://www.youtube-nocookie.com/embed/'+id;
  el('youtubePlayer').hidden=false;
  el('youtubeStatus').textContent='播放器已载入。若视频限制嵌入，请在 YouTube 打开观看。';
 }catch(e){el('youtubeStatus').textContent=e.message}
};
el('askVideo').onclick=async()=>{
 const question=el('videoQuestion').value.trim(),current=speech;
 if(!current||!question){el('chatStatus').textContent='请先生成对照文稿并输入问题。';return}
 const button=el('askVideo');button.disabled=true;lock('chat',true);el('chatStatus').textContent='正在结合文稿回答…';
 try{
  const result=await withDeepSeek('文稿对话与改写',request=>converse(ask,request,current,discussion,question,el('videoModel').value,s=>el('chatStatus').textContent=s));
  if(current!==speech)return;
  if(result.pairs){
   speech.pairs=result.pairs;
   speech.reference=result.pairs.map(p=>p.translation).join('\n\n');
   [...el('pairs').children].forEach((li,i)=>{li.querySelector('p').textContent=result.pairs[i].translation});
  }
  if(result.pairs)result.answer='已按你的要求更新 '+result.changed+' 段译文，请查看上方双语对照。\n'+result.answer;
  discussion.push({question,answer:result.answer});
  const article=document.createElement('article'),heading=document.createElement('h3'),answer=document.createElement('p');
  heading.textContent=question;answer.textContent=result.answer;answer.style.whiteSpace='pre-wrap';article.append(heading,answer);el('videoChat').append(article);
  el('videoQuestion').value='';el('chatStatus').textContent=result.pairs?'已更新 '+result.changed+' 段译文；双语对照和 Word 导出已使用新版。':'回答完成。';
   saveDraft();
 }catch(e){el('chatStatus').textContent=e.message}finally{button.disabled=false;lock('chat',false)}
};

el('captionSource').onchange=()=>{el('subtitleImport').hidden=el('captionSource').value!=='file'};
el('subtitleFile').onchange=async()=>{const file=el('subtitleFile').files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('请选择 2MB 以内的字幕或文稿。');const raw=await file.text();const cues=parseSubtitles(raw);if(!cues.length&&!/\.txt$/i.test(file.name))throw Error('未找到有效字幕时间码。');el('captions').value=raw;el('subtitleStatus').textContent=cues.length?'已导入 '+cues.length+' 条字幕；时间戳将用于 AI 分段。':'已导入纯文稿。';}catch(e){el('subtitleStatus').textContent=e.message}finally{el('subtitleFile').value=''}};
el('exportTxt').onclick=()=>{try{const raw=el('captions').value,cues=parseSubtitles(raw),text=cues.length?subtitleText(cues):raw.trim();if(!text)throw Error('请先导入或粘贴文稿。');const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Relay-原文稿.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);el('subtitleStatus').textContent='TXT 已导出；原字幕及时间戳仍保留在输入框中。';}catch(e){el('subtitleStatus').textContent=e.message}};

for(const id of ['notes','confirmed'])el(id).addEventListener('input',saveDraft);
try{
 const draft=JSON.parse(localStorage.getItem('relay-video-draft-v1')||'null');
 if(draft?.speech?.pairs?.length&&draft.speech.pairs.every(p=>typeof p.source==='string'&&typeof p.translation==='string')){
  speech=draft.speech;discussion=Array.isArray(draft.discussion)?draft.discussion:[];
  for(const id of ['notes','confirmed','captions','youtubeLink'])el(id).value=draft[id]||'';
  el('videoDir').value=speech.dir;el('videoModel').value=speech.model;
  renderPairs();renderDiscussion();el('work').hidden=false;
  el('chatStatus').textContent='已恢复上次文稿与对话，可继续提出修改要求。';
  el('feedback').textContent='如需重新评级录音，请重新选择录音文件；已保存的练习可在历史记录打开。';
 }
}catch{el('chatStatus').textContent='未能恢复本地草稿，请重新导入文稿。'}
