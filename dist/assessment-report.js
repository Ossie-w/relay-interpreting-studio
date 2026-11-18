import {escapeHTML as esc,clock} from './practice.js';
export function renderAssessment(r){
 const total=r.score==null?'Content '+r.contentScore+'/80':r.score+'/100';
 const rhythm=r.delivery.points==null?esc(r.delivery.reason):r.delivery.points+'/20 · 按录音内部至少两秒的停顿估算，仅反映节奏。';
 return `<small class="kicker">AI 估算 · DeepSeek Pro</small><h2>${esc(r.title)}</h2><div class="score">${total}</div>
 <p>准确性 ${r.accuracy}/40 · 完整性 ${r.coverage}/25 · 词汇与表达 ${r.vocabulary}/15</p>
 <h3>本次表现</h3><p>${esc(r.strength)}</p><p>${esc(r.weakness)}</p><h3>下一次练习</h3><p>${esc(r.suggestion)}</p>
 <h3>表达连贯性</h3><p>${rhythm}</p>${(r.delivery.gaps||[]).map(g=>`<button data-review-time="${g.start}">▶ ${clock(g.start)} – ${clock(g.end)}</button>`).join(' ')}
 <h3>逐项依据</h3><p>各项按 0–2 分记录。准确性和词汇按已尝试的信息群计算，遗漏计入完整性。</p>${r.rows.map((x,i)=>`<div class="verdict"><b>${i+1}. ${esc(x.source)}</b><p>${x.coverage?'准确性 '+x.accuracy+'/2 · 词汇 '+x.vocabulary+'/2 · ':''}完整性 ${x.coverage}/2</p><blockquote>${esc(x.evidence)||'未传达'}</blockquote><p>${esc(x.reason)}</p></div>`).join('')}
 <h3>Word bank</h3><ul>${r.bank.map(x=>`<li>${esc(x.source)} → ${esc(x.target)}</li>`).join('')}</ul>
 <h3>参考译文</h3><p>${esc(r.reference)}</p><details><summary>原文与转写</summary><p>${esc(r.source)}</p><h4>原始转写</h4><p>${esc(r.original)}</p><h4>确认稿</h4><p>${esc(r.transcript)}</p></details>`;
}
