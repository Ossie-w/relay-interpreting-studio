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
  const input=JSON.parse(r.request().postDataJSON().messages[1].content);
  const value=Array.isArray(input)?{feedback:'两次练习均遗漏时间。'}:{pairs:[{source:'We meet in June.',translation:'我们六月开会。'}]};
  return r.fulfill({json:{choices:[{message:{content:JSON.stringify(value)}}]}});
 });
 await p.goto(url);await p.click('.videoSetup summary');await p.fill('#videoURL','https://youtu.be/abcdefghijk');await p.fill('#captions','0:01\nWe meet in June.');await p.click('#startVideo');await p.fill('dialog[open] input[type=password]','fake');await p.click('dialog[open] [type=submit]');
 await p.waitForSelector('#session iframe');assert.match(await p.locator('#session').textContent(),/我们六月开会/);
 await p.evaluate(()=>{const row={date:new Date().toISOString(),title:'Test',rubricVersion:'relay-level-4',score:70,dir:'en',rows:[{coverage:1,accuracy:1,vocabulary:2,reason:'遗漏时间'}]};localStorage.setItem('relay-history',JSON.stringify([{...row,id:'1'},{...row,id:'2'}]))});
 await p.reload();await p.goto(url+'/#history');await p.click('#history article:first-child button');await p.fill('dialog[open] input[type=password]','fake');await p.click('dialog[open] [type=submit]');await p.waitForFunction(()=>document.querySelector('#insightResult')?.textContent.includes('遗漏时间'));console.log('PASS subtitle practice and personalized review');
}finally{await browser.close();server.kill()}
