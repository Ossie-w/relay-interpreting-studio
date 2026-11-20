import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const [ready]=await once(server.stdout,'data'),url=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const p=await browser.newPage();
 await p.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({body:'player fixture'}));
 await p.route('https://api.deepseek.com/**',r=>{
  if(r.request().url().endsWith('/asr'))return r.fulfill({json:{text:'我们六月开会。'}});
  const input=JSON.parse(r.request().postDataJSON().messages[1].content);
  if(input.units)return r.fulfill({json:{choices:[{message:{content:JSON.stringify({rows:[{unit:1,coverage:1,accuracy:1,vocabulary:1,evidence:[1],quote:'我们六月开会。',reason:'练习反馈'}],weakness:'时间',strength:'行动',suggestion:'复述日期',reference:'我们六月开会。',bank:Array.from({length:5},(_,i)=>({source:'phrase '+i,target:'搭配'}))})}}]}});

  if(input.parts)assert.equal(r.request().postDataJSON().model,"deepseek-v4-pro");
  const value=input.source?{guide:"重要短语与拓展词汇"}:Array.isArray(input)?{feedback:'两次练习均遗漏时间。'}:{pairs:[{end:1,translation:'我们六月开会。'}]};
  return r.fulfill({json:{choices:[{message:{content:JSON.stringify(value)}}]}});
 });
 await p.goto(url);await p.click('a[href="#video"]');await p.fill('#captions','(17:09) We meet in June.');await p.selectOption('#videoModel','deepseek-v4-pro');await p.click('#startVideo');await p.fill('dialog[open] input[type=password]','fake');await p.click('dialog[open] [type=submit]');
 await p.waitForSelector('#pairs li');assert.match(await p.locator('#work').textContent(),/我们六月开会/);
 await p.locator('#take').setInputFiles('dist/commute-zh.wav');await p.locator('#recognize').scrollIntoViewIfNeeded();await p.waitForTimeout(500);await p.click('#recognize');await p.waitForFunction(()=>document.querySelector('#confirmed').value==='我们六月开会。');await p.locator('#evaluateVideo').scrollIntoViewIfNeeded();await p.waitForTimeout(500);await p.click('#evaluateVideo');await p.waitForSelector('#results .score');assert.match(await p.locator('#results').innerText(),/Word bank/);
 await p.click('#vocab');await p.waitForFunction(()=>document.querySelector('#vocabText').textContent.includes('拓展'));
 await p.check('#wordOptions [value=learner]');const downloading=p.waitForEvent('download');await p.click('#exportWord');const download=await downloading;
 const zip=await createRequire(import.meta.url)(process.env.JSZIP_MODULE||'jszip').loadAsync(await (await import('node:fs/promises')).readFile(await download.path()));
 const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/完整口译转写/);assert.match(xml,/We meet in June/);assert.match(xml,/我们六月开会/);
 await p.click('nav a[href="#plan"]');await p.click('nav a[href="#video"]');assert.equal(await p.inputValue('#confirmed'),'我们六月开会。');
 await p.evaluate(()=>{const row={date:new Date().toISOString(),title:'Test',rubricVersion:'relay-level-4',score:70,dir:'en',rows:[{coverage:1,accuracy:1,vocabulary:2,reason:'遗漏时间'}]};localStorage.setItem('relay-history',JSON.stringify([{...row,id:'1'},{...row,id:'2'}]))});
 await p.reload();await p.goto(url+'/#history');await p.click('#history article:first-child button');await p.fill('dialog[open] input[type=password]','fake');await p.click('dialog[open] [type=submit]');await p.waitForFunction(()=>document.querySelector('#insightResult')?.textContent.includes('遗漏时间'));console.log('PASS subtitle practice and personalized review');
}finally{await browser.close();server.kill()}
