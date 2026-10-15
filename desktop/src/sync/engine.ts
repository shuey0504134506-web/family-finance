import type { DocData, LocalDb } from '../db/localDb';
import { parentOf } from '../db/localDb';

/**
 * סנכרון בין המסד המקומי לענן. כללים:
 * 1. כתיבה מקומית שעוד לא עלתה (outbox) תמיד גוברת על מה שהענן מחזיר.
 * 2. מסמך שחסר בענן ואין עליו כתיבה ממתינה נמחק מקומית (נמחק במכשיר אחר).
 * 3. הכותב האחרון מנצח ברמת המסמך. אין מיזוג שדות.
 * חשבון אופליין אינו מקבל מנוע סנכרון בכלל.
 */
export type Target = { kind: 'doc'; path: string } | { kind: 'collection'; path: string; where?: { field: string; value: string } };
export interface Remote { path: string; data: DocData }

export interface Cloud {
  read(target: Target): Promise<Remote[]>;
  write(path: string, data: DocData): Promise<void>;
  remove(path: string): Promise<void>;
  /** האזנה בזמן אמת. מחזיר ביטול. onList מקבל את כל התוצאה הנוכחית. */
  watch(target: Target, onList: (list: Remote[]) => void, onError: (e: unknown) => void): () => void;
}

export type SyncStatus =
  | { kind: 'idle'; pending: number; lastSync: number | null }
  | { kind: 'syncing'; pending: number; lastSync: number | null }
  | { kind: 'offline'; pending: number; lastSync: number | null }
  | { kind: 'error'; pending: number; lastSync: number | null; failed: number };

/** usage/{uid} נכתב בלבד: הכללים אוסרים קריאה (allow read: if false), ולכן הוא אינו יעד למשיכה. */
export function targetsFor(uid: string): Target[] {
  const sub = ['settings', 'businessProfile', 'householdProfile', 'businesses', 'categories', 'businessTransactions', 'householdTransactions', 'attachments', 'debts', 'budgets', 'tasks', 'shoppingItems'];
  return [
    { kind: 'doc', path: `users/${uid}` },
    { kind: 'doc', path: `approvals/${uid}` },
    ...sub.map((name) => ({ kind: 'collection' as const, path: `users/${uid}/${name}` })),
    { kind: 'collection', path: 'messages', where: { field: 'uid', value: uid } },
  ];
}

/** מסלולים שהשרת רשאי לדחות לצמיתות (כללי אבטחה). אצלם כתיבה שנדחתה נזרקת ולא נתקעת בתור. */
const DROP_ON_DENIED = (path: string) => path.startsWith('approvals/') || path.startsWith('usage/');

const isPermanent = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code ?? '';
  return code === 'permission-denied' || code === 'invalid-argument' || code === 'failed-precondition' || code.endsWith('/permission-denied');
};
const isNetwork = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code ?? '';
  return code === 'unavailable' || code === 'network-request-failed' || code === 'deadline-exceeded' || code.endsWith('/unavailable') || e instanceof TypeError;
};

export class SyncEngine {
  private unsubs: (() => void)[] = [];
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private offDb: (() => void) | null = null;
  private failed = new Set<string>();
  private stopped = true;
  status: SyncStatus;
  private listeners = new Set<(s: SyncStatus) => void>();
  online = true;

  constructor(
    private readonly db: LocalDb,
    private readonly cloud: Cloud,
    private readonly uid: string,
    private lastSync: number | null,
    private readonly onSynced: (at: number) => void = () => undefined,
    private readonly pushDelayMs = 1200,
  ) {
    this.status = { kind: 'idle', pending: db.pendingPaths().length, lastSync };
  }

  onStatus(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }
  private set(kind: SyncStatus['kind']): void {
    const pending = this.db.pendingPaths().length;
    this.status = kind === 'error' ? { kind, pending, lastSync: this.lastSync, failed: this.failed.size } : ({ kind, pending, lastSync: this.lastSync } as SyncStatus);
    for (const l of [...this.listeners]) l(this.status);
  }

  start(): void {
    this.stopped = false;
    this.offDb = this.db.subscribe(() => { this.set(this.status.kind === 'syncing' ? 'syncing' : this.status.kind); if (this.db.pendingPaths().length > 0) this.schedulePush(); });
    void this.syncNow().then(() => this.watch());
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.offDb?.();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  /** נקרא כשהרשת חוזרת או נעלמת. */
  setOnline(on: boolean): void {
    this.online = on;
    if (on && !this.stopped) { void this.syncNow().then(() => { if (this.unsubs.length === 0) this.watch(); }); }
    else if (!on) this.set('offline');
  }

  private schedulePush(): void {
    if (this.timer || this.stopped || !this.online) return;
    this.timer = setTimeout(() => { this.timer = null; void this.syncNow(); }, this.pushDelayMs);
  }

  private watch(): void {
    if (this.stopped || !this.online) return;
    for (const t of targetsFor(this.uid)) {
      this.unsubs.push(this.cloud.watch(t, (list) => this.applyList(t, list), (e) => { if (isNetwork(e)) this.set('offline'); }));
    }
  }

  /** דחיפה ואז משיכה. אם כבר רץ, ירוץ שוב מיד אחרי שיסתיים. */
  syncNow(): Promise<void> {
    if (!this.online) { this.set('offline'); return Promise.resolve(); }
    if (this.running) { this.again = true; return this.running; }
    this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<void> {
    this.set('syncing');
    try {
      do {
        this.again = false;
        await this.push();
        for (const t of targetsFor(this.uid)) {
          try {
            this.applyList(t, await this.cloud.read(t));
          } catch (e) {
            // יעד שנדחה בכללי האבטחה לא יעצור את משיכת שאר הנתונים
            if (!isNetwork(e) && isPermanent(e)) continue;
            throw e;
          }
        }
      } while (this.again && !this.stopped);
      this.lastSync = Date.now();
      this.onSynced(this.lastSync);
      this.db.hydrated = true;
      this.set(this.failed.size > 0 ? 'error' : 'idle');
    } catch (e) {
      this.set(isNetwork(e) ? 'offline' : 'error');
    }
  }

  private async push(): Promise<void> {
    for (const [path, op] of this.db.pendingPaths()) {
      try {
        if (op === 'set') {
          const cur = this.db.get(path);
          if (cur) await this.cloud.write(path, cur.data);
          else { this.db.ack(path, 'set'); continue; }
        } else {
          await this.cloud.remove(path);
        }
        this.failed.delete(path);
        this.db.ack(path, op);
      } catch (e) {
        if (isNetwork(e)) throw e;
        if (isPermanent(e) && DROP_ON_DENIED(path)) { this.db.ack(path, op); continue; }
        this.failed.add(path);
      }
    }
  }

  private applyList(target: Target, list: Remote[]): void {
    const seen = new Set<string>();
    for (const r of list) { seen.add(r.path); this.db.applyRemote(r.path, r.data); }
    if (target.kind === 'doc') {
      if (!seen.has(target.path)) this.db.applyRemote(target.path, null);
      return;
    }
    for (const path of this.db.paths(`${target.path}/`)) {
      if (parentOf(path) !== target.path || seen.has(path)) continue;
      if (target.where && this.db.get(path)?.data[target.where.field] !== target.where.value) continue;
      this.db.applyRemote(path, null);
    }
  }
}
