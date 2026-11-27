// Keep verified results and retry only missing IDs. Never treat missing audits as full credit.
export function exactQuote(source, quote) {
 if (!quote.trim()) return '';
 const normalize = c => c.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
 let normalized='', positions=[];
 for(let i=0;i<source.length;i++) for(const c of normalize(source[i])) {
  if(/\s/.test(c)) continue;
  normalized+=c; positions.push(i);
 }
 const needle=Array.from(quote.trim()).map(normalize).join('').replace(/\s/g,'');
 const index=normalized.indexOf(needle);
 return index<0?null:source.slice(positions[index],positions[index+needle.length-1]+1);
}
export async function completeAudit(pairs, call) {
 const results = new Map();
 const errors = new Map();
 async function attempt(group) {
  let data;
  try { data = await call(group,group.map(p=>({id:p.id,correction:errors.get(p.id)||'Return exactly one check for this ID.'}))); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; return; }
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  for (const pair of group) {
   const matches = group.length===1 && checks.length===1 ? checks : checks.filter(c => Number(c?.id) === pair.id);
   if (matches.length !== 1) continue;
   const c = {...matches[0],id:pair.id};
   if (typeof c.missing !== 'string' || typeof c.expression !== 'string') continue;
   const missing=exactQuote(pair.source,c.missing),expression=exactQuote(pair.learner,c.expression);
   if(missing===null||expression===null){
    errors.set(pair.id,'Previous quotes did not occur in the supplied text: '+JSON.stringify({missing:c.missing,expression:c.expression})+'. Copy ONE contiguous exact substring for each finding. Put explanations in note; use an empty string only when no issue exists.');
    continue;
   }
   c.missing=missing;c.expression=expression;
   results.set(pair.id, c);
  }
 }
 await attempt(pairs);
 for (const pair of pairs) {
  for (let retry = 0; retry < 2 && !results.has(pair.id); retry++) await attempt([pair]);
 }
 const missing = pairs.filter(p => !results.has(p.id));
 if (missing.length) throw Error('AI 未完成第 ' + missing.map(p => p.id).join('、') + ' 项细节核查，自动补查后仍未返回有效依据。练习与录音已保存，请稍后重试评分。');
 return pairs.map(p => results.get(p.id));
}
