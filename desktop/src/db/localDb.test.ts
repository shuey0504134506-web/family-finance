import { describe, expect, it } from 'vitest';
import { IncrementValue, LocalDb } from './localDb';

const col = 'users/u1/householdTransactions';
const q = (extra: object = {}) => ({ collection: col, wheres: [], orders: [], ...extra });

describe('LocalDb', () => {
  it('set/get/delete', () => {
    const db = new LocalDb();
    db.set(`${col}/a`, { amount: 5, note: 'x' });
    expect(db.get(`${col}/a`)?.data).toEqual({ amount: 5, note: 'x' });
    db.delete(`${col}/a`);
    expect(db.get(`${col}/a`)).toBeNull();
  });
  it('merge ממזג עמוק ו-increment מצטבר', () => {
    const db = new LocalDb();
    const p = 'users/u1/usage/main';
    db.set(p, { days: { '2026-10-16': new IncrementValue(1) }, updatedAt: 1 }, true);
    db.set(p, { days: { '2026-10-16': new IncrementValue(1), '2026-10-17': new IncrementValue(1) } }, true);
    expect(db.get(p)?.data).toEqual({ days: { '2026-10-16': 2, '2026-10-17': 1 }, updatedAt: 1 });
  });
  it('update תומך בנתיב מנוקד וזורק על מסמך חסר', () => {
    const db = new LocalDb();
    expect(() => db.update(`${col}/zz`, { a: 1 })).toThrow();
    db.set(`${col}/a`, { m: { x: 1 } });
    db.update(`${col}/a`, { 'm.y': 2 });
    expect(db.get(`${col}/a`)?.data).toEqual({ m: { x: 1, y: 2 } });
  });
  it('שאילתות: סינון, מיון, limit, ורק תת-אוסף ישיר', () => {
    const db = new LocalDb();
    db.set(`${col}/a`, { date: '2026-10-01' });
    db.set(`${col}/b`, { date: '2026-10-05' });
    db.set(`${col}/c`, { date: '2026-10-09' });
    db.set(`users/u1/businessTransactions/d`, { date: '2026-10-07' });
    const ids = (r: { id: string }[]) => r.map((x) => x.id);
    expect(ids(db.list(q({ wheres: [{ field: 'date', op: '>=', value: '2026-10-05' }] })))).toEqual(['b', 'c']);
    expect(ids(db.list(q({ orders: [{ field: 'date', dir: 'desc' }], max: 2 })))).toEqual(['c', 'b']);
    expect(ids(db.list(q({ wheres: [{ field: 'date', op: '<=', value: '2026-10-05' }], orders: [{ field: 'date', dir: 'asc' }], max: 1 })))).toEqual(['a']);
  });
  it('batch הוא אטומי', () => {
    const db = new LocalDb();
    db.set(`${col}/a`, { v: 1 });
    expect(() => db.batch([() => db.set(`${col}/b`, { v: 2 }), () => db.update(`${col}/missing`, { v: 3 })])).toThrow();
    expect(db.get(`${col}/b`)).toBeNull();
    expect(db.get(`${col}/a`)).not.toBeNull();
  });
  it('listeners ו-onChange נקראים פעם אחת לכל batch', () => {
    const db = new LocalDb();
    let calls = 0;
    let saves = 0;
    db.subscribe(() => calls++);
    db.onChange = () => saves++;
    db.batch([() => db.set(`${col}/a`, { v: 1 }), () => db.set(`${col}/b`, { v: 1 })]);
    expect([calls, saves]).toEqual([1, 1]);
  });
  it('outbox רק בחשבון מסונכרן, ושינוי מרוחק לא דורס כתיבה ממתינה', () => {
    const offline = new LocalDb();
    offline.set(`${col}/a`, { v: 1 });
    expect(offline.pendingPaths()).toEqual([]);
    const db = new LocalDb(undefined, true);
    db.set(`${col}/a`, { v: 1 });
    db.applyRemote(`${col}/a`, { v: 99 });
    expect(db.get(`${col}/a`)?.data).toEqual({ v: 1 });
    db.ack(`${col}/a`, 'set');
    db.applyRemote(`${col}/a`, { v: 99 });
    expect(db.get(`${col}/a`)?.data).toEqual({ v: 99 });
  });
  it('ack לא מנקה אם נכתב שוב בינתיים (set אחרי delete)', () => {
    const db = new LocalDb(undefined, true);
    db.set(`${col}/a`, { v: 1 });
    db.delete(`${col}/a`);
    db.ack(`${col}/a`, 'set');
    expect(db.pendingPaths()).toEqual([[`${col}/a`, 'delete']]);
  });
  it('state הולך הלוך-חזור דרך JSON', () => {
    const db = new LocalDb(undefined, true);
    db.set(`${col}/a`, { v: 1, s: 'שלום' });
    const copy = new LocalDb(JSON.parse(JSON.stringify(db.state)), true);
    expect(copy.get(`${col}/a`)?.data).toEqual({ v: 1, s: 'שלום' });
    expect(copy.pendingPaths()).toHaveLength(1);
  });
});
