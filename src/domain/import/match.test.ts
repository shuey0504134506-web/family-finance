import { describe, expect, it } from 'vitest';
import { learnCategories, suggestCategory } from './categorize';
import { importedTransactionId } from './ids';
import { findMatches, nameSimilarity, normalizeName, type ExistingTx } from './match';

const ex = (o: Partial<ExistingTx> & { id: string }): ExistingTx => ({
  type: 'expense', amountAgorot: 12050, date: '2026-10-05', counterparty: 'שופרסל', paymentMethod: 'credit', ...o,
});
const row = (o: object = {}) => ({ id: 'new1', type: 'expense' as const, amountAgorot: 12050, date: '2026-10-05', name: 'שופרסל דיל 123', payment: 'credit' as const, ...o });

describe('שמות', () => {
  it('נרמול', () => expect(normalizeName('שופרסל דיל  סניף 123 בע"מ')).toBe('שופרסל דיל סניף'));
  it('דמיון', () => {
    expect(nameSimilarity('שופרסל דיל 123', 'שופרסל')).toBeGreaterThan(0.8);
    expect(nameSimilarity('שופרסל', 'רמי לוי')).toBeLessThan(0.4);
    expect(nameSimilarity('', 'רמי לוי')).toBe(0.3);
  });
});

describe('findMatches', () => {
  it('אותו סכום, תאריך ושם = כנראה קיימת', () => {
    const [m] = findMatches([row()], [ex({ id: 'a' })]);
    expect(m!.level).toBe('likely');
    expect(m!.existing!.id).toBe('a');
    expect(m!.probability).toBeGreaterThan(0.86);
  });
  it('תאריך סמוך ושם חלקי = ייתכן', () => {
    const [m] = findMatches([row({ date: '2026-10-08' })], [ex({ id: 'a', counterparty: 'שופרסל' })]);
    expect(['likely', 'possible']).toContain(m!.level);
  });
  it('סכום שונה = חדשה', () => {
    expect(findMatches([row()], [ex({ id: 'a', amountAgorot: 9900 })])[0]!.level).toBe('none');
  });
  it('סוג שונה (הכנסה מול הוצאה) = חדשה', () => {
    expect(findMatches([row()], [ex({ id: 'a', type: 'income' })])[0]!.level).toBe('none');
  });
  it('תאריך רחוק = חדשה', () => {
    expect(findMatches([row()], [ex({ id: 'a', date: '2026-09-01' })])[0]!.level).toBe('none');
  });
  it('פעולה קיימת אחת לא נתפסת בידי שתי שורות זהות', () => {
    const r = findMatches([row({ id: '1' }), row({ id: '2' })], [ex({ id: 'a' })]);
    expect(r.filter((m) => m.level !== 'none')).toHaveLength(1);
  });
  it('שני קיימים ושתי שורות: כל אחת מקבלת אחד', () => {
    const r = findMatches([row({ id: '1' }), row({ id: '2' })], [ex({ id: 'a' }), ex({ id: 'b' })]);
    expect(r.map((m) => m.existing?.id).sort()).toEqual(['a', 'b']);
  });
  it('מזהה שנוצר בייבוא קודם = התאמה מדויקת', () => {
    const [m] = findMatches([row({ id: 'imp-1' })], [ex({ id: 'imp-1', amountAgorot: 1 })]);
    expect(m!.level).toBe('exact');
  });
  it('אמצעי תשלום שונה מוריד הסתברות אך לא פוסל', () => {
    const same = findMatches([row()], [ex({ id: 'a' })])[0]!.probability;
    const diff = findMatches([row({ payment: 'cash' })], [ex({ id: 'a' })])[0]!;
    expect(diff.probability).toBeLessThan(same);
  });
});

describe('קטגוריות', () => {
  const cats = [
    { id: 'food', name: 'מזון', type: 'expense' as const },
    { id: 'car', name: 'רכב', type: 'expense' as const },
    { id: 'sal', name: 'משכורת', type: 'income' as const },
  ];
  const learned = learnCategories([
    { type: 'expense', counterparty: 'שופרסל', categoryId: 'food' },
    { type: 'expense', counterparty: 'שופרסל', categoryId: 'food' },
    { type: 'expense', counterparty: 'שופרסל', categoryId: 'car' },
  ]);
  it('לומד מהקטגוריה השכיחה', () => {
    expect(suggestCategory({ type: 'expense', name: 'שופרסל דיל 12', issuerCategory: '' }, learned, cats)).toEqual({ categoryId: 'food', source: 'history' });
  });
  it('בלי היסטוריה: לפי קטגוריית חברת האשראי', () => {
    expect(suggestCategory({ type: 'expense', name: 'פז', issuerCategory: 'רכב ותחבורה' }, learned, cats)).toEqual({ categoryId: 'car', source: 'issuer' });
  });
  it('אין הצעה = null', () => {
    expect(suggestCategory({ type: 'expense', name: 'משהו חדש', issuerCategory: '' }, learned, cats)).toBeNull();
  });
  it('לא מציע קטגוריה מסוג אחר', () => {
    expect(suggestCategory({ type: 'income', name: 'שופרסל', issuerCategory: '' }, learned, cats)).toBeNull();
  });
});

describe('מזהה מיובא', () => {
  it('יציב ושונה בין מרחבים', () => {
    expect(importedTransactionId('household', 'k')).toBe(importedTransactionId('household', 'k'));
    expect(importedTransactionId('household', 'k')).not.toBe(importedTransactionId('business', 'k'));
    expect(importedTransactionId('household', 'k')).toMatch(/^imp-[0-9a-f]{14}$/);
  });
});
