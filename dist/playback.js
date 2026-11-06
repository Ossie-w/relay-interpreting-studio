import {preferredVoice} from "./voice.js";

// Speech synthesis exposes text boundaries rather than a seekable media timeline.
export function sourcePlayer(session,button,slider,label,speed,onError){
 const lang=session.dir==="en"?"en":"zh";
 const segments=granularity=>new Intl.Segmenter(lang,{granularity});
 const sentences=typeof Intl.Segmenter==="function"?segments("sentence"):null;
 const words=sentences?segments("word"):null;
 const positions=[];
 for(const idea of session.ideas){
  const lines=sentences?Array.from(sentences.segment(idea),s=>s.segment):[idea];
  for(const text of lines){
   const indices=words?Array.from(words.segment(text)).filter(s=>s.isWordLike).map(s=>s.index):Array.from(text.matchAll(lang==="zh"?/\S/gu:/\S+/gu),s=>s.index);
   if(!indices.length)indices.push(0);
   const end=positions.length+indices.length;
   for(const offset of indices)positions.push({text,offset,end});
  }
 }
 let position=0,playing=false,generation=0,startedAt=null,localOnly=false,voice=null,uninterrupted=true;
 let runSeconds=0,dragging=false,progressTimer=null;
 slider.max=String(positions.length);
 function render(){
  if(!dragging)slider.value=String(position);
  const percent=Math.round(100*position/positions.length);
  if(!dragging)label.textContent=percent+"% of source";
  slider.setAttribute("aria-valuetext",label.textContent);
  button.textContent=playing?"Ⅱ Pause speech":position===positions.length?"▶ Replay speech":position?"▶ Resume speech":"▶ Play speech";
 }
 function interrupt(){
  generation++;
  clearInterval(progressTimer);
  if(startedAt!==null){
   const elapsed=(performance.now()-startedAt)/1000;
   session.listenSeconds+=elapsed;runSeconds+=elapsed;startedAt=null;
  }
  if(playing)window.speechSynthesis?.cancel();
  playing=false;
 }
 function speak(){
  if(!window.speechSynthesis){onError("Speech playback is unavailable in this browser.");return}
  if(position>=positions.length){position=0;uninterrupted=true;runSeconds=0}
  playing=true;startedAt=performance.now();render();
  const token=++generation;
  function next(){
   if(token!==generation)return;
   if(position===positions.length){
    interrupt();if(uninterrupted)session.speechSeconds=runSeconds;
    render();return;
   }
   const first=position,entry=positions[first];
   const line=new SpeechSynthesisUtterance(entry.text.slice(entry.offset));
   line.rate=Number(speed.value);
   voice??=preferredVoice(speechSynthesis.getVoices(),lang,localOnly);
   line.voice=voice;line.lang=voice?.lang??(lang==="en"?"en-US":"zh-CN");
   let started=false;
   line.onstart=()=>{
    if(token!==generation)return;
    started=true;
    // Some system voices omit word boundaries. Estimate progress only until
    // the voice supplies its own position, never crossing a sentence boundary.
    const began=performance.now();
    progressTimer=setInterval(()=>{
     if(token!==generation)return;
     const units=(performance.now()-began)/1000*line.rate*(lang==="en"?2.15:3.5);
     if(lang==="en")position=Math.min(entry.end-1,first+Math.floor(units));
     else while(position+1<entry.end && positions[position+1].offset<=entry.offset+units)position++;
     render();
    },180);
   };
   line.onboundary=event=>{
    if(token!==generation)return;
    clearInterval(progressTimer);
    const offset=entry.offset+event.charIndex;
    position=first;
    while(position+1<entry.end && positions[position+1].offset<=offset)position++;
    render();
   };
   line.onend=()=>{
    if(token!==generation)return;
    clearInterval(progressTimer);
    position=entry.end;render();
    if(position===positions.length)next();else setTimeout(next,100/line.rate);
   };
   line.onerror=()=>{
    if(token!==generation)return;
    clearInterval(progressTimer);
    if(!started && voice && !voice.localService && !localOnly){
     localOnly=true;voice=null;next();return;
    }
    interrupt();render();onError("Playback failed. Check your system voice and press play to retry.");
   };
   speechSynthesis.speak(line);
  }
  speechSynthesis.resume();next();
 }
 function pause(){
  if(!playing)return;
  interrupt();render();button.textContent="▶ Resume speech";
 }
 button.onclick=()=>playing?pause():speak();
 slider.oninput=()=>{dragging=true;label.textContent=Math.round(100*Number(slider.value)/positions.length)+"% of source"};
 slider.onchange=()=>{
  const newPosition=Number(slider.value),resume=playing;
  dragging=false;interrupt();position=newPosition;uninterrupted=position===0;runSeconds=0;
  render();if(resume && position<positions.length)speak();
 };
 render();
 return {pause,stop(){interrupt();position=0;uninterrupted=true;runSeconds=0;render()},get playing(){return playing}};
}
