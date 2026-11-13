import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
process.on('exit',()=>server.kill());
const [ready]=await once(server.stdout,'data'),origin=ready.toString().trim().split(' ').pop();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH,headless:true});
try{
 const page=await browser.newPage(),external=[];
 await page.route('**/*',r=>{if(!r.request().url().startsWith(origin)){external.push(r.request().url());return r.abort()}return r.continue()});
 await page.goto(origin);await page.waitForSelector('#topics button');
 assert.equal(await page.locator('#generate').isEnabled(),true);assert.deepEqual(external,[]);
 await page.locator('#demo').click();
 assert.equal(await page.locator('#session').isVisible(),false);
 assert.equal(await page.locator('#generate').isEnabled(),true);
 assert.deepEqual(external,[]);
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.dir),'en');
 await page.goto(origin+'/check.html');await page.locator('#check').click();
 await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('检查结束'));
 assert.match(await page.locator('#results').textContent(),/网站示例音频：连接成功/);
 assert.match(await page.locator('#results').textContent(),/生成模型配置：请求失败/);
 await page.getByRole('link',{name:'打开内置练习',exact:true}).click();await page.locator('#offlineExercise').click();
 await page.waitForFunction(()=>document.querySelector('#sampleAudio')?.duration>0);
 console.log('First visit stays interactive without downloading models; diagnostics distinguish external failures; included practice works with external hosts blocked.');
}finally{await browser.close();server.kill()}
