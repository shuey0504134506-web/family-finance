import { describe, expect, it } from 'vitest';
import type { AdminUserRow } from '../../services/adminService';
import { accountsCsv, matchesFilter, sortAccounts } from './adminTools';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const row = (o: Partial<AdminUserRow>): AdminUserRow => ({
  uid: 'u', email: 'a@b.c', createdAt: NOW - 90 * DAY, lastSignInAt: NOW - DAY, disabled: false, status: 'approved',
  payment: null, notice: null, opens7d: 0, txTotal: 5, tx7d: 0, usage: 'low', ...o,
});

describe('סינון חשבונות', () => {
  it('לא נכנסו 30 יום', () => {
    expect(matchesFilter(row({ lastSignInAt: NOW - 40 * DAY }), 'dormant', NOW)).toBe(true);
    expect(matchesFilter(row({ lastSignInAt: NOW - 2 * DAY }), 'dormant', NOW)).toBe(false);
  });
  it('נרשמו בלי פעולות, תשלום, חסומים, ממתינים', () => {
    expect(matchesFilter(row({ txTotal: 0 }), 'unused', NOW)).toBe(true);
    expect(matchesFilter(row({}), 'unused', NOW)).toBe(false);
    expect(matchesFilter(row({ payment: { dueAt: 1, amountText: '', url: '', message: '' } }), 'payment', NOW)).toBe(true);
    expect(matchesFilter(row({ disabled: true }), 'blocked', NOW)).toBe(true);
    expect(matchesFilter(row({ status: 'pending' }), 'pending', NOW)).toBe(true);
    expect(matchesFilter(row({ status: 'approved' }), 'pending', NOW)).toBe(false);
  });
});

describe('מיון', () => {
  it('לפי כניסה אחרונה ולפי פעולות', () => {
    const a = row({ uid: 'a', lastSignInAt: 1, txTotal: 9 });
    const b = row({ uid: 'b', lastSignInAt: 2, txTotal: 1 });
    expect(sortAccounts([a, b], 'lastSeen').map((x) => x.uid)).toEqual(['b', 'a']);
    expect(sortAccounts([a, b], 'actions').map((x) => x.uid)).toEqual(['a', 'b']);
  });
});

describe('ייצוא CSV', () => {
  it('BOM, מרכאות כפולות והגנה מנוסחאות', () => {
    const csv = accountsCsv([row({ email: 'x@y.z', note: '=HYPERLINK("evil")', details: { firstName: 'דנה', lastName: 'כהן', phone: '050', businessName: 'א"ב' } })]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"דנה"');
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"א""ב"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
