export const topics = ["Public services", "Education", "Technology", "Environment", "Business"];
export const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const defaultPlan = { direction:"en", minutes:15, days:[1,2,3,4,5], topics:[...topics] };
export const directionName = dir => dir === "en" ? "English → Mandarin" : "Mandarin → English";
export const clock = seconds => Math.floor(seconds/60)+":"+String(Math.floor(seconds%60)).padStart(2,"0");
export const localDate = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export const score = rows => Math.round(100*rows.reduce((sum,r)=>sum+r.points,0)/rows.length);
export const escapeHTML = value => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const content = {
en:[
"The city will add thirty electric buses next year. The transport department announced the purchase this morning after listening to residents describe their journeys to work.",
"The new vehicles will serve the two busiest routes first. Both routes connect residential neighborhoods with the central railway station, where many commuters change trains each morning.",
"At peak times, passengers will wait ten minutes instead of twenty. Outside the busiest hours, the current timetable will continue to apply.",
"Fares will stay the same throughout the trial. The city wants to find out whether a more frequent service can persuade drivers to leave their cars at home.",
"After six months, passengers will be invited to give feedback. Their comments will help planners decide whether to expand the service to other neighborhoods."
],
zh:[
"市交通部门今天上午宣布，明年本市将新增三十辆电动公交车。在作出这项决定之前，工作人员听取了居民对日常通勤的意见。",
"新车将优先投入最繁忙的两条线路。这两条线路连接居民区和中央火车站，许多上班族每天早晨都要在那里换乘。",
"高峰时段的候车时间将从二十分钟缩短到十分钟。其他时段的公交车仍然按照现有时刻表运行。",
"在整个试行期间，票价将保持不变。市政府希望了解，更频繁的服务能否吸引更多开车上班的居民选择公交出行。",
"六个月后，乘客将有机会对新服务提出意见。规划人员将根据这些反馈决定是否把服务推广到其他社区。"
]};
export function demoSpeech(dir) {
 return {dir,topic:"Public services",target:60,title:"The morning commute",ideas:[...content[dir]],source:content[dir].join("\n\n"),mode:"Classroom demo"};
}
export function example(dir="en",variant="number") {
 const speech=demoSpeech(dir);
 const other=content[dir==="en"?"zh":"en"];
 const accurate=dir==="en"?"明年本市会增购三十辆电动公交车。交通部门今天上午公布了这个消息，之前他们听取了市民对上班通勤的意见。":"Following comments from commuters, the city transport department announced this morning that thirty electric buses will join the fleet next year.";
 const rendered=[accurate,...other.slice(1)];
 if(variant==="number") rendered[0]=rendered[0].replace("三十","十三").replace("thirty","thirteen");
 if(variant==="omission") rendered[4]="";
 const rows=speech.ideas.map((source,i)=>({source,evidence:rendered[i],points:i===4&&variant==="omission"?0:i===0&&variant==="number"?0.5:1,
 reason:i===0&&variant==="number"?"The purchase and timing are preserved. The quantity changed from 30 to 13.":i===4&&variant==="omission"?"The six-month passenger feedback and expansion decision are missing.":"This passage conveys the source idea."}));
 const transcript=rendered.filter(Boolean).join("\n");
 return {...speech,id:"example-"+dir+"-"+variant,fixture:true,original:transcript,transcript,rows,score:score(rows),suggestion:variant==="number"?"Practise 13 and 30 as a pair. Listen, write each number as digits, then interpret the full sentence again.":variant==="omission"?"Note the final time marker and decision before you speak. Repeat the last passage from your notes.":"Try delivering the same key ideas with shorter sentences while preserving every figure.",speechSeconds:null,recordSeconds:null};
}
export function validateAssessment(ideas,transcript,data){
 if(!Array.isArray(data.rows)||data.rows.length!==ideas.length||typeof data.suggestion!=="string"||!data.suggestion.trim()) throw Error("Assessment was incomplete. Please retry.");
 const rows=ideas.map((source,i)=>{const row=data.rows[i];if(!row||![0,.5,1].includes(row.points)||typeof row.reason!=="string"||!row.reason.trim()||typeof row.evidence!=="string"||!transcript.includes(row.evidence)||(row.points>0&&!row.evidence.trim())) throw Error("Assessment evidence could not be verified. Please retry.");return {source,points:row.points,reason:row.reason,evidence:row.evidence}});
 return {rows,score:score(rows),suggestion:data.suggestion};
}

