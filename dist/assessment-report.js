import {escapeHTML as esc,clock} from './practice.js';
export const grade=(value,record)=>value>=(record?.rubricVersion==="relay-level-4"?({Beginner:96,Intermediate:94,Advanced:92}[record.difficulty]||94):90)?'A · 熟练':value>=75?'B · 稳定':value>=60?'C · 发展中':'D · 需要加强';
export function renderAssessment(r){
 const total=['relay-sentence-2','relay-sentence-3','relay-level-4'].includes(r.rubricVersion)?(r.score==null?'内容等级 '+grade(r.contentScore*1.25,r):'综合等级 '+grade(r.score,r)):r.score==null?'Content '+r.contentScore+'/80':r.score+'/100';
 const rhythm=r.delivery.points==null?esc(r.delivery.reason):r.delivery.points+'/20 · 按录音内部至少两秒的停顿估算，仅反映节奏。';
 return `<small class="kicker">AI 估算 · DeepSeek Pro</small><h2>${esc(r.title)}</h2><div class="score">${total}</div>
 <p>准确性 ${r.accuracy}/40 · 完整性 ${r.coverage}/25 · 词汇与表达 ${r.vocabulary}/15</p>
 ${r.rubricVersion==="relay-level-4"?"<p>A 级门槛按初级、进阶、高级分别为 96、94、92；B 级从 75 起，C 级从 60 起。</p>":""}<h3>本次表现</h3><p>${esc(r.strength)}</p><p>${esc(r.weakness)}</p><h3>下一次练习</h3><p>${esc(r.suggestion)}</p>
 <h3>表达连贯性</h3><p>${rhythm}</p>
 <h3>逐项依据</h3><p>${['relay-sentence-2','relay-sentence-3','relay-level-4'].includes(r.rubricVersion)?'逐句对照原文和确认稿。遗漏的句子没有内容得分。':'各项按 0–2 分记录。准确性和词汇按已尝试的信息群计算。'}</p>${r.rows.map((x,i)=>`<div class="verdict"><b>${i+1}. ${esc(x.source)}</b><p>${x.coverage?'准确性 '+x.accuracy+'/2 · 词汇 '+x.vocabulary+'/2 · ':''}完整性 ${x.coverage}/2</p><blockquote>${esc(x.evidence)||(x.coverage?'请核对确认稿，未能定位简短引文。':'未传达')}</blockquote><p>${esc(x.reason)}</p></div>`).join('')}
 <h3>Word bank</h3><ul>${r.bank.map(x=>`<li>${esc(x.source)} → ${esc(x.target)}</li>`).join('')}</ul>
 <h3>参考译文</h3><p>${esc(r.reference)}</p><details><summary>原文与转写</summary><p>${esc(r.source)}</p><h4>原始转写</h4><p>${esc(r.original)}</p><h4>确认稿</h4><p>${esc(r.transcript)}</p></details>`;
}
