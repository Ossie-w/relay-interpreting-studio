import {narrate} from './prosody.js';
import {withDeepSeek} from './deepseek-access.js';
let controller;
export function cancelNarration(){controller?.abort()}
export async function authorizeNarration(run){
 controller=new AbortController();
 try{return await withDeepSeek('Prepare natural voice',run,controller)}finally{controller=null}
}
export async function renderNarration(text,lang,status,voice,target,request){
 status('Synthesizing with DeepSeek…');
 return {blob:await narrate(text,voice||'stella',target,request),saved:false};
}
