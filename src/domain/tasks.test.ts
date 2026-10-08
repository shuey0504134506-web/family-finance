import { describe, expect, it } from 'vitest';
import {
  buildShoppingItem,
  buildTask,
  dueReminders,
  markShown,
  parseShownMap,
  sortItems,
  sortTasks,
  validateItemName,
  validateTaskDraft,
  type Task,
} from './tasks';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', scope: 'business', title: 'להתקשר', done: false, remind: 'none', remindDate: '', createdAt: 1, updatedAt: 1, ...over,
});

describe('validateTaskDraft / buildTask', () => {
  it('דורש תיאור, ותאריך כשהתזכורת מתאריך', () => {
    expect(validateTaskDraft({ title: '  ', remind: 'none', remindDate: '' }).title).toBeDefined();
    expect(validateTaskDraft({ title: 'א'.repeat(201), remind: 'none', remindDate: '' }).title).toBeDefined();
    expect(validateTaskDraft({ title: 'x', remind: 'date', remindDate: '' }).remindDate).toBeDefined();
    expect(validateTaskDraft({ title: 'x', remind: 'date', remindDate: '2026-02-31' }).remindDate).toBeDefined();
    expect(validateTaskDraft({ title: 'x', remind: 'date', remindDate: '2026-10-10' })).toEqual({});
    expect(validateTaskDraft({ title: 'x', remind: 'daily', remindDate: '' })).toEqual({});
  });
  it('התאריך נשמר רק לתזכורת מתאריך', () => {
    expect(buildTask({ title: ' x ', remind: 'daily', remindDate: '2026-10-10' }, { id: 'a', scope: 'household', now: 5 })).toEqual({
      id: 'a', scope: 'household', title: 'x', done: false, remind: 'daily', remindDate: '', createdAt: 5, updatedAt: 5,
    });
    expect(buildTask({ title: 'x', remind: 'date', remindDate: '2026-10-10' }, { id: 'a', scope: 'business', now: 5 }).remindDate).toBe('2026-10-10');
  });
  it('בעריכה createdAt נשמר ו-done נשמר', () => {
    const t = buildTask({ title: 'x', remind: 'none', remindDate: '' }, { id: 'a', scope: 'business', now: 9, createdAt: 2, done: true });
    expect([t.createdAt, t.updatedAt, t.done]).toEqual([2, 9, true]);
  });
});

describe('פריטי קניות', () => {
  it('שם חובה ועד 120 תווים', () => {
    expect(validateItemName(' ')).not.toBeNull();
    expect(validateItemName('א'.repeat(121))).not.toBeNull();
    expect(validateItemName('חלב')).toBeNull();
  });
  it('בונה פריט שלא נקנה', () => {
    expect(buildShoppingItem(' חלב ', { id: 'i', scope: 'household', now: 3 })).toEqual({
      id: 'i', scope: 'household', name: 'חלב', bought: false, createdAt: 3, updatedAt: 3,
    });
  });
  it('ממיין: לא נקנו קודם, החדש למעלה', () => {
    const items = [
      buildShoppingItem('ישן', { id: '1', scope: 'household', now: 1 }),
      buildShoppingItem('נקנה', { id: '2', scope: 'household', now: 5, bought: true }),
      buildShoppingItem('חדש', { id: '3', scope: 'household', now: 3 }),
    ];
    expect(sortItems(items).map((i) => i.id)).toEqual(['3', '1', '2']);
  });
});

describe('dueReminders', () => {
  const today = '2026-10-08';
  it('בכל כניסה: תמיד, גם אם כבר הוצגה היום', () => {
    expect(dueReminders([task({ remind: 'every-open' })], today, { t1: today })).toHaveLength(1);
  });
  it('פעם ביום: פעם אחת ביום', () => {
    const t = task({ remind: 'daily' });
    expect(dueReminders([t], today, {})).toHaveLength(1);
    expect(dueReminders([t], today, { t1: today })).toHaveLength(0);
    expect(dueReminders([t], today, { t1: '2026-10-07' })).toHaveLength(1);
  });
  it('מתאריך: לא לפני התאריך, ומהתאריך ואילך פעם ביום', () => {
    const t = task({ remind: 'date', remindDate: '2026-10-08' });
    expect(dueReminders([t], '2026-10-07', {})).toHaveLength(0);
    expect(dueReminders([t], '2026-10-08', {})).toHaveLength(1);
    expect(dueReminders([t], '2026-10-12', {})).toHaveLength(1);
    expect(dueReminders([t], '2026-10-12', { t1: '2026-10-12' })).toHaveLength(0);
  });
  it('משימה שבוצעה או בלי תזכורת לא מקפיצה', () => {
    expect(dueReminders([task({ remind: 'every-open', done: true })], today, {})).toHaveLength(0);
    expect(dueReminders([task({ remind: 'none' })], today, {})).toHaveLength(0);
  });
});

describe('markShown / parseShownMap', () => {
  it('מסמן רק יומיות ומתאריך, ומנקה משימות שנמחקו', () => {
    const tasks = [task({ id: 'a', remind: 'daily' }), task({ id: 'b', remind: 'every-open' })];
    const next = markShown({ gone: '2026-10-01' }, tasks, tasks, '2026-10-08');
    expect(next).toEqual({ a: '2026-10-08' });
  });
  it('קריאה פגומה מחזירה מפה ריקה', () => {
    expect(parseShownMap(null)).toEqual({});
    expect(parseShownMap('לא json')).toEqual({});
    expect(parseShownMap('[1]')).toEqual({});
    expect(parseShownMap('{"a":"2026-10-08","b":5}')).toEqual({ a: '2026-10-08' });
  });
});

describe('sortTasks', () => {
  it('פתוחות קודם, החדשה למעלה', () => {
    const sorted = sortTasks([task({ id: 'd', done: true, createdAt: 9 }), task({ id: 'o1', createdAt: 1 }), task({ id: 'o2', createdAt: 2 })]);
    expect(sorted.map((t) => t.id)).toEqual(['o2', 'o1', 'd']);
  });
});
