import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({})}});window.prompts=[];window.replies=[]});
 await page.route(/\/vendor\/web-llm-0\.2\.79\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
 export async function hasModelInCache(){return true}
 export async function CreateMLCEngine(){return {chat:{completions:{create:async req=>{
  const prompt=req.messages.at(-1).content;window.prompts.push(prompt);
  if(window.replies.length)return {choices:[window.replies.shift()]};
  const count=Number(prompt.match(/Target for this response: ([0-9]+)/)[1]),zh=prompt.includes('Language: Simplified Mandarin Chinese');
  const sentence=zh?'本次试行将增加公交班次，方便居民出行。':'The trial will add 30 buses to the busiest route next year.';
  const unit=zh?sentence.match(/[\u3400-\u9fff]/g).length:sentence.split(' ').length;
  const keys=Object.keys(JSON.parse(req.response_format.schema).properties).filter(k=>k.startsWith('paragraph_'));
  const paragraphs=Object.fromEntries(keys.map((key,i)=>[key,Array.from({length:Math.max(1,Math.round(count/unit/keys.length))},(_,j)=>(zh?'本次'+window.prompts.length+'号通报的'+i+'项'+j+'次措施，':'In briefing '+window.prompts.length+' item '+i+' step '+j+', ')+sentence).join(' ')]));
  return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'Practice',...paragraphs})}}]};
 }}}}}
 `}));
 await page.goto(origin+'/#history');
 const checks=await page.evaluate(async()=>{
  const {generateSpeech}=await import('./ai.js?recovery');const {speechUnits,targetUnits,textFits}=await import('./timing.js');
  const sentence='The city will add 30 buses to the busiest route next year.';
  const paragraph=Array(4).fill(sentence).join(' ');
  const partial='{"title":"New buses","paragraphs":['+[paragraph,paragraph,paragraph].map(JSON.stringify).join(',')+',"unfinished';
  replies=[{finish_reason:'length',message:{content:partial}}];
  const truncated=await generateSpeech('en','Public services',60,()=>{},'Intermediate');
  const firstCount=prompts.length;
  replies=[{finish_reason:'stop',message:{content:JSON.stringify({title:'Long speech',paragraphs:[Array(30).fill(sentence).join(' ')]})}}];
  const long=await generateSpeech('en','Public services',60,()=>{},'Intermediate');
  const secondCount=prompts.length;
  const bounds=[];
  for(const dir of ['en','zh'])for(const target of [60,75,300]){
   const s=await generateSpeech(dir,'Technology',target,()=>{},'Intermediate');
   bounds.push({dir,target,words:speechUnits(s.source,dir),fits:textFits(speechUnits(s.source,dir),targetUnits(target,dir))});
  }
  return {truncated,long,firstCount,secondCount,bounds};
 });
 assert.equal(checks.firstCount,1,'Complete passages from truncated JSON must be usable immediately');
 assert.equal(checks.secondCount,2,'An overlong usable draft must not trigger six rewrites');
 assert.ok(checks.bounds.every(x=>x.fits),JSON.stringify(checks.bounds));
 assert.ok(!checks.truncated.source.includes('unfinished'));
 console.log('Truncated JSON, oversized manuscript, both directions and 60/75/300-second targets passed.',JSON.stringify(checks.bounds));
}finally{await browser.close();server.kill()}
