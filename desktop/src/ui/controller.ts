import { Session, Unlocked, WrongPassword, type AccountMeta, type Storage } from '../core/session';
import { normalizeAnswer, recomputeDerived, type RecoveryQuestion, type TxLike } from '../core/recovery';
import { LocalDb } from '../db/localDb';
import { publishUser, setAuthBackend, type AuthBackend, type User } from '../shims/auth';
import { functionsBackend } from '../shims/functionsBackend';
import { setActiveDb } from '../shims/registry';
import type { CloudAuth } from '../sync/firebaseCloud';
import { SyncEngine, type SyncStatus } from '../sync/engine';

export type Phase = 'booting' | 'picker' | 'in';
export interface UiState {
  phase: Phase;
  accounts: AccountMeta[];
  me: AccountMeta | null;
  sync: SyncStatus | { kind: 'local' };
  /** חשבון מקוון שהסיסמה שלו בענן שונתה במקום אחר */
  needsPasswordSync: boolean;
  online: boolean;
  recoveryQuestions: RecoveryQuestion[] | null;
}

export interface NewAccount { email: string; firstName: string; lastName: string }
type CreateRecords = (uid: string, input: never) => Promise<void>;

const appErr = (code: string) => Object.assign(new Error(code), { code });
const toUser = (m: AccountMeta): User => ({ uid: m.uid, email: m.email || null, displayName: m.displayName || null, emailVerified: true, offlineOnly: m.kind === 'offline' });
const isBadCredential = (e: unknown) => /invalid-credential|wrong-password|invalid-login/.test((e as { code?: string })?.code ?? '');

export class Controller {
  private state: UiState = { phase: 'booting', accounts: [], me: null, sync: { kind: 'local' }, needsPasswordSync: false, online: true, recoveryQuestions: null };
  private listeners = new Set<() => void>();
  private session: Session;
  private cur: Unlocked | null = null;
  private engine: SyncEngine | null = null;
  private offEngine: (() => void) | null = null;
  private password = '';
  private connecting: Promise<void> | null = null;

  constructor(storage: Storage, private readonly cloud: CloudAuth, private readonly createRecords: CreateRecords, opts: { iterations?: number; debounceMs?: number } = {}, private readonly isOnline: () => boolean = () => navigator.onLine) {
    this.session = new Session(storage, opts);
    setAuthBackend(this.backend());
    functionsBackend.call = (name, data) => {
      if (this.cur?.meta.kind !== 'online') throw appErr('functions/unavailable');
      return this.cloud.call(name, data);
    };
  }

