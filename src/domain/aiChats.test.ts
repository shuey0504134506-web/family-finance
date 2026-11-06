import { describe, expect, it } from 'vitest';
import { chatToEvict, MAX_RECENT_QUESTIONS, withRecentQuestion, type AiChat } from './aiChats';
import { AI_QUESTION_BANK, pickQuestions } from './aiQuestions';
import { buildAiSummary } from './aiSummary';

const chat = (id: string, updatedAt: number, pinned = false): AiChat => ({ id, title: id, pinned, messages: [], createdAt: 1, updatedAt });

describe('chatToEvict', () => {
  it('לא מוחק כשיש מקום או כשהשיחה כבר שמורה', () => {
    expect(chatToEvict([chat('a', 1)], 'new')).toBeNull();
    const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) => chat(id, i));
    expect(chatToEvict(five, 'c')).toBeNull();
  });
  it('כשהרשימה מלאה מוחק את הלא נעוצה הישנה ביותר', () => {
    const five = [chat('a', 5, true), chat('b', 1), chat('c', 2), chat('d', 3, true), chat('e', 4)];
    expect(chatToEvict(five, 'new')).toBe('b');
  });
  it('כשכולן נעוצות מחזיר full', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) => chat(id, i, true));
    expect(chatToEvict(five, 'new')).toBe('full');
  });
});

describe('withRecentQuestion', () => {
  it('מוסיף לראש, בלי כפילויות, עד 20', () => {
    const base = Array.from({ length: 25 }, (_, i) => ({ q: `q${i}`, at: i }));
    const next = withRecentQuestion(base, 'q3', 99);
    expect(next[0]).toEqual({ q: 'q3', at: 99 });
    expect(next.filter((i) => i.q === 'q3')).toHaveLength(1);
    expect(next).toHaveLength(MAX_RECENT_QUESTIONS);
  });
});

describe('pickQuestions', () => {
  it('חמש שאלות שונות מהמאגר', () => {
    const picked = pickQuestions(5);
    expect(new Set(picked).size).toBe(5);
    expect(picked.every((q) => AI_QUESTION_BANK.includes(q))).toBe(true);
  });
  it('לא כולל שאלות מקבוצת ההחרגה', () => {
    const exclude = AI_QUESTION_BANK.slice(0, 10);
    expect(pickQuestions(5, Math.random, exclude).some((q) => exclude.includes(q))).toBe(false);
  });
});

describe('buildAiSummary', () => {
  const item = (type: 'income' | 'expense', amountAgorot: number, yearMonth: string, categoryName: string, counterparty: string) => ({
    type, amountAgorot, yearMonth, categoryName, counterparty, categoryId: categoryName, paymentMethod: 'credit' as const,
  });
  const summary = buildAiSummary({
    spaceName: 'משק בית',
    selected: '2026-10',
    previousMonth: '2026-09',
    months: [{ yearMonth: '2026-10', incomeAgorot: 900_000, expenseAgorot: 250_050 }],
    items: [item('expense', 150_000, '2026-10', 'מזון', 'שופרסל'), item('expense', 100_050, '2026-10', 'דלק', 'פז'), item('expense', 5_000, '2026-09', 'מזון', 'שופרסל')],
  });
  it('מסכם בשקלים שלמים ובלי פעולות בודדות', () => {
    expect(summary.months).toEqual([{ month: '2026-10', income: 9000, expenses: 2501, balance: 6499 }]);
    expect(summary.selectedMonthExpensesByCategory).toEqual([{ name: 'מזון', amount: 1500 }, { name: 'דלק', amount: 1001 }]);
    expect(summary.previousMonthExpensesByCategory).toEqual([{ name: 'מזון', amount: 50 }]);
    expect(JSON.stringify(summary)).not.toContain('"id"');
  });
});
