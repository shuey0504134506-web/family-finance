const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRequest } = require('./providers');
const base = { model: 'test-model', apiKey: 'fake-test-key', system: 'system', messages: [{ role: 'user', content: 'question' }] };
for (const [provider, host] of Object.entries({google:'generativelanguage.googleapis.com',xai:'api.x.ai',openai:'api.openai.com',anthropic:'api.anthropic.com',deepseek:'api.deepseek.com',openrouter:'openrouter.ai'})) {
  test(provider + ' routes to fixed provider endpoint', () => {
    const req = buildRequest({...base,provider});
    assert.equal(new URL(req.url).hostname,host);
    assert.ok(JSON.stringify(req.headers).includes(base.apiKey));
    assert.ok(!req.url.includes(base.apiKey));
    assert.ok(JSON.stringify(req.body).includes('question'));
  });
}
test('unknown provider is rejected',()=>assert.throws(()=>buildRequest({...base,provider:'custom'})));
test('invalid message is rejected',()=>assert.throws(()=>buildRequest({...base,messages:[{role:'system',content:'bad'}]})));
