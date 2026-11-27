const {test}=require('node:test');const assert=require('node:assert/strict');const {candidatesFor,compactForGroq}=require('./routing');
const key='fake-test-key-123456789012';
const cfg={provider:'google',model:'gemini-3.8-flash',apiKey:key,freeBackup:{enabled:true,provider:'groq',model:'openai/gpt-oss-120b',apiKey:key}};
test('requires explicit remote consent',()=>assert.deepEqual(candidatesFor(cfg,false),[]));
test('routes preferred primary then preferred backup then alternatives',()=>assert.deepEqual(candidatesFor(cfg,true).slice(0,4).map(c=>c.provider),['google','groq','google','groq']));
test('invalid primary key does not prevent backup',()=>assert.deepEqual([...new Set(candidatesFor({...cfg,apiKey:''},true).map(c=>c.provider))],['groq']));
test('paid-only provider disabled and misconfigured model replaced',()=>{assert.equal(candidatesFor({...cfg,provider:'openai'},true)[0].provider,'groq');assert.equal(candidatesFor({...cfg,model:'gemini-4-argon'},true)[0].model,'gemini-3.8-flash');});
test('backup data stays bounded and marks incomplete coverage',()=>{const result=compactForGroq({selectedMonth:'2026-01',selectedMonthTransactions:'a'.repeat(30000)},'שבת');assert.ok(result.length<=10000);assert.match(result,/partial/);});
test('additional free providers require updated consent and confirmed plan',()=>{
  const c={...cfg,extraProviders:{openrouter:{enabled:true,freeConfirmed:true,apiKey:key,model:'auto'},cloudflare:{enabled:true,freeConfirmed:false,apiKey:key,accountId:'a'.repeat(32)}}};
  assert.ok(!candidatesFor(c,true,3).some(x=>x.provider==='openrouter'));
  assert.equal(candidatesFor(c,true,4).find(x=>x.provider==='openrouter').model,'openrouter/free');
  assert.ok(!candidatesFor(c,true,4).some(x=>x.provider==='cloudflare'));
});
test('temporary model failures retry after cooldown without blocking another model',()=>{
  const {availableCandidate,recordProviderFailure}=require('./routing');
  const c={provider:'test-provider',model:'preferred'};
  recordProviderFailure(c,503,1000);
  assert.equal(availableCandidate(c,2000),false);
  assert.equal(availableCandidate({...c, model:'backup'},2000),true);
  assert.equal(availableCandidate(c,31000),true);
});
test('compact payload prioritizes older relevant category totals and exact matched totals',()=>{
  const other=Array.from({length:80},(_,i)=>`2026-11|E|category ${i}|10`);
  const data={selectedMonth:'2026-11',monthlyCategoryTotals:[...other,'2026-09|E|תחבורה|667.03'].join('\n'),matchedCategoryTotals:'2026-09|E|תחבורה|667.03',matchedExpenseTotals:[{month:'2026-09',amount:667.03,count:4}]};
  const result=JSON.parse(compactForGroq(data,'תחבורה'));
  assert.match(result.monthlyCategoryTotals,/2026-09\|E\|תחבורה\|667\.03/);
  assert.deepEqual(result.matchedExpenseTotals,data.matchedExpenseTotals);
});
