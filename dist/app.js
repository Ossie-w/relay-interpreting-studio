import {prepareTranscription} from "./transcription.js?v=20261112";
import {topics,weekdays,defaultPlan,directionName,clock,localDate,score,escapeHTML as esc,demoSpeech,example} from "./practice.js";
import {generateSpeech,reviseSpeechDuration,assess,transcribe} from "./ai.js?v=20261112";
import {sourcePlayer} from "./playback.js?v=20261112";
import {openMicrophone,microphoneProblem} from "./microphone.js";
import {cachedTimedNarration,prepareTimedSpeech} from "./timed-narration.js";
import {playableRecording} from "./recording.js";
import {cancelNarration} from "./narration.js";
let narrationURL="",voiceJob=null,micTestURL="";
const $=id=>document.getElementById(id);
function read(key,fallback){try{return JSON.parse(localStorage.getItem("relay-"+key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem("relay-"+key,JSON.stringify(value))}
let plan=read("plan",defaultPlan),records=read("history",[]),dir=plan.direction,topic=plan.topics[0],attempt=null,recorder=null,takeURL="",busy=false,speechRun=null,recordTimer=null,noticeTimer;
const today=()=>localDate(new Date());
function notice(msg){$("notice").textContent=msg;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$("notice").textContent="",6500)}
function status(s){const node=$("sessionstatus");if(node) node.textContent=s}
function busyState(value){busy=value;for(const id of ["generate","demo","record","evaluate","retryASR","sourcePlay","finishSession","regenerate","easier","harder","testMic","uploadRecording","microphone","offlineExercise"])if($(id))$(id).disabled=value;if($("corrected"))$("corrected").disabled=value;if($("sampleAudio"))$("sampleAudio").controls=!value;if($("sourceSeek"))$("sourceSeek").disabled=value;if($("uploadRecording"))$("uploadRecording").disabled=value||!!attempt?.saved;if($("easier"))$("easier").disabled=value||attempt?.difficulty==="Beginner";if($("harder"))$("harder").disabled=value||attempt?.difficulty==="Advanced";}
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
 speechRun?.pause();
}
function stopSpeech(){
 speechRun?.stop();$("sampleAudio")?.pause();$("replay")?.pause();$("micTestReplay")?.pause();
}
function discard(){if(recorder||busy||voiceJob){notice("Finish the current operation first.");return false}
 if(attempt&&!attempt.saved&&(attempt.blob||$("corrected")?.value.trim())&&!confirm("Start a new session and discard the unsaved attempt?"))return false;
 stopSpeech();voiceJob=null;cancelNarration();
 if(narrationURL)URL.revokeObjectURL(narrationURL);narrationURL="";
 if(micTestURL)URL.revokeObjectURL(micTestURL);micTestURL="";
 if(takeURL)URL.revokeObjectURL(takeURL);takeURL="";attempt=null;speechRun=null;return true;}
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
function historyView(){ $("history").innerHTML=`<article class="card"><h2>Your attempts</h2><p class="secondary block">${records.length?"Saved on this browser.":"Your completed practice will appear here."}</p>${records.map(row).join("")}</article><article class="card"><h2>Prepared examples</h2><button id="offlineExercise" class="block">Open offline practice</button><p class="secondary block">Prepared assessments for the same speech. Choose a direction to compare outcomes.</p><select id="examplesDir" aria-label="Example direction"><option value="en">English → Mandarin</option><option value="zh">Mandarin → English</option></select><div id="samples"></div></article>`;
 $("offlineExercise").onclick=()=>{if(discard()){location.hash="#studio";newSession(demoSpeech($("examplesDir").value))}};
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
function connectAudio(audio,session){
 let start=null;const finish=()=>{if(start!==null){session.listenSeconds+=Math.max(0,(performance.now()-start)/1000);start=null}};
 audio.onratechange=()=>{
  const select=$("playbackSpeed");
  if(!Array.from(select.options).some(option=>Number(option.value)===audio.playbackRate))
   select.add(new Option(audio.playbackRate+"×",audio.playbackRate));
  select.value=String(audio.playbackRate);
 };
 audio.onloadedmetadata=()=>{if(Number.isFinite(audio.duration)){session.speechSeconds=audio.duration;$("playtime").textContent="Source duration · "+clock(audio.duration)}};
 audio.onplaying=()=>{if(start===null)start=performance.now()};audio.onpause=finish;audio.onended=finish;
 audio.addEventListener("play",()=>$("replay").pause());
}
function mountNarration(session,blob,message){
 if(attempt!==session||!$("sourcePlay"))return;
 speechRun?.stop();speechRun=null;
 const audio=document.createElement("audio");audio.id="sampleAudio";
 audio.controls=!busy||recorder?.state==="paused";
 $("sourcePlay").replaceWith(audio);$("sourceSeek")?.remove();$("naturalVoice")?.remove();
 connectAudio(audio,session);
 if(narrationURL)URL.revokeObjectURL(narrationURL);
 narrationURL=URL.createObjectURL(blob);audio.src=narrationURL;
 audio.playbackRate=Number($("playbackSpeed").value);
 $("voiceStatus").textContent=message;
}
async function prepareNarration(session){
 if(!voiceJob&&(busy||session.blob||$("corrected").value.trim())){notice("Prepare the timed source audio before recording or entering your interpretation.");return}
 const button=$("naturalVoice"),message=$("voiceStatus");
 if(voiceJob){
  voiceJob=null;cancelNarration();button.textContent="Prepare natural voice";
  message.textContent="Preparation cancelled. Saved model files are kept.";busyState(false);return;
 }
 const job={};voiceJob=job;busyState(true);button.textContent="Cancel preparation";
 try{
  const result=await prepareTimedSpeech(session,text=>{
   if(voiceJob===job&&attempt===session)message.textContent=text;
  },reviseSpeechDuration,()=>voiceJob===job&&attempt===session);
  if(voiceJob!==job||attempt!==session)return;
  Object.assign(session,result.speech);
  $("session").querySelector("h2").textContent=session.title;
  $("manuscript").textContent=session.source;
  $("session").querySelector(".meta").textContent=session.topic+" · "+session.difficulty+" · "+directionName(session.dir)+" · Target "+clock(session.target)+" · Verified at 1×";
  hero(session);
  try{write("daily",{date:today(),speech:result.speech})}catch{}
  mountNarration(session,result.blob,(result.reused?"Saved natural voice restored. Ready to play.":
   result.saved?"Natural voice ready and saved in this browser.":"Natural voice ready. Browser storage is unavailable; this track lasts for this session.")+(result.warning?" "+result.warning:""));
 }catch(error){
  if(voiceJob===job&&attempt===session){
   button.textContent="Prepare natural voice";
   message.textContent="Timed natural voice unavailable. You can use the untimed system preview. "+error.message;
  }
 }finally{if(voiceJob===job){voiceJob=null;busyState(false)}}
}
function hero(speech){
 $("heroLabel").textContent=speech.mode==="Classroom demo"?"OFFLINE PRACTICE":"TODAY’S PRACTICE";
 $("heroTitle").textContent=speech.title;
 $("heroDescription").textContent=speech.topic+" · "+(speech.difficulty||"Beginner")+" · "+directionName(speech.dir)+" · "+clock(speech.target);
 $("demo").textContent="▶ Start this practice";
}
function newSession(speech,scroll=true){
 attempt={...speech,id:crypto.randomUUID(),original:"",recordSeconds:0,listenSeconds:0,speechSeconds:null,blob:null,saved:false};
 hero(speech);
 $("session").hidden=false;$("session").innerHTML=`<small class="kicker">${esc(speech.mode.toUpperCase())}</small><h2>${esc(speech.title)}</h2><div class="wrap"><button id="regenerate" class="regenerate">↻ Regenerate</button><button id="easier" class="regenerate" ${speech.difficulty==="Beginner"?"disabled":""}>− 简单一点</button><button id="harder" class="regenerate" ${speech.difficulty==="Advanced"?"disabled":""}>+ 难一点</button></div><p class="meta">${esc(speech.topic)}${speech.difficulty?" · "+esc(speech.difficulty):""} · ${directionName(speech.dir)} · Target ${clock(speech.target)}${speech.estimatedSeconds?" · Estimated "+clock(speech.estimatedSeconds)+" at 1×":""}</p><div class="block"><h3>1. Listen to the source</h3>${speech.mode==="Classroom demo"?`<audio id="sampleAudio" controls preload="metadata" src="./commute-${speech.dir}.wav"></audio>`:`<button class="action" id="naturalVoice">Prepare natural voice</button> <button id="sourcePlay">▶ Listen now</button>`}<label class="speedControl">Playback speed <select id="playbackSpeed">${[0.75,1,1.25,1.5,2].map(rate=>`<option value="${rate}" ${rate===1?"selected":""}>${rate}×</option>`).join("")}</select></label>${speech.mode==="Classroom demo"?"":`<input type="range" id="sourceSeek" class="sourceSeek" aria-label="Source playback position" min="0" value="0" step="1">`}<p class="note" id="playtime"></p>${speech.mode==="Classroom demo"?"":`<p class="note" id="voiceStatus" role="status">Listen now uses your device voice immediately, without waiting for natural-voice synthesis. Prepare natural voice verifies actual audio against your target at 1×. Short or long manuscripts are rewritten; system playback is an untimed preview. First use saves a voice model (about 340 MB).</p>`}<details><summary>Reveal manuscript</summary><p id="manuscript">${esc(speech.source)}</p></details></div><div class="block sectionrule"><h3>2. Record your interpretation</h3><p class="note">Interpret into ${speech.dir==="en"?"Mandarin":"English"}. You can also enter your interpretation below.</p><label class="micChoice">Microphone <select id="microphone" aria-label="Microphone"><option value="">System default microphone</option></select></label><button id="testMic">Test microphone · 5s</button><div class="micMonitor"><meter id="micLevel" min="0" max="1" value="0" aria-label="Microphone input level"></meter><p id="micStatus" class="note" role="status">Speak after starting: the input bar should move.</p></div><div id="micTestResult" hidden><p class="note">Your five-second microphone test · replay to check your voice</p><audio id="micTestReplay" controls aria-label="Microphone test recording"></audio></div><details id="micHelp"><summary>Microphone connection &amp; help</summary><p id="micDiagnostics" class="note">Permission and input status appear after a test.</p><p class="note">In an embedded Codex / ChatGPT window, test this same link in standalone Edge or Chrome if no input arrives. Allow microphone access in both the browser and Windows Settings → Privacy &amp; security → Microphone, including desktop apps.</p><button id="copySiteLink">Copy link for Edge / Chrome</button></details><label class="micChoice">Or upload a recording <input id="uploadRecording" type="file" accept="audio/*"></label><div class="wrap block"><button id="record">● &nbsp; Start recording</button><button id="finishRecording" hidden>■ Finish recording</button><span id="rectime" class="note"></span></div><audio hidden id="replay" controls></audio><button id="retryASR" hidden>Retry transcription</button></div><div class="block sectionrule"><h3>3. Review and assess</h3><label for="corrected" class="field">Your reviewed transcript</label><p id="transcriptStatus" class="note" role="status">Finish a recording to transcribe it automatically.</p><textarea id="corrected" rows="5" placeholder="Your transcript appears here. You can correct recognition errors before assessment."></textarea><details id="originalBox" hidden><summary>Original transcription</summary><p id="originalText"></p></details><button class="action" id="evaluate">Assess and save attempt</button></div><div role="status" class="sessionstatus" id="sessionstatus"></div>`;
 $("playbackSpeed").onchange=()=>{
  const audio=$("sampleAudio");
  if(audio)audio.playbackRate=Number($("playbackSpeed").value);
  else speechRun?.changeRate();
 };
 if($("sampleAudio")){
 connectAudio($("sampleAudio"),attempt);
 }else{
  const session=attempt;
  $("naturalVoice").onclick=()=>prepareNarration(session);
  cachedTimedNarration(session).then(blob=>{
   if(blob&&attempt===session&&!voiceJob)mountNarration(session,blob,"Saved natural voice restored. Ready to play.");
  });
  window.speechSynthesis?.getVoices();
  speechRun=sourcePlayer(attempt,$("sourcePlay"),$("sourceSeek"),$("playtime"),$("playbackSpeed"),status);
 }
 $("replay").onplay=pauseSource;
 $("sourcePlay")?.addEventListener("click",()=>$("replay").pause());

 if(speech.mode==="Classroom demo"){
 const panel=document.createElement("details");
 panel.innerHTML='<summary>Rehearse with a prepared assessment</summary><p class="note">Choose an instructor example to review its transcript and feedback offline.</p><div class="chips"><button data-prepared="faithful">Faithful paraphrase</button><button data-prepared="number">Changed number</button><button data-prepared="omission">Omitted idea</button></div>';
 panel.onclick=e=>{const variant=e.target.dataset.prepared;if(variant)showReport(example(speech.dir,variant))};
 $("session").append(panel);
 }
 refreshMicrophones();
 $("microphone").onchange=()=>{try{write("microphone",$("microphone").value)}catch{}};
 const regenerate=delta=>{
  const levels=["Beginner","Intermediate","Advanced"],level=Math.max(0,levels.indexOf(attempt.difficulty));
  generateSession({dir:attempt.dir,topic:attempt.topic,target:attempt.target,difficulty:levels[Math.max(0,Math.min(2,level+delta))]});
 };
 $("regenerate").onclick=()=>regenerate(0);$("easier").onclick=()=>regenerate(-1);$("harder").onclick=()=>regenerate(1);
 $("testMic").onclick=testMicrophone;
 $("uploadRecording").onchange=uploadRecording;
 $("copySiteLink").onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+"/");notice("Link copied. Paste it into standalone Edge or Chrome.")}catch{notice("Copy the address from your browser’s address bar.")}};
 $("finishRecording").onclick=finishRecording;$("record").onclick=record;$("retryASR").onclick=()=>recognizeTake();$("evaluate").onclick=evaluate;
 if(scroll)$("session").scrollIntoView({behavior:"smooth",block:"start"});
}
async function generateSession(settings,isDaily=false){
 // Keep the current exercise until its replacement succeeds.
 if(recorder||busy||voiceJob)return notice("Finish the current operation first.");
 if(attempt&&!attempt.saved&&(attempt.blob||$("corrected")?.value.trim())&&!confirm("Generate a new exercise and discard the unsaved attempt?"))return;
 stopSpeech();busyState(true);
 const report=text=>{status(text);$("heroDescription").textContent=text};
 $("demo").textContent="Preparing practice…";
 if(!attempt){$("session").hidden=false;$("session").innerHTML='<h2>Preparing today’s practice</h2><p class="sessionstatus" role="status" id="sessionstatus"></p>'}
 try{
  const speech=await generateSpeech(settings.dir,settings.topic,settings.target,report,settings.difficulty);
  busyState(false);
  // Confirmation has already been given; do not prompt a second time.
  if(attempt)attempt.saved=true;
  discard();newSession(speech,!isDaily);
  try{write("daily",{date:today(),speech})}catch{notice("This browser could not save today’s recommendation.")}
 }catch(error){
  if(attempt)hero(attempt);
  else{$("heroTitle").textContent="Your daily interpreting practice";$("demo").textContent="Retry daily recommendation"}
  const message="Generation unavailable. "+error.message;
  $("heroDescription").textContent=message;status(message);
 }finally{busyState(false)}
}
function dailySettings(){
 const choices=plan.topics.length?plan.topics:topics;
 return {dir:plan.direction,topic:choices[crypto.getRandomValues(new Uint32Array(1))[0]%choices.length],target:60,difficulty:"Intermediate"};
}
function openDaily(){
 if(attempt){location.hash="#studio";$("session").scrollIntoView({behavior:"smooth"});return}
 const saved=read("daily",null);
 if(saved?.date===today()&&saved.speech?.source){newSession(saved.speech,false);return}
 return generateSession(dailySettings(),true);
}
$("demo").onclick=openDaily;
$("setup").onsubmit=e=>{
 e.preventDefault();
 generateSession({dir,topic,target:Number($("duration").value),difficulty:$("difficulty").value});
};
async function refreshMicrophones(selected=read("microphone","")){
 const select=$("microphone");if(!select)return;
 try{
  const devices=await navigator.mediaDevices.enumerateDevices();
  if(select!==$("microphone"))return;
  select.replaceChildren(new Option("System default microphone",""));
  for(const [i,device] of devices.filter(d=>d.kind==="audioinput"&&d.deviceId).entries())
   select.add(new Option(device.label||"Microphone "+(i+1),device.deviceId));
  select.value=Array.from(select.options).some(o=>o.value===selected)?selected:"";
 }catch{}
}
function micDiagnostics(data){
 if(!data)return;
 $("micDiagnostics").textContent="Last input check · Permission: "+data.permission+" · Input track: "+data.track+
  (data.muted?" (muted)":"")+" · Audio engine: "+data.context+" · Native recorder: "+data.native+
  " · Captured frames: "+data.frames;
}
async function testMicrophone(){
 if(busy||voiceJob||recorder)return;
 pauseSource();$("replay").pause();$("micTestReplay").pause();busyState(true);
 $("micTestResult").hidden=true;
 $("micHelp").open=true;$("micStatus").textContent="Allow microphone permission, then speak for five seconds.";
 let test;
 try{
  test=await openMicrophone($("microphone").value,(level,seconds,details)=>{
   $("micLevel").value=Math.min(1,level*8);micDiagnostics(details);
   $("micStatus").textContent="Speak now · "+Math.max(0,5-Math.floor(seconds))+"s remaining";
  },()=>{});
  await refreshMicrophones(test.deviceId);
  await new Promise(resolve=>setTimeout(resolve,5000));
  const capture=await test.stop();
  if(micTestURL)URL.revokeObjectURL(micTestURL);
  micTestURL=URL.createObjectURL(capture.blob);
  const playback=$("micTestReplay");playback.src=micTestURL;playback.muted=false;playback.volume=1;playback.load();
  $("micTestResult").hidden=false;
  $("micDiagnostics").textContent+=" · Captured peak: "+capture.peak.toFixed(6)+" · RMS: "+capture.rms.toFixed(6)+
   " · Selected capture: "+(capture.compatibility?"native recorder":"audio worklet");
  $("micStatus").textContent=capture.quiet?
   "Test failed: a device opened, but the captured audio contains no usable sound. Check Windows Settings → System → Sound → Input: select the microphone, check its input volume and mute switch, and test it with Windows Sound Recorder. If Sound Recorder works, compare this website’s selected microphone and permission. You can upload that recording below.":
   "Microphone test passed: audio was captured"+(capture.compatibility?" through the compatibility recorder.":".")+" Replay the test below to confirm you can hear your voice, then start your interpretation.";
 }catch(error){$("micStatus").textContent=microphoneProblem(error)}
 finally{$("micLevel").value=0;busyState(false)}
}
async function uploadRecording(event){
 const file=event.target.files[0];if(!file||busy||recorder||voiceJob||attempt.saved)return;
 if((attempt.blob||$("corrected").value.trim())&&!confirm("Replace this recording and its transcript?")){event.target.value="";return}
 busyState(true);pauseSource();
 try{
  const decoded=await playableRecording(file);
  if(decoded.quiet)throw Error("The uploaded file contains no usable sound.");
  const context=new AudioContext();let audio;
  try{audio=await context.decodeAudioData(await decoded.blob.arrayBuffer())}finally{await context.close()}
  attempt.blob=decoded.blob;attempt.recordSeconds=audio.duration;attempt.original="";
  $("corrected").value="";$("originalBox").hidden=true;
  if(takeURL)URL.revokeObjectURL(takeURL);takeURL=URL.createObjectURL(attempt.blob);
  $("replay").src=takeURL;$("replay").hidden=false;$("replay").load();
  $("rectime").textContent=clock(audio.duration);$("micStatus").textContent="Uploaded recording ready.";
  await recognizeTake();
 }catch(error){$("micStatus").textContent="Could not import audio: "+error.message}
 finally{event.target.value="";busyState(false)}
}
function recordingControls(){
 const paused=recorder.state==="paused";
 $("record").disabled=false;
 $("record").textContent=paused?"● Resume recording":"Ⅱ Pause recording";
 $("finishRecording").hidden=false;
 if($("sourcePlay"))$("sourcePlay").disabled=!paused;
 if($("sampleAudio"))$("sampleAudio").controls=paused;
 if($("sourceSeek"))$("sourceSeek").disabled=!paused;
 status(paused?"Recording paused. Listen to the next passage, then resume recording.":"Recording your interpretation…");
}
async function finishRecording(){
 if(!recorder||recorder.state==="inactive")return;
 const take=recorder,session=attempt;
 recordTimer.pause();pauseSource();
 $("record").disabled=true;$("finishRecording").hidden=true;
 $("micStatus").textContent="Saving microphone audio…";
 try{
  const captured=await take.stop();recorder=null;recordTimer=null;
  session.recordSeconds=captured.seconds;session.blob=captured.blob;
  session.original="";$("corrected").value="";$("originalBox").hidden=true;
  if(takeURL)URL.revokeObjectURL(takeURL);
  takeURL=URL.createObjectURL(captured.blob);
  const replay=$("replay");replay.src=takeURL;replay.muted=false;replay.volume=1;replay.load();replay.hidden=false;
  $("record").textContent="● Record again";$("rectime").textContent=clock(session.recordSeconds);
  $("micLevel").value=0;
  if(captured.quiet){
   busyState(false);$("micHelp").open=true;
   const message="No usable microphone signal was captured. Run Test microphone and check the same input in Windows Sound Recorder. A listed device does not prove that sound is reaching the browser. You can also upload a recording.";
   $("micStatus").textContent=message;$("transcriptStatus").textContent="No speech signal to transcribe.";status(message);
   return;
  }
  $("micStatus").textContent="Recording ready to replay."+(captured.gain>1.05?" Quiet audio has been amplified.":"");
  await recognizeTake();
 }catch(error){
  recorder=null;recordTimer=null;busyState(false);$("record").textContent="● Start recording";
  $("micStatus").textContent=error.message;status(error.message);
 }
}
async function record(){
 if(recorder?.state==="recording"){recorder.pause();recordTimer.pause();recordingControls();return}
 if(recorder?.state==="paused"){
  pauseSource();
  try{await recorder.resume();recordTimer.start();recordingControls()}
  catch(error){notice("Could not resume microphone: "+error.message);await finishRecording()}
  return;
 }
 if(busy||attempt.saved)return;
 if(attempt.blob&&!confirm("Replace this recording and its transcript?"))return;
 pauseSource();$("replay").pause();$("micTestReplay").pause();busyState(true);$("retryASR").hidden=true;
 $("micStatus").textContent="Opening microphone…";$("replay").hidden=true;
 $("transcriptStatus").textContent="Finish recording to create the automatic transcript.";
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error("Recording requires a microphone and a browser on HTTPS or localhost.");
  const session=attempt,timer=activeTimer();
  let lastSignal=performance.now();
  recorder=await openMicrophone($("microphone").value,(level,seconds,diagnostics)=>{
   if(attempt!==session)return;
   $("micLevel").value=Math.min(1,level*8);
   micDiagnostics(diagnostics);
   $("rectime").textContent=clock(seconds);
   if(level>0.001)lastSignal=performance.now();
   $("micStatus").textContent=recorder?.state==="paused"?"Recording paused.":
    diagnostics?.muted?"The browser has muted the microphone track. Check the host app’s microphone permission.":
    diagnostics?.context!=="running"?"Audio processing is suspended. Finish and retry from standalone Edge or Chrome.":
    performance.now()-lastSignal>3500?"Microphone opened, but no sound is arriving. Finish and run Test microphone; if using an embedded window, try standalone Edge or Chrome.":
    "Microphone: "+(recorder?.label||"connecting")+" · "+(level>0.001?"Sound detected":"Speak to check the input bar");
  },()=>{notice("Microphone disconnected. Finishing the audio captured so far.");finishRecording()});
  recordTimer=timer;timer.start();recordingControls();
  prepareTranscription(text=>{if(attempt===session&&recorder)$("transcriptStatus").textContent=text});
  refreshMicrophones(recorder.deviceId);
 }catch(error){
  recorder=null;busyState(false);
  const message=microphoneProblem(error)+" You can type your interpretation below.";
  $("micHelp").open=true;$("replay").hidden=!takeURL;
  $("micStatus").textContent=message;status(message);
 }
}
async function recognizeTake(){
 const session=attempt;busyState(true);$("retryASR").hidden=true;
 const report=text=>{if(attempt===session){$("transcriptStatus").textContent=text;status(text)}};
 try{
  const text=await transcribe(session.blob,session.dir,report);
  if(!text)throw Error("No speech detected.");
  session.original=text;$("corrected").value=text;$("originalText").textContent=text;$("originalBox").hidden=false;
  report("Automatic transcript ready. Correct any recognition errors before assessment.");
 }catch(error){
  $("retryASR").hidden=false;report("Transcription unavailable. "+error.message+" Your audio is kept; retry or enter the transcript manually.");
 }finally{busyState(false)}
}
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
if(!location.hash||location.hash==="#studio")openDaily();

