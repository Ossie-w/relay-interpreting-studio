import {topics,weekdays,defaultPlan,directionName,clock,localDate,score,escapeHTML as esc,demoSpeech,example} from "./practice.js";
import {generateSpeech,assess,transcribe} from "./ai.js";
const $=id=>document.getElementById(id);
function read(key,fallback){try{return JSON.parse(localStorage.getItem("relay-"+key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem("relay-"+key,JSON.stringify(value))}
let plan=read("plan",defaultPlan),records=read("history",[]),dir=plan.direction,topic=plan.topics[0],attempt=null,recorder=null,takeURL="",busy=false,speechRun=null,recordTimer=null,noticeTimer;
const today=()=>localDate(new Date());
function notice(msg){$("notice").textContent=msg;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$("notice").textContent="",6500)}
function status(s){const node=$("sessionstatus");if(node) node.textContent=s}
function busyState(value){busy=value;for(const id of ["generate","demo","record","evaluate","retryASR","sourcePlay","finishSession"])if($(id))$(id).disabled=value;if($("corrected"))$("corrected").disabled=value;if($("sampleAudio"))$("sampleAudio").controls=!value;}
function activeTimer(){
 let elapsed=0, since=null;
 return {
  start(){if(since===null)since=performance.now()},
  pause(){if(since!==null){elapsed+=performance.now()-since;since=null}},
  seconds(){return (elapsed+(since===null?0:performance.now()-since))/1000}
 };
}
function pauseSource(){
 $("sampleAudio")?.pause();
 if(!speechRun||speechRun.paused)return;
 speechRun.paused=true;
 speechRun.timer.pause();
 speechSynthesis.pause();
 $("sourcePlay").textContent="▶ Resume speech";
}
function stopSpeech(){
 if(speechRun){speechRun.timer.pause();speechRun.session.listenSeconds+=speechRun.timer.seconds();speechRun=null;window.speechSynthesis?.cancel()}
 $("sampleAudio")?.pause();if($("sourcePlay"))$("sourcePlay").textContent="▶ Play speech"}
function discard(){if(recorder?.state==="recording"||busy){notice("Finish the current operation first.");return false}
 if(attempt&&!attempt.saved&&(attempt.blob||$("corrected")?.value.trim())&&!confirm("Start a new session and discard the unsaved attempt?"))return false;
 stopSpeech();if(takeURL)URL.revokeObjectURL(takeURL);takeURL="";attempt=null;return true;}
const svg=document.querySelector(".waves"),ns="http://www.w3.org/2000/svg";
for(let i=0;i<73;i++){const path=document.createElementNS(ns,"path");let d="";
 for(let x=0;x<=720;x+=5){const t=x/720,p=i/72,fade=Math.min(1,t*3);const y=158+42*Math.sin(t*7-.4)+Math.sin(t*10+p*2.5)*35+(p-.5)*(38+140*t)+fade*30*Math.sin(t*13-p*3.8);d+=(x?" L":"M")+x+" "+y.toFixed(2)}
 path.setAttribute("d",d);path.setAttribute("fill","none");path.setAttribute("stroke",i<28?"#bb9cf4":i<50?"#9f92ee":"#95d9c1");path.setAttribute("stroke-width",".95");path.setAttribute("opacity",String(.52+.3*i/72));svg.append(path)}
function controls(){for(const b of document.querySelectorAll("[data-dir]"))b.setAttribute("aria-pressed",b.dataset.dir===dir);$("topics").innerHTML=topics.map(t=>`<button type="button" data-topic="${esc(t)}" aria-pressed="${t===topic}">${esc(t)}</button>`).join("")}
$("directions").onclick=e=>{if(e.target.closest("[data-dir]")){dir=e.target.closest("[data-dir]").dataset.dir;controls()}};
$("topics").onclick=e=>{if(e.target.dataset.topic){topic=e.target.dataset.topic;controls()}};
$("duration").oninput=()=>$("target").textContent=clock(Number($("duration").value));
function row(rec){return `<button class="row" data-id="${esc(rec.id)}"><span class="mini" aria-hidden="true">≋</span><span><strong>${esc(rec.title)}</strong><small>${rec.fixture?"Classroom example":esc(new Date(rec.date).toLocaleDateString())} · ${rec.score}%</small></span><em>›</em></button>`}
function dashboard(){
 const now=new Date(),seconds=records.filter(r=>localDate(new Date(r.date))===today()).reduce((n,r)=>n+(r.listenSeconds||0)+(r.recordSeconds||0),0);
 $("goal").innerHTML=`<div class="goalnum">${Math.floor(seconds/60)} <span>/ ${plan.minutes} min</span></div><div class="progress"><i style="width:${Math.min(100,seconds/(plan.minutes*60)*100)}%"></i></div><p class="muted">${plan.days.includes(now.getDay())?"Scheduled practice today":"Optional practice day"}</p><div class="week">${[1,2,3,4,5,6,0].map(d=>`<span class="${d===now.getDay()?"today":""}">${weekdays[d][0]}<b title="${weekdays[d]}">${plan.days.includes(d)?"•":"–"}</b></span>`).join("")}</div>`;
 $("recent").innerHTML=(records.length?records.slice(0,2):[example()]).map(row).join("");
}
function planView(){
 $("plan").innerHTML=`<form id="planForm" class="card"><div class="cardheading"><div class="tile">◷</div><div><h2>Your daily plan</h2><p>Set the defaults for your practice sessions.</p></div></div><fieldset><legend>Default direction</legend><select name="direction">${["en","zh"].map(d=>`<option value="${d}" ${plan.direction===d?"selected":""}>${directionName(d)}</option>`).join("")}</select></fieldset><fieldset><legend>Daily target in minutes</legend><input type="number" name="minutes" value="${plan.minutes}" min="1" max="240" required aria-label="Daily target in minutes"></fieldset><fieldset><legend>Practice days</legend>${weekdays.map((w,i)=>`<label class="choice"><input type="checkbox" name="days" value="${i}" ${plan.days.includes(i)?"checked":""}> ${w}</label>`).join("")}</fieldset><fieldset><legend>Preferred topics</legend>${topics.map(t=>`<label class="choice"><input type="checkbox" name="topics" value="${t}" ${plan.topics.includes(t)?"checked":""}> ${t}</label>`).join("")}</fieldset><button class="action">Save plan</button></form>`;
 $("planForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),days=f.getAll("days").map(Number),themes=f.getAll("topics");if(!days.length||!themes.length)return notice("Choose at least one day and one topic.");const next={days,topics:themes,minutes:Number(f.get("minutes")),direction:f.get("direction")};try{write("plan",next);plan=next;dir=plan.direction;topic=plan.topics[0];controls();dashboard();notice("Daily plan saved.")}catch{notice("Browser storage unavailable. Your plan could not be saved.")}};
}
function historyView(){ $("history").innerHTML=`<article class="card"><h2>Your attempts</h2><p class="secondary block">${records.length?"Saved on this browser.":"Your completed practice will appear here."}</p>${records.map(row).join("")}</article><article class="card"><h2>Classroom examples</h2><p class="secondary block">Prepared assessments for the same speech. Choose a direction to compare outcomes.</p><select id="examplesDir" aria-label="Example direction"><option value="en">English → Mandarin</option><option value="zh">Mandarin → English</option></select><div id="samples"></div></article>`;
 const draw=()=>$("samples").innerHTML=["faithful","number","omission"].map((v,i)=>{const r=example($("examplesDir").value,v);return row({...r,title:["Faithful paraphrase","Changed number","Omitted idea"][i]})}).join("");$("examplesDir").onchange=draw;draw()}
function route(){
 const route=["studio","plan","history"].includes(location.hash.slice(1))?location.hash.slice(1):"studio";
 for(const name of ["studio","plan","history"])$(name).hidden=name!==route;
 document.querySelectorAll("nav a").forEach(a=>{a.classList.toggle("active",a.hash==="#"+route);if(a.classList.contains("active"))a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
 $("title").textContent={studio:"Practice studio",plan:"Training plan",history:"Practice history"}[route];
 if(route==="plan")planView();if(route==="history")historyView();dashboard();
}
window.addEventListener("hashchange",()=>{if(recorder && recorder.state!=="inactive")finishRecording();stopSpeech();route()});
function showReport(r){$("report").innerHTML=`<small class="kicker">${r.fixture?"PREPARED CLASSROOM EXAMPLE":"SAVED PRACTICE"}</small><h2>${esc(r.title)}</h2><p class="meta">${esc(directionName(r.dir))} · ${esc(r.topic)}${r.difficulty?" · "+esc(r.difficulty):""}${r.date?" · "+esc(new Date(r.date).toLocaleString()):""}</p><div class="block"><div class="score">${r.score}%</div><b>${r.fixture?"Prepared meaning-accuracy example":"AI-estimated meaning accuracy"}</b><p>Accurate = 1 · Partial = ½ · Omitted or contradicted = 0</p></div><h3>Idea breakdown</h3>${r.rows.map((item,i)=>`<div class="verdict"><b>Idea ${i+1} · ${item.points}/1</b><p>${esc(item.source)}</p><p class="strong">${item.evidence?"“"+esc(item.evidence)+"”":"No matching passage"}</p><p>${esc(item.reason)}</p></div>`).join("")}<h3>Next exercise</h3><p>${esc(r.suggestion)}</p><details><summary>Manuscript and transcripts</summary><h3>Source manuscript</h3><p>${esc(r.source)}</p><h3>Original transcription</h3><p>${esc(r.original)||"Manually entered attempt"}</p><h3>Reviewed transcript</h3><p>${esc(r.transcript)}</p></details><p class="note">Target ${clock(r.target)} · Speech ${r.speechSeconds==null?"unmeasured":clock(r.speechSeconds)} · Recording ${r.recordSeconds==null?"—":clock(r.recordSeconds)}</p>`;$("detail").showModal()}
document.addEventListener("click",e=>{const id=e.target.closest("[data-id]")?.dataset.id;if(!id)return;const r=records.find(x=>x.id===id);if(r)showReport(r);else if(id.startsWith("example-")){const [,d,v]=id.split("-");showReport(example(d,v))}});
document.querySelector(".close").onclick=()=>$("detail").close();
function newSession(speech){
 attempt={...speech,id:crypto.randomUUID(),original:"",recordSeconds:0,listenSeconds:0,speechSeconds:null,blob:null,saved:false};
 $("session").hidden=false;$("session").innerHTML=`<small class="kicker">${esc(speech.mode.toUpperCase())}</small><h2>${esc(speech.title)}</h2><p class="meta">${esc(speech.topic)}${speech.difficulty?" · "+esc(speech.difficulty):""} · ${directionName(speech.dir)} · Target ${clock(speech.target)}${speech.estimatedSeconds?" · Estimated "+clock(speech.estimatedSeconds)+" at 1×":""}</p><div class="block"><h3>1. Listen to the source</h3>${speech.mode==="Classroom demo"?`<audio id="sampleAudio" controls preload="metadata" src="./commute-${speech.dir}.wav"></audio>`:`<button id="sourcePlay">▶ Play speech</button>`}<label class="speedControl">Playback speed <select id="playbackSpeed">${[0.75,1,1.25,1.5,2].map(rate=>`<option value="${rate}" ${rate===1?"selected":""}>${rate}×</option>`).join("")}</select></label><p class="note" id="playtime"></p><details><summary>Reveal manuscript</summary><p>${esc(speech.source)}</p></details></div><div class="block sectionrule"><h3>2. Record your interpretation</h3><p class="note">Interpret into ${speech.dir==="en"?"Mandarin":"English"}. You can also enter your interpretation below.</p><div class="wrap block"><button id="record">● &nbsp; Start recording</button><button id="finishRecording" hidden>■ Finish recording</button><span id="rectime" class="note"></span></div><audio hidden id="replay" controls></audio><button id="retryASR" hidden>Retry transcription</button></div><div class="block sectionrule"><h3>3. Review and assess</h3><label for="corrected" class="field">Your reviewed transcript</label><textarea id="corrected" rows="5" placeholder="Your transcript appears here. You can correct recognition errors before assessment."></textarea><details id="originalBox" hidden><summary>Original transcription</summary><p id="originalText"></p></details><button class="action" id="evaluate">Assess and save attempt</button></div><div role="status" class="sessionstatus" id="sessionstatus"></div>`;
 $("playbackSpeed").onchange=()=>{
  const audio=$("sampleAudio");
  if(audio)audio.playbackRate=Number($("playbackSpeed").value);
  else if(speechRun)status("Playback speed changes at the next sentence.");
 };
 if($("sampleAudio")){
 const audio=$("sampleAudio");let start=null;const finish=()=>{if(start!==null){attempt.listenSeconds+=Math.max(0,(performance.now()-start)/1000);start=null}};
 audio.onratechange=()=>{
  const select=$("playbackSpeed");
  if(!Array.from(select.options).some(option=>Number(option.value)===audio.playbackRate))
   select.add(new Option(audio.playbackRate+"×",audio.playbackRate));
  select.value=String(audio.playbackRate);
 };
 audio.onloadedmetadata=()=>{if(Number.isFinite(audio.duration)){attempt.speechSeconds=audio.duration;$("playtime").textContent="Source duration · "+clock(audio.duration)}};
 audio.onplaying=()=>{if(start===null)start=performance.now()};audio.onpause=finish;audio.onended=finish;
 }else{$("sourcePlay").onclick=playGenerated;$("playtime").textContent="Playback duration is measured after a full listen."}
 if(speech.mode==="Classroom demo"){
 const panel=document.createElement("details");
 panel.innerHTML='<summary>Rehearse with a prepared assessment</summary><p class="note">Choose an instructor example to review its transcript and feedback offline.</p><div class="chips"><button data-prepared="faithful">Faithful paraphrase</button><button data-prepared="number">Changed number</button><button data-prepared="omission">Omitted idea</button></div>';
 panel.onclick=e=>{const variant=e.target.dataset.prepared;if(variant)showReport(example(speech.dir,variant))};
 $("session").append(panel);
 }
 $("finishRecording").onclick=finishRecording;$("record").onclick=record;$("retryASR").onclick=()=>recognizeTake();$("evaluate").onclick=evaluate;
 $("session").scrollIntoView({behavior:"smooth",block:"start"});
}
$("demo").onclick=()=>{if(discard())newSession(demoSpeech(dir))};
$("setup").onsubmit=async e=>{e.preventDefault();if(!discard())return;busyState(true);$("session").hidden=false;$("session").innerHTML='<h2>Preparing your speech</h2><p class="sessionstatus" role="status" id="sessionstatus"></p>';$("session").scrollIntoView({behavior:"smooth"});try{newSession(await generateSpeech(dir,topic,Number($("duration").value),status,$("difficulty").value))}catch(err){status("Generation unavailable. "+err.message+" The classroom demo is available offline.")}finally{busyState(false)}};
function playGenerated(){
 if(!window.speechSynthesis)return status("Speech synthesis is unavailable in this browser. Use the manuscript or the recorded classroom demo.");
 if(speechRun){
  if(!speechRun.paused){pauseSource();return}
  speechRun.paused=false;
  speechRun.timer.start();
  $("sourcePlay").textContent="Ⅱ Pause speech";
  speechSynthesis.resume();
  if(speechRun.betweenLines)speechRun.next();
  return;
 }
 const session=attempt, lang=session.dir==="en"?"en":"zh";
 const segmenter=typeof Intl.Segmenter==="function"?new Intl.Segmenter(lang,{granularity:"sentence"}):null;
 const lines=segmenter?session.ideas.flatMap(idea=>Array.from(segmenter.segment(idea),part=>part.segment)):session.ideas;
 const run={session,timer:activeTimer(),paused:false,index:0,betweenLines:false};
 speechRun=run;
 run.next=()=>{
  if(speechRun!==run)return;
  run.betweenLines=run.paused;
  if(run.paused)return;
  if(run.index===lines.length){
   run.timer.pause();
   session.speechSeconds=run.timer.seconds();
   $("playtime").textContent="Playback duration · "+clock(session.speechSeconds);
   stopSpeech();return;
  }
  const line=new SpeechSynthesisUtterance(lines[run.index++]);
  line.rate=Number($("playbackSpeed").value);
  line.lang=lang==="en"?"en-US":"zh-CN";
  line.voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang))||null;
  line.onend=run.next;
  line.onerror=e=>{if(speechRun===run){stopSpeech();status("Playback failed ("+e.error+"). Check the installed voice or use the classroom demo.")}};
  speechSynthesis.speak(line);
 };
 speechSynthesis.resume();
 $("sourcePlay").textContent="Ⅱ Pause speech";
 run.timer.start();run.next();
}
function recordingControls(){
 const paused=recorder.state==="paused";
 $("record").disabled=false;
 $("record").textContent=paused?"● Resume recording":"Ⅱ Pause recording";
 $("finishRecording").hidden=false;
 if($("sourcePlay"))$("sourcePlay").disabled=!paused;
 if($("sampleAudio"))$("sampleAudio").controls=paused;
 status(paused?"Recording paused. Listen to the next passage, then resume recording.":"Recording your interpretation…");
}
function finishRecording(){
 if(!recorder||recorder.state==="inactive")return;
 recordTimer.pause();
 pauseSource();
 $("record").disabled=true;
 $("finishRecording").hidden=true;
 recorder.stop();
}
async function record(){
 if(recorder?.state==="recording"){
  recorder.pause();recordTimer.pause();recordingControls();return;
 }
 if(recorder?.state==="paused"){
  pauseSource();recorder.resume();recordTimer.start();recordingControls();return;
 }
 if(busy||attempt.saved)return;
 if(attempt.blob&&!confirm("Replace this recording and its transcript?"))return;
 pauseSource();busyState(true);let stream;
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error("Recording requires a microphone and a browser on HTTPS or localhost.");
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const take=new MediaRecorder(stream),chunks=[],timer=activeTimer();
  take.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  take.start(500);
  recorder=take;recordTimer=timer;timer.start();recordingControls();
  const ticker=setInterval(()=>{$("rectime").textContent=clock(timer.seconds())},250);
  take.onstop=async()=>{
   clearInterval(ticker);timer.pause();stream.getTracks().forEach(t=>t.stop());
   recorder=null;recordTimer=null;$("finishRecording").hidden=true;
   attempt.recordSeconds=timer.seconds();attempt.blob=new Blob(chunks,{type:take.mimeType});
   attempt.original="";$("corrected").value="";$("originalBox").hidden=true;
   if(takeURL)URL.revokeObjectURL(takeURL);
   takeURL=URL.createObjectURL(attempt.blob);$("replay").src=takeURL;$("replay").hidden=false;
   $("record").textContent="● Record again";$("rectime").textContent=clock(attempt.recordSeconds);
   await recognizeTake();
  };
 }catch(e){stream?.getTracks().forEach(t=>t.stop());busyState(false);status(e.name==="NotAllowedError"?"Microphone access was denied. Allow it in browser settings or type your interpretation below.":e.message+" You can type your interpretation below.")}
}
async function recognizeTake(){busyState(true);try{const text=await transcribe(attempt.blob,attempt.dir,status);if(!text)throw Error("No speech detected.");attempt.original=text;$("corrected").value=text;$("originalText").textContent=text;$("originalBox").hidden=false;$("retryASR").hidden=true;status("Check the transcript before assessment.")}
 catch(e){$("retryASR").hidden=false;status("Transcription unavailable. "+e.message+" Replay your recording and enter the transcript manually.")}finally{busyState(false)}}
async function evaluate(){
 if(attempt.saved)return showReport(attempt);
 const transcript=$("corrected").value.trim();if(!transcript){status("Enter or record an interpretation first.");$("corrected").focus();return}
 stopSpeech();busyState(true);
 try{const result=await assess(attempt,transcript,status);const {blob,...data}=attempt;const rec={...data,...result,date:new Date().toISOString(),transcript,saved:true};const updated=[rec,...read("history",[]).filter(r=>r.id!==rec.id)];write("history",updated);records=updated;attempt={...rec,blob};dashboard();if(location.hash==="#history")historyView();status("Analysis saved to practice history.");$("evaluate").textContent="View saved feedback";showReport(rec)}
 catch(e){status("Attempt could not be assessed and saved. "+e.message+" Your transcript is still here.")}finally{busyState(false);if(attempt.saved){$("corrected").disabled=true;$("record").disabled=true;$("retryASR").hidden=true}}
}
$("date").textContent=new Intl.DateTimeFormat("en",{weekday:"short",month:"short",day:"numeric"}).format(new Date());
window.addEventListener("storage",e=>{if(e.key==="relay-history"){records=read("history",[]);route()}});
controls();route();

