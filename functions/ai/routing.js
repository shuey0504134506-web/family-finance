'use strict';
// Models documented as available on these providers' free plans. API keys do
// not reveal the account billing tier; never upgrade accounts or use paid-only models.
const FREE_MODELS = Object.freeze({google:['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-2.5-flash'],groq:['openai/gpt-oss-120b','openai/gpt-oss-20b'],openrouter:['openrouter/free'],cloudflare:['@cf/openai/gpt-oss-120b','@cf/meta/llama-3.3-70b-instruct-fp8-fast'],zai:['glm-4.7-flash','glm-4.5-flash']});
function candidatesFor(cfg, consent, consentVersion = 3) {
  if (consent !== true) return [];
  const out=[];
  const add=(provider,model,apiKey,accountId)=>{
    if (!Object.hasOwn(FREE_MODELS,provider) || !/^[A-Za-z0-9._~+/=-]{20,400}$/.test(apiKey??'')) return;
    if (consentVersion < 4 && !['google','groq'].includes(provider)) return;
    if (provider === 'cloudflare' && !/^[a-f0-9]{32}$/i.test(accountId??'')) return;
    const allowed=FREE_MODELS[provider];
    // Stale/retired model identifiers are replaced with the free-capable default.
    const resolved=allowed.includes(model)?model:allowed[0];
    for (const choice of [resolved,...allowed.filter(m=>m!==resolved)]) {
      if (!out.some(c=>c.provider===provider && c.model===choice)) out.push({provider,model:choice,apiKey,accountId});
    }
  };
  add(cfg.provider??'google',cfg.model,cfg.apiKey);
  if(cfg.freeBackup?.enabled===true && cfg.freeBackup.provider!==cfg.provider) add(cfg.freeBackup.provider,cfg.freeBackup.model,cfg.freeBackup.apiKey);
  for (const provider of Object.keys(FREE_MODELS)) {
    const entry=cfg.extraProviders?.[provider];
    if(entry?.enabled===true && entry.freeConfirmed===true) add(provider,entry.model,entry.apiKey,entry.accountId);
  }
  // Try the strongest available model from each provider before alternatives.
  const providers=[...new Set(out.map(c=>c.provider))];
  const pools=providers.map(provider=>out.filter(c=>c.provider===provider));
  return Array.from({length:Math.max(0,...pools.map(p=>p.length))},(_,i)=>pools.map(p=>p[i]).filter(Boolean)).flat();
}
const retryAfter=new Map();
function availableCandidate(candidate, now=Date.now()) {
  return (retryAfter.get(candidate.provider)??0)<=now && (retryAfter.get(`${candidate.provider}:${candidate.model}`)??0)<=now;
}
function recordProviderFailure(candidate, status, now=Date.now()) {
  const providerWide=[401,402,403,429].includes(status);
  const retryMs=status===429?60000:providerWide?300000:status===404?600000:30000;
  retryAfter.set(providerWide?candidate.provider:`${candidate.provider}:${candidate.model}`,now+retryMs);
}
function compactForGroq(data, question) {
  const words=String(question).match(/[\p{L}\p{N}]{3,}/gu)??[];
  const relevant=(value,limit)=>String(value??'').split('\n').filter(Boolean).sort((a,b)=>Number(words.some(w=>b.includes(w)))-Number(words.some(w=>a.includes(w)))).slice(0,limit).join('\n');
  const array=(value)=>Array.isArray(value)?value:[];
  const summary={selectedMonth:String(data.selectedMonth??'').slice(0,7),monthlyTotals:array(data.monthlyTotals).slice(-24),yearlyTotals:array(data.yearlyTotals).slice(0,10),monthlySavingsGoal:Number.isFinite(data.monthlySavingsGoal)?data.monthlySavingsGoal:null,matchedKeywords:array(data.matchedKeywords),matchedExpenseTotals:array(data.matchedExpenseTotals),budgets:array(data.budgets).slice(0,15),debts:array(data.debts).slice(0,10),coverage:'Compact fallback: matchedExpenseTotals are calculated from all recorded expense transactions using the stated keywords, not necessarily a complete semantic match. Other row lists may be partial. Never label a subtotal as complete.'};
  const fields=['matchedCategoryTotals','monthlyCategoryTotals','monthlyPaymentTotals','selectedMonthTransactions','previousMonthTransactions','relatedOlderTransactions'];
  for(const field of fields) {
    const rows=relevant(data[field],field.includes('CategoryTotals')?150:field==='monthlyPaymentTotals'?60:15).split('\n').filter(Boolean);
    const kept=[];
    for(const row of rows) {
      kept.push(row);
      summary[field]=kept.join('\n');
      if(JSON.stringify(summary).length>10000) { kept.pop(); summary[field]=kept.join('\n'); break; }
    }
  }
  for(const field of ['debts','budgets','monthlyTotals','yearlyTotals','matchedExpenseTotals','matchedKeywords']) {
    while(JSON.stringify(summary).length>10000 && Array.isArray(summary[field]) && summary[field].length) summary[field]=summary[field].slice(0,Math.floor(summary[field].length/2));
  }
  return JSON.stringify(summary);
}
module.exports={FREE_MODELS,candidatesFor,compactForGroq,availableCandidate,recordProviderFailure};
