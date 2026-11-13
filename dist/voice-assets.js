// Small upstream Kokoro configs ship with the site. Metadata probes must not
// depend on Hugging Face Range requests (which some networks reject).
const ROOT="https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/";
const FILES=new Set(["config.json","tokenizer.json","tokenizer_config.json"]);
export function installVoiceAssets(scope=globalThis){
 const fetch=scope.fetch.bind(scope);
 scope.fetch=async(input,options)=>{
  const request=new Request(input,options);
  const file=request.url.startsWith(ROOT)?request.url.slice(ROOT.length):"";
  if(!FILES.has(file)||!["GET","HEAD"].includes(request.method))return fetch(input,options);
  const url=new URL("./voice-config/"+file,import.meta.url);
  let failure;
  for(let attempt=0;attempt<2;attempt++){
   try{
    const response=await fetch(url,{signal:request.signal,cache:attempt?"reload":"default"});
    if(!response.ok)throw Error("HTTP "+response.status);
    const body=await response.text(),data=JSON.parse(body);
    if(!data||typeof data!=="object"||
      (file==="tokenizer_config.json"&&!data.tokenizer_class)||
      (file==="tokenizer.json"&&!data.model))throw Error("Invalid configuration");
    return new Response(request.method==="HEAD"?null:body,{headers:{"Content-Type":"application/json","Content-Length":String(new TextEncoder().encode(body).length)}});
   }catch(error){if(request.signal.aborted)throw error;failure=error}
  }
  throw Error("Unable to load voice configuration ("+file+"). Refresh this page and retry. "+failure.message);
 };
}
