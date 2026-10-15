import { describe, expect, it } from 'vitest';
import { Session, WrongPassword, type Storage } from './session';

const memory = (): Storage & { files: Map<string, string> } => {
  const files = new Map<string, string>();
  return { files, read: async (n) => files.get(n) ?? null, write: async (n, t) => void files.set(n, t), remove: async (n) => void files.delete(n) };
};
const opts = { iterations: 1000, debounceMs: 5 };
const Q = [0, 1, 2].map((i) => ({ kind: 'custom' as const, text: `שאלה ${i} לבדיקה` }));

describe('Session', () => {
  it('חשבון אופליין: נוצר, נשמר מוצפן, ונפתח מחדש עם הנתונים', async () => {
    const st = memory();
    const s = new Session(st, opts);
    const a = await s.createOffline({ email: 'a@b.c', displayName: 'דנה' }, 'סיסמה-ארוכה');
    expect(a.meta.kind).toBe('offline');
    expect(a.db.get(`approvals/${a.meta.uid}`)?.data.status).toBe('approved');
    a.db.set(`users/${a.meta.uid}/householdTransactions/t1`, { counterparty: 'שופרסל', amount: 41200 });
    await a.flush();
    const disk = [...st.files.values()].join('');
    expect(disk).not.toContain('שופרסל');
    expect(a.db.pendingPaths()).toEqual([]);
    await a.lock();

    const b = await new Session(st, opts).unlock(a.meta.id, 'סיסמה-ארוכה');
    expect(b.db.get(`users/${a.meta.uid}/householdTransactions/t1`)?.data.amount).toBe(41200);
    await expect(new Session(st, opts).unlock(a.meta.id, 'לא נכון')).rejects.toBeInstanceOf(WrongPassword);
  });

  it('שינוי נשמר אוטומטית אחרי debounce בלי flush ידני', async () => {
    const st = memory();
    const s = new Session(st, opts);
    const a = await s.createOffline({ email: '', displayName: 'x' }, 'pw-pw-pw-pw');
    a.db.set('users/q/settings/main', { v: 1 });
    await new Promise((r) => setTimeout(r, 60));
    const b = await new Session(st, opts).unlock(a.meta.id, 'pw-pw-pw-pw');
    expect(b.db.get('users/q/settings/main')?.data.v).toBe(1);
  });

  it('חשבון מקוון עוקב אחרי outbox וזה נשמר בקובץ', async () => {
    const st = memory();
    const s = new Session(st, opts);
    const a = await s.createOnline({ uid: 'U1', email: 'e@e.e', displayName: 'ד' }, 'pw-pw-pw-pw');
    a.db.set('users/U1/settings/main', { v: 1 });
    await a.flush();
    const b = await new Session(st, opts).unlock('U1', 'pw-pw-pw-pw');
    expect(b.db.pendingPaths()).toEqual([['users/U1/settings/main', 'set']]);
  });

  it('שחזור סיסמה בשלוש תשובות', async () => {
    const st = memory();
    const s = new Session(st, opts);
    const a = await s.createOffline({ email: '', displayName: 'x' }, 'old-old-old');
    a.db.set('users/q/settings/main', { v: 7 });
    await a.setRecovery(Q, ['פיצה', 'רקס', 'חיפה']);
    await a.lock();
    const s2 = new Session(st, opts);
    expect((await s2.recoveryQuestions(a.meta.id))?.map((q) => q.text)).toEqual(Q.map((q) => q.text));
    await expect(s2.recover(a.meta.id, ['פיצה', 'רקס', 'עכו'], 'new-new-new')).rejects.toBeInstanceOf(WrongPassword);
    const r = await s2.recover(a.meta.id, ['פיצה ', 'רקס', 'חיפה'], 'new-new-new');
    expect(r.db.get('users/q/settings/main')?.data.v).toBe(7);
    await r.lock();
    await expect(s2.unlock(a.meta.id, 'old-old-old')).rejects.toBeInstanceOf(WrongPassword);
    expect((await s2.unlock(a.meta.id, 'new-new-new')).meta.id).toBe(a.meta.id);
  });

  it('החלפת סיסמה, רשימת חשבונות ומחיקה', async () => {
    const st = memory();
    const s = new Session(st, opts);
    const a = await s.createOffline({ email: '', displayName: 'x' }, 'aaaa-aaaa-aa');
    const b = await s.createOffline({ email: '', displayName: 'y' }, 'bbbb-bbbb-bb');
    expect(await s.list()).toHaveLength(2);
    await a.changePassword('cccc-cccc-cc');
    await expect(s.unlock(a.meta.id, 'aaaa-aaaa-aa')).rejects.toBeInstanceOf(WrongPassword);
    await s.unlock(a.meta.id, 'cccc-cccc-cc');
    await s.remove(b.meta.id);
    expect((await s.list()).map((m) => m.id)).toEqual([a.meta.id]);
  });
});
