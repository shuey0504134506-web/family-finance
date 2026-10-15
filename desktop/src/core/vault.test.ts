import { describe, expect, it } from 'vitest';
import { WrongKeyError } from './crypto';
import { derivedCandidates, normalizeAnswer, pickDerived, type TxLike } from './recovery';
import { changeVaultPassword, createVault, recoverVaultKey, sealVault, setVaultRecovery, unlockVault } from './vault';

const IT = 1000;
const Q = [
  { kind: 'custom' as const, text: 'מה האוכל האהוב עליך?' },
  { kind: 'custom' as const, text: 'איך קראו לכלב הראשון שלך?' },
  { kind: 'custom' as const, text: 'באיזו עיר נולדת?' },
];

describe('כספת', () => {
  it('פותחת עם הסיסמה הנכונה בלבד', async () => {
    const { file } = await createVault('סיסמה-123', '{"a":1}', IT);
    expect((await unlockVault(file, 'סיסמה-123')).plaintext).toBe('{"a":1}');
    await expect(unlockVault(file, 'סיסמה-124')).rejects.toBeInstanceOf(WrongKeyError);
  });

  it('התוכן המוצפן אינו מכיל את הטקסט המקורי', async () => {
    const { file } = await createVault('pw', 'שופרסל 412 שקל', IT);
    expect(JSON.stringify(file)).not.toContain('שופרסל');
  });

  it('שמירה מחדש מחליפה את התוכן ושומרת על הסיסמה', async () => {
    const { file, dataKey } = await createVault('pw', 'v1', IT);
    const next = await sealVault(file, dataKey, 'v2');
    expect(next.data.iv).not.toBe(file.data.iv);
    expect((await unlockVault(next, 'pw')).plaintext).toBe('v2');
  });

  it('החלפת סיסמה: הישנה נפסלת והחדשה עובדת, בלי להצפין מחדש את הנתונים', async () => {
    const { file, dataKey } = await createVault('old', 'data', IT);
    const next = await changeVaultPassword(file, dataKey, 'new');
    expect(next.data).toEqual(file.data);
    await expect(unlockVault(next, 'old')).rejects.toBeInstanceOf(WrongKeyError);
    expect((await unlockVault(next, 'new')).plaintext).toBe('data');
  });

  it('שחזור: שלוש התשובות הנכונות פותחות, גם עם הבדלי כתיבה', async () => {
    const created = await createVault('pw', 'secret', IT);
    const file = await setVaultRecovery(created.file, created.dataKey, Q, ['פיצה', 'רקס', 'חיפה'], IT);
    expect((await recoverVaultKey(file, ['  פיצה! ', 'רקס', 'חיפה.'])).plaintext).toBe('secret');
    await expect(recoverVaultKey(file, ['פיצה', 'רקס', 'תל אביב'])).rejects.toBeInstanceOf(WrongKeyError);
    await expect(recoverVaultKey(file, ['פיצה', 'רקס'])).rejects.toBeInstanceOf(WrongKeyError);
  });

  it('אחרי שחזור אפשר לקבוע סיסמה חדשה', async () => {
    const created = await createVault('forgotten', 'secret', IT);
    const file = await setVaultRecovery(created.file, created.dataKey, Q, ['a1', 'b2', 'c3'], IT);
    const { dataKey } = await recoverVaultKey(file, ['a1', 'b2', 'c3']);
    const reset = await changeVaultPassword(file, dataKey, 'brand-new');
    expect((await unlockVault(reset, 'brand-new')).plaintext).toBe('secret');
  });

  it('התשובות עצמן אינן נשמרות בקובץ', async () => {
    const created = await createVault('pw', 'x', IT);
    const file = await setVaultRecovery(created.file, created.dataKey, Q, ['פיצה', 'רקס', 'חיפה'], IT);
    const text = JSON.stringify(file);
    for (const a of ['פיצה', 'רקס', 'חיפה']) expect(text).not.toContain(a);
  });
});

describe('נרמול תשובות', () => {
  it.each([
    [' פיצה! ', 'פיצה'],
    ['Pizza', 'pizza'],
    ['1,250 ₪', '1250'],
    ['1250.4 שקלים', '1250'],
    ['תל-אביב', 'תל אביב'],
    ['שוֹפרסל', 'שופרסל'],
  ])('%s -> %s', (input, expected) => expect(normalizeAnswer(input)).toBe(expected));
});