  // ---- מצב לתצוגה ----
  getState = (): UiState => this.state;
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private set(patch: Partial<UiState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  async boot(): Promise<void> {
    publishUser(null);
    this.set({ phase: 'picker', accounts: await this.session.list(), online: this.isOnline() });
  }

  setOnline(on: boolean): void {
    this.set({ online: on });
    this.engine?.setOnline(on);
    if (on && this.cur?.meta.kind === 'online' && !this.engine) this.connecting = this.connectCloud().catch(() => undefined);
  }

  // ---- כניסה ----
  /** כניסה לחשבון שכבר קיים במחשב הזה. עובדת תמיד, גם בלי אינטרנט. */
  async unlock(id: string, password: string): Promise<void> {
    const u = await this.session.unlock(id, password);
    await this.enter(u, password);
  }

  /** כניסה ראשונה במחשב: חייבת אינטרנט. אם כבר יש כספת לחשבון הזה היא נפתחת בסיסמה החדשה או נבנית מחדש מהענן. */
  async firstOnlineLogin(email: string, password: string): Promise<void> {
    if (!this.isOnline()) throw appErr('app/offline');
    const cu = await this.cloud.signIn(email, password);
    const existing = this.state.accounts.find((a) => a.id === cu.uid);
    if (existing) {
      try { await this.unlock(cu.uid, password); return; } catch (e) { if (!(e instanceof WrongPassword)) throw e; }
      await this.session.remove(cu.uid);
    }
    const u = await this.session.createOnline(cu, password);
    u.db.hydrated = false;
    await this.enter(u, password, true);
  }

  async signUpOnline(input: NewAccount, password: string): Promise<void> {
    if (!this.isOnline()) throw appErr('app/offline');
    const name = `${input.firstName.trim()} ${input.lastName.trim()}`;
    const cu = await this.cloud.signUp(input.email, password, name);
    const u = await this.session.createOnline({ ...cu, displayName: name }, password);
    await this.enter(u, password);
    await this.createRecords(cu.uid, { ...input, email: cu.email } as never);
  }

  /** חשבון מנותק: לא מסונכרן לעולם, גם כשיש אינטרנט. */
  async signUpOffline(input: NewAccount, password: string): Promise<Unlocked> {
    const u = await this.session.createOffline({ email: input.email.trim(), displayName: `${input.firstName.trim()} ${input.lastName.trim()}` }, password);
    await this.enter(u, password);
    await this.createRecords(u.meta.uid, { ...input, email: input.email.trim() } as never);
    return u;
  }

  async recoveryQuestions(id: string): Promise<RecoveryQuestion[] | null> {
    return this.session.recoveryQuestions(id);
  }

  async recover(id: string, answers: string[], newPassword: string): Promise<void> {
    await this.enter(await this.session.recover(id, answers, newPassword), newPassword);
  }

  private async enter(u: Unlocked, password: string, awaitPull = false): Promise<void> {
    this.cur = u;
    this.password = password;
    setActiveDb(u.db);
    this.set({ me: u.meta, phase: 'in', recoveryQuestions: u.recoveryQuestions, needsPasswordSync: false, sync: u.meta.kind === 'online' ? { kind: 'idle', pending: u.db.pendingPaths().length, lastSync: u.lastSync } : { kind: 'local' } });
    if (u.meta.kind === 'online') {
      if (awaitPull) {
        try { await this.connectCloud(true); } catch (e) { await this.logout(); await this.session.remove(u.meta.id); this.set({ accounts: await this.session.list() }); throw e; }
      } else if (this.isOnline()) {
        this.connecting = this.connectCloud().catch(() => undefined);
      }
    }
    await this.healRecovery();
    publishUser(toUser(u.meta));
  }

  /** פעולות לפי תחום, לשאלות שחזור נגזרות */
  txByScope(): { household: TxLike[]; business: TxLike[] } {
    const out = { household: [] as TxLike[], business: [] as TxLike[] };
    const db = this.cur?.db;
    if (!db || !this.cur) return out;
    for (const scope of ['household', 'business'] as const) {
      for (const e of db.list({ collection: `users/${this.cur.meta.uid}/${scope}Transactions`, wheres: [], orders: [] })) {
        const d = e.data;
        out[scope].push({ type: d.type as TxLike['type'], amountAgorot: Number(d.amountAgorot) || 0, date: String(d.date ?? ''), counterparty: String(d.counterparty ?? ''), categoryName: String(d.categoryName ?? '') });
      }
    }
    return out;
  }

  /** מרענן תשובות לשאלות נגזרות, כך שעריכה של פעולה ישנה לא תנעל את שחזור הסיסמה. */
  private async healRecovery(): Promise<void> {
    const u = this.cur;
    const qs = u?.recoveryQuestions;
    const answers = u?.recoveryAnswers;
    if (!u || !qs || !answers || answers.length !== qs.length) return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const by = this.txByScope();
    let changed = false;
    const next = qs.map((q, i) => {
      const fresh = recomputeDerived(q, by, ym);
      if (fresh !== null && normalizeAnswer(fresh) !== normalizeAnswer(answers[i]!)) { changed = true; return fresh; }
      return answers[i]!;
    });
    if (changed) await u.setRecovery(qs, next);
  }

  /** מתחבר לענן ברקע (או בהמתנה בכניסה ראשונה) ומתחיל סנכרון. */
  private async connectCloud(waitFirstPull = false): Promise<void> {
    const u = this.cur;
    if (!u || u.meta.kind !== 'online' || this.engine) return;
    try {
      await this.cloud.signIn(u.meta.email, this.password);
    } catch (e) {
      if (isBadCredential(e)) { this.set({ needsPasswordSync: true }); return; }
      if (waitFirstPull) throw e;
      return;
    }
    const engine = new SyncEngine(u.db, this.cloud.store(), u.meta.uid, u.lastSync, (at) => { u.lastSync = at; void u.flush(); });
    this.engine = engine;
    this.offEngine = engine.onStatus((s) => this.set({ sync: s }));
    if (waitFirstPull) {
      await engine.syncNow();
      if (engine.status.kind === 'offline' || engine.status.kind === 'error') { engine.stop(); this.engine = null; throw appErr('app/offline'); }
      u.db.hydrated = true;
    }
    engine.start();
  }

  /** אחרי ששונתה הסיסמה במקום אחר: מאמתים מול הענן וקובעים אותה גם לכספת. */
  async adoptCloudPassword(newPassword: string): Promise<void> {
    const u = this.cur;
    if (!u) return;
    await this.cloud.signIn(u.meta.email, newPassword);
    await u.changePassword(newPassword);
    this.password = newPassword;
    this.set({ needsPasswordSync: false });
    this.connecting = this.connectCloud().catch(() => undefined);
  }

  async syncNow(): Promise<void> {
    await this.connecting;
    await this.engine?.syncNow();
  }

  async logout(): Promise<void> {
    this.engine?.stop();
    this.offEngine?.();
    this.engine = null;
    this.offEngine = null;
    if (this.cur) { await this.cur.flush(); await this.cur.lock(); }
    this.cur = null;
    this.password = '';
    setActiveDb(new LocalDb());
    try { await this.cloud.signOut(); } catch { /* אין חיבור */ }
    publishUser(null);
    this.set({ phase: 'picker', me: null, sync: { kind: 'local' }, accounts: await this.session.list(), recoveryQuestions: null, needsPasswordSync: false });
  }

  async setRecovery(questions: RecoveryQuestion[], answers: string[]): Promise<void> {
    if (!this.cur) return;
    await this.cur.setRecovery(questions, answers);
    this.set({ recoveryQuestions: this.cur.recoveryQuestions });
  }

  /** מחיקת חשבון מנותק או הסרת חשבון מקוון מהמחשב הזה. */
  async removeLocal(id: string): Promise<void> {
    await this.session.remove(id);
    this.set({ accounts: await this.session.list() });
  }

  get db(): LocalDb | null { return this.cur?.db ?? null; }

  // ---- ההתחברות כפי שהאפליקציה רואה אותה (שכבת firebase/auth) ----
  private backend(): AuthBackend {
    const need = (): Unlocked => { if (!this.cur) throw appErr('auth/user-not-found'); return this.cur; };
    const online = (): boolean => need().meta.kind === 'online';
    const requireNet = () => { if (!this.isOnline()) throw appErr('app/offline'); };
    return {
      signIn: async () => { throw appErr('auth/operation-not-allowed'); },
      signUp: async () => { throw appErr('auth/operation-not-allowed'); },
      signOut: () => this.logout(),
      updateDisplayName: async (name) => { await need().updateMeta({ displayName: name }); },
      reauthenticate: async (password) => {
        if (!(await need().verifyPassword(password))) throw appErr('auth/invalid-credential');
        if (online() && this.isOnline()) { try { await this.cloud.signIn(need().meta.email, password); } catch (e) { if (isBadCredential(e)) throw e; } }
      },
      changePassword: async (p) => {
        if (online()) { requireNet(); await this.cloud.changePassword(p); }
        await need().changePassword(p);
        this.password = p;
      },
      resetEmail: async (email) => { requireNet(); await this.cloud.resetEmail(email); },
      changeEmail: async (email) => {
        if (!online()) { await need().updateMeta({ email }); await this.session.updateIndex(need().meta); return; }
        requireNet();
        await this.cloud.changeEmail(email);
      },
      deleteAccount: async () => {
        const meta = need().meta;
        if (meta.kind === 'online') { requireNet(); await this.cloud.deleteAccount(); }
        await this.logout();
        await this.session.remove(meta.id);
        this.set({ accounts: await this.session.list() });
      },
    };
  }
}
