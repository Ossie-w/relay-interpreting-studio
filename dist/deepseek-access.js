const endpoints=Object.freeze({manuscript:'https://api.deepseek.com/chat/completions',voice:'https://api.deepseek.com/v1/tools/tts'});

let tabKey="";
if(typeof window!=="undefined")window.addEventListener("pagehide",()=>{tabKey=""});
function askKey(label,signal,disclosure){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');
  dialog.innerHTML='<form method="dialog" autocomplete="off"><h2>DeepSeek API Key</h2><p>This operation uses your DeepSeek balance. Your browser sends the key only to DeepSeek. The key stays in tab memory until reload or exit. Manuscript generation, speech synthesis and scoring use your DeepSeek balance.</p><label>API key <input type="password" autocomplete="off" spellcheck="false" required></label><p><button type="submit" class="action">Continue</button> <button type="button">Cancel</button></p></form>';
  if(disclosure)dialog.querySelector('p').textContent=disclosure;
  const input=dialog.querySelector('input');
  const finish=accepted=>{
   let value=accepted?input.value.trim():'';
   input.value='';dialog.close();dialog.remove();signal.removeEventListener('abort',abort);
   if(value)resolve(value);else reject(new DOMException('Operation cancelled.','AbortError'));
   value='';
  };
  const abort=()=>finish(false);
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();finish(true)};
  dialog.querySelector('[type=button]').onclick=abort;
  dialog.oncancel=e=>{e.preventDefault();abort()};
  dialog.querySelector('[type=submit]').textContent=label;
  signal.addEventListener('abort',abort,{once:true});document.body.append(dialog);dialog.showModal();input.focus();
 });
}
export async function withDeepSeek(label,run,controller=new AbortController(),disclosure){
 let key='';
 const cleanup=()=>{key='';controller.abort()};
 window.addEventListener('pagehide',cleanup,{once:true});
 try{
  key=tabKey || await askKey(label,controller.signal,disclosure);
  tabKey=key;
  async function request(operation,body){
   if(!key||!Object.hasOwn(endpoints,operation))throw Error('Operation closed');
   const result=await fetch(endpoints[operation],{method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(result.status===401 && tabKey===key)tabKey="";
   if(!result.ok)throw Error('DeepSeek HTTP '+result.status+(result.status===401?' · Check your API key.':result.status===402?' · Check your DeepSeek balance.':''));
   return result;
  }
  return await run(request);
 }finally{cleanup();window.removeEventListener('pagehide',cleanup)}
}
