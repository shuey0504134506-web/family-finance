'use strict';
// Models documented as available on these providers' free plans. API keys do
// not reveal the account billing tier; never upgrade accounts or use paid-only models.
const FREE_MODELS = Object.freeze({google:['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-3.6-flash','gemini-2.5-flash'],groq:['openai/gpt-oss-120b','openai/gpt-oss-20b']});
function candidatesFor(cfg, consent) {
  if (consent !== true) return [];
  const out=[];
  const add=(provider,model,apiKey)=>{
    if (!Object.hasOwn(FREE_MODELS,provider) || !/^[A-Za-z0-9._~+/=-]{20,400}$/.test(apiKey??'')) return;
    const allowed=FREE_MODELS[provider];
    // Stale/retired model identifiers are replaced with the free-capable default.
    const resolved=allowed.includes(model)?model:allowed[0];
    if (!out.some(c=>c.provider===provider)) out.push({provider,model:resolved,apiKey});
  };
  add(cfg.provider??'google',cfg.model,cfg.apiKey);
  if(cfg.freeBackup?.enabled===true && cfg.freeBackup.provider!==cfg.provider) add(cfg.freeBackup.provider,cfg.freeBackup.model,cfg.freeBackup.apiKey);
  return out;
}
function compactForGroq(data, question) {
  const words=String(question).match(/[\p{L}\p{N}]{3,}/gu)??[];
  const relevant=(value,limit)=>String(value??'').split('\n').filter(Boolean).sort((a,b)=>Number(words.some(w=>b.includes(w)))-Number(words.some(w=>a.includes(w)))).slice(0,limit).join('\n');
  const summary={selectedMonth:data.selectedMonth,monthlyTotals:data.monthlyTotals?.slice(-12),yearlyTotals:data.yearlyTotals?.slice(0,5),monthlySavingsGoal:data.monthlySavingsGoal,budgets:data.budgets?.slice(0,15),debts:data.debts?.slice(0,10),selectedMonthTransactions:relevant(data.selectedMonthTransactions,24),previousMonthTransactions:relevant(data.previousMonthTransactions,12),relatedOlderTransactions:relevant(data.relatedOlderTransactions,12),monthlyCategoryTotals:relevant(data.monthlyCategoryTotals,24),coverage:'Compact fallback: transaction rows and category history are partial. Never label a subtotal as complete.'};
  let result=JSON.stringify(summary);
  if(result.length>10000){delete summary.previousMonthTransactions;delete summary.relatedOlderTransactions;result=JSON.stringify(summary);}
  if(result.length>10000){delete summary.selectedMonthTransactions;delete summary.monthlyCategoryTotals;result=JSON.stringify(summary);}
  if(result.length>10000)result=JSON.stringify({selectedMonth:data.selectedMonth,monthlyTotals:data.monthlyTotals?.slice(-12),coverage:summary.coverage});
  return result;
}
module.exports={candidatesFor,compactForGroq};
