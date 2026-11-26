const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTitleStream } = require('./chat-title');
test('extracts a split Hebrew title without displaying it in the answer', () => {
  let answer = ''; const stream = createTitleStream(true, s => answer += s);
  for (const part of ['[[TI','TLE]]הוצאות שבת','[[/TITLE]]\n','הוצאת 420 ₪.']) stream.push(part);
  assert.equal(stream.finish(),'הוצאות שבת'); assert.equal(answer,'הוצאת 420 ₪.');
});
test('English title remains English and plain responses are not lost', () => {
  let answer = ''; const stream = createTitleStream(true, s => answer += s);
  stream.push('[[TITLE]]Groceries[[/TITLE]]\nYou spent ');stream.push('420.');
  assert.equal(stream.finish(),'Groceries');assert.equal(answer,'You spent 420.');
  let plain = '';const fallback = createTitleStream(true,s=>plain+=s);fallback.push('Nothing');fallback.push(' was found.');assert.equal(fallback.finish(),undefined);assert.equal(plain,'Nothing was found.');
});
test('existing conversation does not request or parse a title', () => {
  let answer = '';const stream = createTitleStream(false,s=>answer+=s);stream.push('Hello');assert.equal(stream.finish(),undefined);assert.equal(answer,'Hello');
});
