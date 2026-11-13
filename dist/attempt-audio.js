function database(){return new Promise((resolve,reject)=>{
 const r=indexedDB.open('relay-attempt-audio',1);
 r.onupgradeneeded=()=>r.result.createObjectStore('recordings');
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 r.onblocked=()=>reject(Error('Recording storage is blocked by another tab.'));
})}
export async function storeAttemptAudio(id,blob){
 const db=await database();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').put(blob,id);
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 })}finally{db.close()}
}
export async function loadAttemptAudio(id){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const r=db.transaction('recordings').objectStore('recordings').get(id);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 })}finally{db.close()}
}
