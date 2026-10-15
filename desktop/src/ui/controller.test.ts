import { beforeEach, describe, expect, it } from 'vitest';
import type { Storage } from '../core/session';
import type { DocData } from '../db/localDb';
import { auth_probe } from './probe';
import { Controller } from './controller';
import { derivedCandidates } from '../core/recovery';
import type { CloudAuth, CloudUser } from '../sync/firebaseCloud';
import type { Cloud, Remote, Target } from '../sync/engine';
import { parentOf } from '../db/localDb';

const memory = (): Storage => { const f = new Map<string, string>(); return { read: async (n) => f.get(n) ?? null, write: async (n, t) => void f.set(n, t), remove: async (n) => void f.delete(n) }; };

class FakeCloudAuth implements CloudAuth {
  configured = true;
  users = new Map<string, { uid: string; password: string; name: string }>();
  docs = new Map<string, DocData>();
  signedIn: string | null = null;
  async signIn(email: string, password: string): Promise<CloudUser> {
    const u = this.users.get(email);
    if (!u || u.password !== password) throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
    this.signedIn = email;
    return { uid: u.uid, email, displayName: u.name };
  }
  async signUp(email: string, password: string, name: string): Promise<CloudUser> { this.users.set(email, { uid: `uid-${email}`, password, name }); this.signedIn = email; return { uid: `uid-${email}`, email, displayName: name }; }
  async signOut() { this.signedIn = null; }
  async reauth() {}
  async changePassword(p: string) { this.users.get(this.signedIn!)!.password = p; }
  async resetEmail() {}
  async changeEmail() {}
  async deleteAccount() {}
  async call() { return {}; }
  store(): Cloud {
    const docs = this.docs;
    return {
      async read(t: Target): Promise<Remote[]> { return [...docs].filter(([p, d]) => (t.kind === 'doc' ? p === t.path : parentOf(p) === t.path && (!t.where || d[t.where.field] === t.where.value))).map(([path, data]) => ({ path, data })); },
      async write(p, d) { docs.set(p, d); },
      async remove(p) { docs.delete(p); },
      watch: () => () => undefined,
    };
  }
}

let created: string[];
const make = (cloud = new FakeCloudAuth(), online = true) => {
  created = [];
  const c = new Controller(memory(), cloud, async (uid) => { created.push(uid); c.db!.set(`users/${uid}`, { firstName: 'דנה' }); }, { iterations: 1000, debounceMs: 5 }, () => online);
  return { c, cloud };
};
const input = { email: 'd@d.d', firstName: 'דנה', lastName: 'כהן' };

