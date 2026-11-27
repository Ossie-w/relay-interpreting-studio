// Tab-memory checkpoints contain validated reports only, never credentials or request closures.
const checkpoints=new Map();
export function retryable(error){
 if(error?.name==='AbortError')return false;
 const message=String(error?.message||'');
 if(/HTTP (400|401|402|403|404)/.test(message))return false;
 return error instanceof SyntaxError || error instanceof TypeError || /HTTP (408|429|5\d\d)|Failed to fetch|network|Incomplete scoring|Invalid scoring|细节核查|Invalid detail audit/i.test(message);
}
export async function recoverScore(key,run,status,wait=ms=>new Promise(r=>setTimeout(r,ms))){
 if(checkpoints.has(key)){status('已恢复本页完成的评分分段');return structuredClone(checkpoints.get(key))}
 for(let attempt=0;attempt<3;attempt++){
  try{
   const report=await run();
   checkpoints.set(key,structuredClone(report));
   while(checkpoints.size>60)checkpoints.delete(checkpoints.keys().next().value);
   return report;
  }catch(error){
   if(attempt===2||!retryable(error))throw error;
   status('本段响应暂不可用，自动重试 '+(attempt+1)+'/2；已完成分段会保留');
   await wait(1000*2**attempt);
  }
 }
}
export function scoreBatches(units){
 const batches=[];let group=[],size=0;
 for(const unit of units){if(group.length&&(group.length>=6||size+unit.length>4500)){batches.push(group);group=[];size=0}group.push(unit);size+=unit.length}
 if(group.length)batches.push(group);return batches;
}