describe('שאלות נגזרות מהפעולות', () => {
  const tx = (date: string, type: 'income' | 'expense', agorot: number, name: string, cat: string): TxLike => ({ type, amountAgorot: agorot, date, counterparty: name, categoryName: cat });
  const sep = [
    tx('2026-09-01', 'income', 1200000, 'משכורת', 'משכורת'),
    tx('2026-09-03', 'expense', 50000, 'שופרסל', 'מזון'),
    tx('2026-09-05', 'expense', 450000, 'משכיר', 'דיור'),
    tx('2026-09-09', 'expense', 30000, 'פז', 'רכב'),
    tx('2026-09-15', 'expense', 20000, 'קפה', 'מזון'),
  ];
  it('בונה שאלות רק מחודשים שהסתיימו, עם תשובה חד-משמעית', () => {
    const list = derivedCandidates({ household: [...sep, tx('2026-10-02', 'expense', 99999999, 'חדש', 'אחר')], business: [] }, '2026-10');
    const byTemplate = Object.fromEntries(list.map((c) => [c.question.template, c.answer]));
    expect(byTemplate).toMatchObject({ 'top-expense-category': 'דיור', 'top-expense-name': 'משכיר', 'top-income-amount': '12000', 'expense-count': '4' });
    expect(list[0]!.question.text).toContain('ספטמבר 2026');
    expect(list.every((c) => c.month === '2026-09')).toBe(true);
  });
  it('בלי תיקו: אם שתי הוצאות זהות בגודלן אין שאלת "הגדולה ביותר"', () => {
    const list = derivedCandidates({ household: [tx('2026-09-01', 'expense', 100, 'א', 'x'), tx('2026-09-02', 'expense', 100, 'ב', 'y'), tx('2026-09-03', 'expense', 50, 'ג', 'z'), tx('2026-09-04', 'income', 5, 'ד', 'w')], business: [] }, '2026-10');
    expect(list.some((c) => c.question.template === 'top-expense-name')).toBe(false);
    expect(list.some((c) => c.question.template === 'top-expense-category')).toBe(false);
  });
  it('חודש עם פחות מ-4 פעולות לא מייצר שאלות', () => {
    expect(derivedCandidates({ household: sep.slice(0, 3), business: [] }, '2026-10')).toEqual([]);
  });
  it('בוחר שאלות שונות בסוגן', () => {
    const list = derivedCandidates({ household: sep, business: [] }, '2026-10');
    const picked = pickDerived(list, 2);
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.question.template)).size).toBe(2);
  });
});

import { recomputeDerived } from './recovery';
describe('רענון שאלות נגזרות', () => {
  const t = (date: string, type: 'income' | 'expense', agorot: number, name: string, cat: string): TxLike => ({ type, amountAgorot: agorot, date, counterparty: name, categoryName: cat });
  const sep = [t('2026-09-01', 'income', 1200000, 'משכורת', 'משכורת'), t('2026-09-03', 'expense', 50000, 'שופרסל', 'מזון'), t('2026-09-05', 'expense', 450000, 'משכיר', 'דיור'), t('2026-09-09', 'expense', 30000, 'פז', 'רכב')];
  it('מחשב מחדש אחרי עריכה, ומחזיר null כשכבר אין תשובה חד-משמעית', () => {
    const q = derivedCandidates({ household: sep, business: [] }, '2026-10').find((c) => c.question.template === 'top-expense-name')!.question;
    expect(q.month).toBe('2026-09');
    expect(recomputeDerived(q, { household: sep, business: [] }, '2026-10')).toBe('משכיר');
    const edited = sep.map((x) => (x.counterparty === 'שופרסל' ? { ...x, amountAgorot: 900000 } : x));
    expect(recomputeDerived(q, { household: edited, business: [] }, '2026-10')).toBe('שופרסל');
    const tie = sep.map((x) => (x.counterparty === 'שופרסל' ? { ...x, amountAgorot: 450000 } : x));
    expect(recomputeDerived(q, { household: tie, business: [] }, '2026-10')).toBeNull();
  });
});
