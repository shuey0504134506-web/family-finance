const {test}=require('node:test');const assert=require('node:assert/strict');const {candidatesFor,compactForGroq}=require('./routing');
const key='fake-test-key-123456789012';
const cfg={provider:'google',model:'gemini-3.8-flash',apiKey:key,freeBackup:{enabled:true,provider:'groq',model:'openai/gpt-oss-120b',apiKey:key}};
test('requires explicit remote consent',()=>assert.deepEqual(candidatesFor(cfg,false),[]));
test('routes primary then backup',()=>assert.deepEqual(candidatesFor(cfg,true).map(c=>c.provider),['google','groq']));
test('invalid primary key does not prevent backup',()=>assert.deepEqual(candidatesFor({...cfg,apiKey:''},true).map(c=>c.provider),['groq']));
test('paid-only provider disabled and misconfigured model replaced',()=>{assert.equal(candidatesFor({...cfg,provider:'openai'},true)[0].provider,'groq');assert.equal(candidatesFor({...cfg,model:'gemini-4-argon'},true)[0].model,'gemini-3.8-flash');});
test('backup data stays bounded and marks incomplete coverage',()=>{const result=compactForGroq({selectedMonth:'2026-01',selectedMonthTransactions:'a'.repeat(30000)},'שבת');assert.ok(result.length<=10000);assert.match(result,/partial/);});
