// Keep verified results and retry only missing IDs. Never treat missing audits as full credit.
export async function completeAudit(pairs, call) {
 const results = new Map();
 async function attempt(group) {
  let data;
  try { data = await call(group); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; return; }
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  for (const pair of group) {
   const matches = checks.filter(c => c?.id === pair.id);
   if (matches.length !== 1) continue;
   const c = matches[0];
   if (typeof c.missing !== 'string' || typeof c.expression !== 'string') continue;
   if (c.missing.trim() && !pair.source.toLowerCase().includes(c.missing.trim().toLowerCase())) continue;
   if (c.expression.trim() && !pair.learner.includes(c.expression.trim())) continue;
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
