import { describe, expect, it } from 'vitest';
import { chatTitle, MAX_SAVED_CHATS, splitChatHistory, type AiChat } from './aiChats';
import { AI_QUESTION_BANK, pickQuestions } from './aiQuestions';
import { buildAiSummary } from './aiSummary';

const chat = (id: string, updatedAt: number, pinned = false): AiChat => ({ id, title: id, pinned, messages: [], createdAt: 1, updatedAt });

describe('chat history', () => {
  it('keeps ten latest in cloud and archives every older chat, including pinned ones', () => {
    const all = Array.from({ length: 15 }, (_, i) => chat(String(i), i, true));
    const { cloud, local } = splitChatHistory(all);
    expect(cloud).toHaveLength(MAX_SAVED_CHATS);
    expect(cloud[0].id).toBe('14');
    expect(local.map(c => c.id)).toEqual(['4','3','2','1','0']);
    expect(local.every(c => c.pinned)).toBe(true);
  });
  it('promotes a reopened chat without duplicates', () => {
    const all = Array.from({ length: 11 }, (_, i) => chat(String(i), i));
    const {cloud, local} = splitChatHistory([...all, chat('0', 20)]);
    expect(cloud[0].id).toBe('0');
    expect(local.map(c => c.id)).toEqual(['1']);
  });
  it('uses concise local titles instead of separate saved questions', () => {
    expect(chatTitle('כמה הוצאתי לכבוד שבת החודש?')).toBe('הוצאות לכבוד שבת החודש');
    expect(chatTitle('How much did I spend on groceries?')).toBe('Spending on groceries');
    expect(chatTitle('')).toBe('שיחה חדשה');
    expect(chatTitle('a'.repeat(500)).length).toBeLessThanOrEqual(55);
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