describe('Controller', () => {
  beforeEach(() => auth_probe.reset());

  it('חשבון אופליין: הרשמה, יציאה, כניסה ללא רשת, ושום דבר לא נשלח לענן', async () => {
    const { c, cloud } = make(undefined, false);
    await c.boot();
    await c.signUpOffline(input, 'סיסמה-ארוכה-1');
    expect(c.getState().phase).toBe('in');
    expect(c.getState().sync).toEqual({ kind: 'local' });
    expect(auth_probe.user()?.offlineOnly).toBe(true);
    c.db!.set('users/x/householdTransactions/t1', { amount: 5 });
    const id = c.getState().me!.id;
    await c.logout();
    expect(auth_probe.user()).toBeNull();
    expect(cloud.docs.size).toBe(0);
    await c.unlock(id, 'סיסמה-ארוכה-1');
    expect(c.db!.get('users/x/householdTransactions/t1')?.data.amount).toBe(5);
    await c.logout();
    await expect(c.unlock(id, 'שגויה-שגויה')).rejects.toThrow();
    expect(cloud.signedIn).toBeNull();
  });

  it('חשבון מקוון: הרשמה מסנכרנת לענן, וכניסה ראשונה במחשב אחר מורידה את הנתונים', async () => {
    const a = make();
    await a.c.boot();
    await a.c.signUpOnline(input, 'סיסמה-ארוכה-1');
    a.c.db!.set('users/uid-d@d.d/householdTransactions/t1', { amount: 7 });
    await a.c.syncNow();
    expect(a.cloud.docs.get('users/uid-d@d.d/householdTransactions/t1')).toEqual({ amount: 7 });
    expect(a.cloud.docs.get('users/uid-d@d.d')).toEqual({ firstName: 'דנה' });

    const b = make(a.cloud);
    await b.c.boot();
    await b.c.firstOnlineLogin('d@d.d', 'סיסמה-ארוכה-1');
    expect(b.c.db!.get('users/uid-d@d.d/householdTransactions/t1')?.data.amount).toBe(7);
    expect(b.c.db!.hydrated).toBe(true);
  });

  it('כניסה ראשונה בלי אינטרנט נכשלת בהודעה ברורה, והחשבון לא נוצר', async () => {
    const { c } = make(undefined, false);
    await c.boot();
    await expect(c.firstOnlineLogin('x@x.x', 'whatever-123')).rejects.toMatchObject({ code: 'app/offline' });
    await expect(c.signUpOnline(input, 'סיסמה-ארוכה-1')).rejects.toMatchObject({ code: 'app/offline' });
    expect(c.getState().phase).toBe('picker');
  });

  it('שחזור סיסמה בחשבון אופליין דרך הבקר', async () => {
    const { c } = make(undefined, false);
    await c.boot();
    await c.signUpOffline(input, 'סיסמה-ישנה-1');
    const id = c.getState().me!.id;
    await c.setRecovery([0, 1, 2].map((i) => ({ kind: 'custom' as const, text: `שאלה ${i}` })), ['א1', 'ב2', 'ג3']);
    await c.logout();
    expect(await c.recoveryQuestions(id)).toHaveLength(3);
    await expect(c.recover(id, ['א1', 'ב2', 'לא'], 'חדשה-חדשה-1')).rejects.toThrow();
    await c.recover(id, ['א1', 'ב2', 'ג3'], 'חדשה-חדשה-1');
    expect(c.getState().phase).toBe('in');
    await c.logout();
    await c.unlock(id, 'חדשה-חדשה-1');
    expect(c.getState().phase).toBe('in');
  });

  it('סיסמה שונתה בענן: הכספת נפתחת בישנה, ואחר כך מאמצים את החדשה', async () => {
    const a = make();
    await a.c.boot();
    await a.c.signUpOnline(input, 'ישנה-ישנה-12');
    await a.c.logout();
    a.cloud.users.get('d@d.d')!.password = 'חדשה-חדשה-12';
    await a.c.unlock('uid-d@d.d', 'ישנה-ישנה-12');
    await new Promise((r) => setTimeout(r, 20));
    expect(a.c.getState().needsPasswordSync).toBe(true);
    await a.c.adoptCloudPassword('חדשה-חדשה-12');
    expect(a.c.getState().needsPasswordSync).toBe(false);
    await a.c.logout();
    await a.c.unlock('uid-d@d.d', 'חדשה-חדשה-12');
    expect(a.c.getState().phase).toBe('in');
  });
});

describe('רענון שחזור בכניסה', () => {
  it('עריכת פעולה ישנה לא מנעילה את השחזור', async () => {
    const { c } = make(undefined, false);
    await c.boot();
    await c.signUpOffline(input, 'סיסמה-ארוכה-1');
    const uid = c.getState().me!.uid;
    const id = c.getState().me!.id;
    const tx = (n: string, type: string, amount: number, name: string, cat: string, day: string) => c.db!.set(`users/${uid}/householdTransactions/${n}`, { type, amountAgorot: amount, date: `2020-05-${day}`, counterparty: name, categoryName: cat });
    tx('a', 'income', 1000000, 'משכורת', 'משכורת', '01');
    tx('b', 'expense', 50000, 'שופרסל', 'מזון', '03');
    tx('c', 'expense', 450000, 'משכיר', 'דיור', '05');
    tx('d', 'expense', 30000, 'פז', 'רכב', '09');
    const cand = derivedCandidates(c.txByScope(), '2026-10').find((x) => x.question.template === 'top-expense-name')!;
    await c.setRecovery([cand.question, { kind: 'custom', text: 'האוכל האהוב עליך?' }, { kind: 'custom', text: 'שם הכלב הראשון?' }], [cand.answer, 'פיצה', 'רקס']);
    c.db!.update(`users/${uid}/householdTransactions/b`, { amountAgorot: 900000 });
    await c.logout();
    await c.unlock(id, 'סיסמה-ארוכה-1');
    await c.logout();
    await c.recover(id, ['שופרסל', 'פיצה', 'רקס'], 'חדשה-חדשה-1');
    expect(c.getState().phase).toBe('in');
  });
});
