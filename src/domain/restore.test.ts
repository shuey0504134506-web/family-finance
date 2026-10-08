import { describe, expect, it } from 'vitest';
import { buildBackup } from './export';
import { parseBackup } from './restore';

const tx = (over: Record<string, unknown> = {}) => ({
  id: 't1', type: 'expense', amountAgorot: 25000, date: '2026-10-07', yearMonth: '2026-10', year: 2026, month: 10,
  counterparty: 'ספק', categoryId: 'c1', categoryName: 'דלק', paymentMethod: 'credit', note: '',
  titheStatus: 'liable', isTithePayment: false, createdAt: 1, updatedAt: 2, ...over,
});
const cat = { id: 'c1', scope: 'business', type: 'expense', name: 'דלק', active: true, isDefault: false, sortOrder: 1, createdAt: 1, updatedAt: 1 };
const budget = { id: 'c1', scope: 'business', categoryId: 'c1', amountAgorot: 100000, createdAt: 1, updatedAt: 1 };
const task = { id: 'k1', scope: 'household', title: 'לשלם', done: false, remind: 'date', remindDate: '2026-10-10', createdAt: 1, updatedAt: 1 };
const item = { id: 'i1', scope: 'household', name: 'חלב', bought: false, createdAt: 1, updatedAt: 1 };
const settings = { id: 'main', titheBps: 1000, countBusinessTithePayments: true, businessTransferMode: 'allow-negative', updatedAt: 5 };

const file = (data: Record<string, unknown>) => JSON.stringify(buildBackup(data));

describe('parseBackup: משימות וקניות', () => {
  it('קורא משימות ופריטי קניות תקינים', () => {
    const r = parseBackup(file({ tasks: [task], shoppingItems: [item] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.tasks).toHaveLength(1);
    expect(r.plan.shoppingItems).toHaveLength(1);
  });
  it('דוחה תזכורת מתאריך בלי תאריך, ותאריך בתזכורת אחרת', () => {
    const r = parseBackup(
      file({ tasks: [task, { ...task, id: 'k2', remindDate: '' }, { ...task, id: 'k3', remind: 'daily' }, { ...task, id: 'k4', remind: 'daily', remindDate: '' }] }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.tasks.map((t) => t.id)).toEqual(['k1', 'k4']);
    expect(r.plan.invalid).toBe(2);
  });
});

describe('parseBackup', () => {
  it('קובץ תקין נקרא במלואו', () => {
    const r = parseBackup(file({ categories: [cat], budgets: [budget], businessTransactions: [tx()], householdTransactions: [], settings: [settings] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.categories).toHaveLength(1);
    expect(r.plan.budgets).toHaveLength(1);
    expect(r.plan.businessTransactions[0].id).toBe('t1');
    expect(r.plan.settings).toMatchObject({ titheBps: 1000 });
    expect(r.plan.settings).not.toHaveProperty('id');
    expect(r.plan.invalid).toBe(0);
  });

  it('דוחה טקסט שאינו JSON וקובץ של משהו אחר', () => {
    expect(parseBackup('לא json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ hello: 1 })).ok).toBe(false);
    expect(parseBackup('null').ok).toBe(false);
  });

  it('דוחה גרסה עתידית', () => {
    const raw = JSON.parse(file({ categories: [cat] }));
    raw.version = 99;
    expect(parseBackup(JSON.stringify(raw)).ok).toBe(false);
  });

  it('מסמכים לא תקינים נדלגים ונספרים, ולא עוצרים את השאר', () => {
    const r = parseBackup(
      file({
        businessTransactions: [tx(), tx({ id: 't2', amountAgorot: -5 }), tx({ id: 't3', amountAgorot: 1.5 }), tx({ id: 't4', date: '2026-13-40' }), tx({ id: 't5', paymentMethod: 'bitcoin' }), { id: 'x' }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.businessTransactions.map((d) => d.id)).toEqual(['t1']);
    expect(r.plan.invalid).toBe(5);
  });

  it('מזהה כפול נספר כלא תקין', () => {
    const r = parseBackup(file({ businessTransactions: [tx(), tx()] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.businessTransactions).toHaveLength(1);
    expect(r.plan.invalid).toBe(1);
  });

  it('שדות עודפים (כמו pendingSync) מוסרים, כי חוקי האבטחה דוחים אותם', () => {
    const r = parseBackup(file({ businessTransactions: [tx({ pendingSync: true, extra: 'x' })] }));
    if (!r.ok) throw new Error('expected ok');
    expect(Object.keys(r.plan.businessTransactions[0].data)).not.toContain('pendingSync');
    expect(Object.keys(r.plan.businessTransactions[0].data)).not.toContain('extra');
  });

  it('תקציב: מזהה הקטגוריה חייב להיות מזהה המסמך', () => {
    const r = parseBackup(file({ budgets: [{ ...budget, categoryId: 'other' }], categories: [cat] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.budgets).toHaveLength(0);
    expect(r.plan.invalid).toBe(1);
  });

  it('קובץ בלי נתונים נדחה', () => {
    expect(parseBackup(file({ categories: [], businessTransactions: [] })).ok).toBe(false);
  });

  it('אחוז מעשר מעל 100% בהגדרות אינו נקלט', () => {
    const r = parseBackup(file({ categories: [cat], settings: [{ ...settings, titheBps: 20000 }] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.settings).toBeNull();
    expect(r.plan.invalid).toBe(1);
  });
});

describe('parseBackup: כמה עסקים', () => {
  const biz = { id: 'b2', name: 'עסק שני', sortOrder: 1, createdAt: 1, updatedAt: 1 };

  it('קורא עסקים ומשמר מזהה עסק בפעולות, בקטגוריות ובתקציבים', () => {
    const r = parseBackup(
      file({
        businesses: [biz],
        businessTransactions: [tx({ businessId: 'b2' }), tx({ id: 't2' })],
        categories: [{ ...cat, businessId: 'b2' }],
        budgets: [{ ...budget, businessId: 'b2' }],
      }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.businesses).toHaveLength(1);
    expect(r.plan.businessTransactions[0].data.businessId).toBe('b2');
    expect(r.plan.businessTransactions[1].data).not.toHaveProperty('businessId');
    expect(r.plan.categories[0].data.businessId).toBe('b2');
    expect(r.plan.budgets[0].data.businessId).toBe('b2');
  });

  it('דוחה מזהה עסק לא תקין ועסק בלי שם', () => {
    const r = parseBackup(
      file({ businesses: [{ ...biz, name: '' }], businessTransactions: [tx({ businessId: '' }), tx({ id: 't3', businessId: 5 })] }),
    );
    expect(r.ok).toBe(false);
  });
});
