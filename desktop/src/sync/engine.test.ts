import { describe, expect, it } from 'vitest';
import { LocalDb, parentOf, type DocData } from '../db/localDb';
import { SyncEngine, type Cloud, type Remote, type Target } from './engine';

class FakeCloud implements Cloud {
  docs = new Map<string, DocData>();
  down = false;
  denied = new Set<string>();
  writes: string[] = [];
  private watchers: { t: Target; cb: (l: Remote[]) => void }[] = [];
  private list(t: Target): Remote[] {
    return [...this.docs].filter(([p, d]) => (t.kind === 'doc' ? p === t.path : parentOf(p) === t.path && (!t.where || d[t.where.field] === t.where.value))).map(([path, data]) => ({ path, data: structuredClone(data) }));
  }
  async read(t: Target) { this.check(); return this.list(t); }
  async write(p: string, d: DocData) { this.check(); if (this.denied.has(p)) throw Object.assign(new Error('x'), { code: 'permission-denied' }); this.writes.push(p); this.docs.set(p, structuredClone(d)); this.fire(); }
  async remove(p: string) { this.check(); this.docs.delete(p); this.fire(); }
  watch(t: Target, cb: (l: Remote[]) => void) { const w = { t, cb }; this.watchers.push(w); return () => { this.watchers = this.watchers.filter((x) => x !== w); }; }
  fire() { for (const w of this.watchers) w.cb(this.list(w.t)); }
  private check() { if (this.down) throw Object.assign(new Error('net'), { code: 'unavailable' }); }
}

const U = 'u1';
const tx = `users/${U}/householdTransactions`;
const make = (cloud: FakeCloud, db = new LocalDb(undefined, true)) => ({ db, eng: new SyncEngine(db, cloud, U, null, () => undefined, 5) });

describe('SyncEngine', () => {
  it('דוחף כתיבות ומחיקות ממתינות ומנקה את התור', async () => {
    const c = new FakeCloud();
    c.docs.set(`${tx}/old`, { v: 0 });
    const { db, eng } = make(c);
    db.applyRemote(`${tx}/old`, { v: 0 });
    db.set(`${tx}/new`, { v: 1 });
    db.delete(`${tx}/old`);
    await eng.syncNow();
    expect(c.docs.get(`${tx}/new`)).toEqual({ v: 1 });
    expect(c.docs.has(`${tx}/old`)).toBe(false);
    expect(db.pendingPaths()).toEqual([]);
  });
  it('מושך מהענן, כולל מחיקה שנעשתה במכשיר אחר', async () => {
    const c = new FakeCloud();
    c.docs.set(`${tx}/a`, { v: 1 });
    const { db, eng } = make(c);
    await eng.syncNow();
    expect(db.get(`${tx}/a`)?.data).toEqual({ v: 1 });
    c.docs.delete(`${tx}/a`);
    await eng.syncNow();
    expect(db.get(`${tx}/a`)).toBeNull();
  });
  it('כתיבה מקומית שלא עלתה לא נמחקת ולא נדרסת במשיכה', async () => {
    const c = new FakeCloud();
    c.docs.set(`${tx}/a`, { v: 'cloud' });
    const { db, eng } = make(c);
    await eng.syncNow();
    c.down = true;
    db.update(`${tx}/a`, { v: 'local' });
    db.set(`${tx}/b`, { v: 'only-local' });
    await eng.syncNow();
    expect(db.get(`${tx}/a`)?.data.v).toBe('local');
    expect(db.pendingPaths()).toHaveLength(2);
    c.down = false;
    await eng.syncNow();
    expect(c.docs.get(`${tx}/a`)).toEqual({ v: 'local' });
    expect(c.docs.get(`${tx}/b`)).toEqual({ v: 'only-local' });
    expect(db.pendingPaths()).toEqual([]);
  });
  it('אופליין: אין שגיאה, הסטטוס offline, ושום דבר לא אובד', async () => {
    const c = new FakeCloud();
    const { db, eng } = make(c);
    c.down = true;
    db.set(`${tx}/a`, { v: 1 });
    const seen: string[] = [];
    eng.onStatus((s) => seen.push(s.kind));
    await eng.syncNow();
    expect(seen.at(-1)).toBe('offline');
    expect(db.get(`${tx}/a`)).not.toBeNull();
  });
  it('דחייה לצמיתות: approvals נזרקת, מסמך רגיל נשאר ומדווח כשגיאה', async () => {
    const c = new FakeCloud();
    c.denied.add(`approvals/${U}`).add(`${tx}/bad`);
    const { db, eng } = make(c);
    db.set(`approvals/${U}`, { status: 'pending' });
    db.set(`${tx}/bad`, { v: 1 });
    db.set(`${tx}/good`, { v: 1 });
    const seen: string[] = [];
    eng.onStatus((s) => seen.push(s.kind));
    await eng.syncNow();
    expect(c.docs.has(`${tx}/good`)).toBe(true);
    expect(db.pendingPaths().map(([p]) => p)).toEqual([`${tx}/bad`]);
    expect(seen.at(-1)).toBe('error');
  });
  it('הודעות: נמשכות רק של המשתמש, ולא נמחקות הודעות של אחרים שלא אצלנו', async () => {
    const c = new FakeCloud();
    c.docs.set('messages/m1', { uid: U, text: 'hi' });
    c.docs.set('messages/m2', { uid: 'other', text: 'no' });
    const { db, eng } = make(c);
    await eng.syncNow();
    expect(db.get('messages/m1')).not.toBeNull();
    expect(db.get('messages/m2')).toBeNull();
  });
  it('האזנה בזמן אמת מעדכנת, וסנכרון ראשון מסמן hydrated', async () => {
    const c = new FakeCloud();
    const db = new LocalDb(undefined, true);
    db.hydrated = false;
    const { eng } = make(c, db);
    eng.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(db.hydrated).toBe(true);
    c.docs.set(`${tx}/rt`, { v: 9 });
    c.fire();
    expect(db.get(`${tx}/rt`)?.data).toEqual({ v: 9 });
    db.set(`${tx}/loc`, { v: 1 });
    await new Promise((r) => setTimeout(r, 60));
    expect(c.docs.get(`${tx}/loc`)).toEqual({ v: 1 });
    eng.stop();
  });
});
