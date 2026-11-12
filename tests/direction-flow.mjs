import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
process.on('exit',()=>server.kill());
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||undefined,headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({})}});
  window.requests=[];window.starts=0;window.failStarts=2;
 });
 // Check the shipped runtime itself imports without contacting a runtime CDN.
 await page.goto(origin+'/#history');
 assert.equal(await page.evaluate(async()=>typeof (await import('./vendor/web-llm-0.2.79.js')).CreateMLCEngine),'function');
 await page.route(/\/vendor\/web-llm-0\.2\.79\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
 export async function hasModelInCache(){return true}
 export async function CreateMLCEngine(){
  window.starts++;if(window.starts<=window.failStarts)throw Error('Failed to fetch');
  return {unload:async()=>{},chat:{completions:{create:async(request)=>{
   const prompt=request.messages.at(-1).content;window.requests.push(prompt);
   if(window.failNext){window.failNext=false;throw Error('Failed to fetch')}
   if(window.hold)await new Promise(resolve=>window.release=resolve);
   const chinese=prompt.includes('Language: Simplified Mandarin Chinese');
   const count=Number(prompt.match(/Target for this response: ([0-9]+)/)[1]);
   const ideas=window.drafts?.length?window.drafts.shift():[(chinese?'学':'practice ').repeat(count)];
   return {choices:[{message:{content:JSON.stringify({title:chinese?'中文练习':'English practice',ideas})}}]};
  }}}};
 }`}));
 await page.evaluate(()=>{
  const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  localStorage.setItem('relay-daily',JSON.stringify({date,speech:{dir:'zh',topic:'Education',target:60,difficulty:'Intermediate',title:'旧中文练习',source:'中文原文。',ideas:['中文原文。'],mode:'AI-generated'}}));
  localStorage.setItem('relay-direction',JSON.stringify('zh'));
 });
 await page.goto(origin+'/#studio');await page.reload();
 await page.waitForSelector('#regenerate').catch(async e=>{console.log(await page.locator('body').innerText(),await page.evaluate(()=>({...localStorage})),errors);throw e});
 assert.match(await page.locator('#heroTitle').textContent(),/旧中文/);
 assert.equal(await page.locator('[data-dir=zh]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-dir=en]').click();
 assert.equal(await page.locator('#session').isVisible(),false);
 assert.match(await page.locator('#heroTitle').textContent(),/English/);
 await page.locator('#duration').fill('75');
 await page.locator('#generate').click();
 await page.waitForSelector('#generationError:not([hidden])');
 assert.match(await page.locator('#generationMessage').textContent(),/Model files could not be loaded/);
 assert.equal(await page.evaluate(()=>starts),2);
 await page.locator('#retryGeneration').click();
 await page.waitForSelector('#regenerate');
 assert.equal(await page.locator('#heroTitle').textContent(),'English practice');
 assert.equal(await page.locator('#generationError').isVisible(),false);
 assert.match(await page.locator('#session .meta').textContent(),/English → Mandarin · Target 1:15/);
 await page.locator('[data-dir=zh]').click();
 assert.equal(await page.locator('#heroTitle').textContent(),'旧中文练习');
 await page.locator('#regenerate').click();
 await page.waitForFunction(()=>document.querySelector('#heroTitle').textContent==='中文练习');
 assert.match(await page.locator('#session .meta').textContent(),/Mandarin → English/);
 await page.locator('[data-dir=en]').click();
 assert.equal(await page.locator('#heroTitle').textContent(),'English practice');
 assert.equal(await page.locator('#duration').inputValue(),'75');
 // Source playback must follow the restored manuscript's language.
 await page.evaluate(()=>{Object.defineProperty(speechSynthesis,'speak',{value:u=>window.spoken=u.lang})});
 await page.locator('#sourcePlay').click();
 assert.match(await page.evaluate(()=>spoken),/^en/);
 await page.reload();await page.waitForSelector('#regenerate');
 assert.equal(await page.locator('#heroTitle').textContent(),'English practice');
 await page.locator('#corrected').fill('My unsaved interpretation');
 page.once('dialog',d=>d.dismiss());await page.locator('[data-dir=zh]').click();
 assert.equal(await page.locator('[data-dir=en]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#corrected').inputValue(),'My unsaved interpretation');
 await page.locator('#corrected').fill('');
 await page.evaluate(()=>{window.failStarts=0;window.hold=true});
 await page.locator('#generate').click();
 await page.waitForFunction(()=>!!window.release);
 assert.equal(await page.locator('[data-dir=zh]').isDisabled(),true);
 await page.evaluate(()=>{window.hold=false;window.release()});
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 // A failed warm engine must not poison future attempts or overwrite the old speech.
 await page.evaluate(()=>window.failNext=true);
 await page.locator('#regenerate').click();await page.waitForSelector('#generationError:not([hidden])');
 assert.equal(await page.locator('#heroTitle').textContent(),'English practice');
 await page.locator('#retryGeneration').click();
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled&&document.querySelector('#generationError').hidden);
 assert.match(await page.evaluate(()=>requests.at(-1)),/Language: English/);
 // Wrong-language output is rejected; a short draft is expanded, not accepted.
 await page.evaluate(()=>window.drafts=[['这是一篇中文稿件。'.repeat(25)],['word '.repeat(60)],['detail '.repeat(131)]]);
 await page.locator('#regenerate').click();
 await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 assert.equal(await page.locator('#generationError').isVisible(),false);
 assert.equal((await page.locator('#manuscript').textContent()).trim().split(/\s+/).length,191);
 assert.deepEqual(errors,[]);
 console.log('Direction regression passed: legacy cache, en→zh→en, reload, playback language, unsaved protection, network retries, strict length and wrong-language rejection.');
}finally{await browser.close();server.kill()}
