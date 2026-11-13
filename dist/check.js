const button=document.getElementById('check'),output=document.getElementById('results');
button.onclick=async()=>{
 button.disabled=true;const lines=[];
 const report=s=>{lines.push(s);output.textContent=lines.join('\n\n')};
 try{
  report('安全连接：'+(isSecureContext?'可用':'不可用；麦克风需要 HTTPS 或 localhost'));
  try{const adapter=await navigator.gpu?.requestAdapter();report('AI 生成设备：'+(adapter?.features.has('shader-f16')?'WebGPU 与 shader-f16 可用':'未检测到所需 GPU 功能；仍可使用内置练习'))}catch{report('AI 生成设备：GPU 检查失败')}
  report('录音接口：'+(navigator.mediaDevices?.getUserMedia?'可用；实际收声请用五秒麦克风测试':'此浏览器未提供麦克风接口'));
  try{localStorage.setItem('relay-check','1');localStorage.removeItem('relay-check');report('本地记录：可以保存')}catch{report('本地记录：无法保存，请检查浏览器隐私设置')}
  const checks=[['网站示例音频','./commute-en.wav'],['生成模型配置','https://huggingface.co/mlc-ai/Qwen2.5-3B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json'],['增强转写模型配置','https://huggingface.co/onnx-community/whisper-small/resolve/main/config.json'],['轻量转写模型配置','https://huggingface.co/Xenova/whisper-tiny/resolve/main/config.json'],['自然语音模型配置','https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/config.json']];
  await Promise.all(checks.map(async([label,url])=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{const r=await fetch(url,{signal:controller.signal,cache:'no-store'});await r.body?.cancel();report(label+'：'+(r.ok?'连接成功':'HTTP '+r.status))}
   catch(e){report(label+'：'+(e.name==='AbortError'?'12 秒内未连接成功':'请求失败（可能是网络或浏览器跨域限制）'))}finally{clearTimeout(timer)}
  }));
  report('检查结束。请保留以上结果。此检查尚未执行真实 AI 生成、语音合成或转写。');
 }finally{button.disabled=false}
};
