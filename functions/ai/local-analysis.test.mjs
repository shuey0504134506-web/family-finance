import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, remoteGenerationAllowed } from './local-analysis.mjs';
const summary = { selectedMonth: '2026-01', monthlySavingsGoal: 100, monthlyTotals: [{month:'2025-12',income:200,expenses:50},{month:'2026-01',income:120.33,expenses:20.11}] };
test('precise integer-cent balance and previous month', () => {
  const answer = analyze(summary, 'סיכום החודש');
  assert.match(answer, /100\.22/);
  assert.match(answer, /29\.89/);
  assert.match(answer, /היעד הושג/);
});
test('zero spend fails closed even with keys', () => assert.equal(remoteGenerationAllowed({apiKey:'test',billing:false}), false));
test('missing month never invents totals', () => assert.match(analyze(summary, 'סיכום חודש 2026-02'), /אין נתונים/));
test('payment method ranking and follow-up', () => {
  const s = {...summary,selectedMonthTransactions:'2026-01-01|E|10|food|shop|אשראי|\n2026-01-02|E|20|food|shop|אשראי|\n2026-01-03|E|90|food|shop|מזומן|'};
  const q = 'איזו צורת תשלום אני משתמש בה הכי הרבה?';
  assert.match(analyze(s,q), /הוא אשראי/);
  assert.match(analyze(s,'למה',[{role:'user',text:q}]), /2 פעולות/);
});
