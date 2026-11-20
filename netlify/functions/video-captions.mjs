const websites=new Set(['https://aussy-interpret-studio.aussy0828.chatgpt.site','https://superlative-parfait-1e35c2.netlify.app']);
export default async function handler(req){
 const origin=req.headers.get('origin'),url=new URL(req.url),id=url.searchParams.get('id'),lang=url.searchParams.get('lang');
 const headers={'Content-Type':'application/json','Vary':'Origin'};
 if(websites.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(data,status)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method!=='GET'||!/^[-\w]{11}$/.test(id||'')||!['en','zh'].includes(lang))return reply({error:'Invalid video'},400);
 try{
  const read=async u=>{const r=await fetch(u,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!r.ok)throw Error();return r};
  const html=await(await read('https://www.youtube.com/watch?v='+id+'&hl='+lang)).text();
  const mark=/"captionTracks"\s*:\s*\[/.exec(html);
  let tracks=[];
  if(mark){
   let level=1,quoted=false,escaped=false;const start=mark.index+mark[0].length-1;
   for(let i=start+1;i<html.length;i++){const c=html[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false}
    else if(c==='"')quoted=true;else if(c==='[')level++;else if(c===']'&&!--level){tracks=JSON.parse(html.slice(start,i+1));break}
   }
  }
  const track=tracks.filter(t=>t.languageCode?.split('-')[0]===lang).sort((a,b)=>Number(a.kind==='asr')-Number(b.kind==='asr'))[0];
  if(!track)throw Error();
  const target=new URL(track.baseUrl);if(target.origin!=='https://www.youtube.com'||target.pathname!=='/api/timedtext')throw Error();
  target.searchParams.set('fmt','json3');
  const data=await(await read(target)).json();
  const text=data.events?.flatMap(e=>e.segs?.map(s=>s.utf8)||[]).join(' ').replace(/\s+/g,' ').trim();
  if(!text)throw Error();
  headers['Cache-Control']='public,max-age=1800';return reply({text},200);
 }catch{return reply({error:'YouTube 未返回所选语言的公开字幕。可粘贴文字记录或导入源音频。'},422)}
}

