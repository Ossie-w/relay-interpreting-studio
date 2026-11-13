import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installVoiceAssets} from '../dist/voice-assets.js';
const root='https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/';
test('cold configuration loads and Range probes work with remote config blocked',async()=>{
 const scope={fetch:async url=>{
  assert.ok(String(url).startsWith('file:'),'No remote configuration dependency');
  return new Response(await readFile(url));
 }};
 installVoiceAssets(scope);
 for(const file of ['tokenizer_config.json','tokenizer.json','config.json']){
  const r=await scope.fetch(root+file,{headers:{Range:'bytes=0-0'}});
  assert.equal(r.status,200);assert.ok(await r.json());
 }
});
test('invalid cached configuration retries and never returns undefined',async()=>{
 let calls=0;
 const scope={fetch:async()=>++calls===1?new Response('<html>error</html>'):new Response('{"tokenizer_class":"PreTrainedTokenizer"}')};
 installVoiceAssets(scope);
 assert.equal((await (await scope.fetch(root+'tokenizer_config.json')).json()).tokenizer_class,'PreTrainedTokenizer');
 assert.equal(calls,2);
});
test('persistent configuration failure reports the affected file',async()=>{
 const scope={fetch:async()=>new Response('missing',{status:404})};installVoiceAssets(scope);
 await assert.rejects(scope.fetch(root+'tokenizer_config.json'),/Unable to load voice configuration.*tokenizer_config/);
});
test('model weight requests preserve original options',async()=>{
 let captured;const scope={fetch:async(...args)=>{captured=args;return new Response('weight')}};installVoiceAssets(scope);
 const options={headers:{Range:'bytes=0-0'}};await scope.fetch(root+'onnx/model.onnx',options);
 assert.equal(captured[1],options);
});
