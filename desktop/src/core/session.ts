import { LocalDb, type DbState } from '../db/localDb';
import type { RecoveryQuestion } from './recovery';
import {
  changeVaultPassword, createVault, DEFAULT_ITERATIONS, recoverVaultKey, sealVault, setVaultRecovery, unlockVault, type VaultFile,
} from './vault';

export interface AccountMeta {
  /** מזהה הקובץ. בחשבון מקוון זה ה-uid של Firebase, ובאופליין local-<uuid>. */
  id: string;
  uid: string;
  email: string;
  displayName: string;
  kind: 'online' | 'offline';
}

export interface Storage {
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

interface Payload { meta: AccountMeta; db: DbState; lastSync: number | null }

const INDEX = 'accounts.json';
const vaultName = (id: string) => `vault-${id}.json`;

export class WrongPassword extends Error {}

export class Unlocked {
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  lastSync: number | null;

  constructor(
    readonly meta: AccountMeta,
    readonly db: LocalDb,
    private file: VaultFile,
    private dataKey: Uint8Array,
    private readonly storage: Storage,
    lastSync: number | null,
    private readonly debounceMs: number,
  ) {
    this.lastSync = lastSync;
    db.onChange = () => this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.debounceMs);
  }

  /** כותב את כל המצב לקובץ (מוצפן, בכתיבה אטומית). */
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.chain = this.chain.then(async () => {
      const payload: Payload = { meta: this.meta, db: this.db.state, lastSync: this.lastSync };
      this.file = await sealVault(this.file, this.dataKey, JSON.stringify(payload));
      await this.storage.write(vaultName(this.meta.id), JSON.stringify(this.file));
    });
    return this.chain;
  }

  async changePassword(newPassword: string): Promise<void> {
    this.file = await changeVaultPassword(this.file, this.dataKey, newPassword);
    await this.flush();
  }

  async setRecovery(questions: readonly RecoveryQuestion[], answers: readonly string[]): Promise<void> {
    this.file = await setVaultRecovery(this.file, this.dataKey, questions, answers);
    await this.flush();
  }

  get recoveryQuestions(): RecoveryQuestion[] | null {
    return this.file.recovery?.questions ?? null;
  }

  async lock(): Promise<void> {
    await this.flush();
    this.db.onChange = null;
    this.dataKey.fill(0);
  }
}

export class Session {
  constructor(private readonly storage: Storage, private readonly opts: { iterations?: number; debounceMs?: number } = {}) {}

  async list(): Promise<AccountMeta[]> {
    const raw = await this.storage.read(INDEX);
    return raw ? (JSON.parse(raw) as AccountMeta[]) : [];
  }

  private async addToIndex(meta: AccountMeta): Promise<void> {
    const rest = (await this.list()).filter((m) => m.id !== meta.id);
    await this.storage.write(INDEX, JSON.stringify([...rest, meta]));
  }

  private open(meta: AccountMeta, state: DbState | undefined, file: VaultFile, dataKey: Uint8Array, lastSync: number | null): Unlocked {
    const db = new LocalDb(state, meta.kind === 'online');
    return new Unlocked(meta, db, file, dataKey, this.storage, lastSync, this.opts.debounceMs ?? 400);
  }

  /** חשבון מנותק: לא מסונכרן לעולם. מאשרים אותו מקומית כדי שמסך האישור לא יחסום. */
  async createOffline(input: { email: string; displayName: string }, password: string): Promise<Unlocked> {
    const id = `local-${crypto.randomUUID()}`;
    const meta: AccountMeta = { id, uid: id, email: input.email, displayName: input.displayName, kind: 'offline' };
    const state: DbState = { docs: { [`approvals/${id}`]: { status: 'approved', createdAt: Date.now() } }, outbox: {} };
    return this.create(meta, state, password);
  }

  /** נקרא אחרי כניסה מוצלחת מול הענן בפעם הראשונה במחשב הזה. */
  createOnline(info: { uid: string; email: string; displayName: string }, password: string): Promise<Unlocked> {
    return this.create({ id: info.uid, uid: info.uid, email: info.email, displayName: info.displayName, kind: 'online' }, { docs: {}, outbox: {} }, password);
  }

  private async create(meta: AccountMeta, state: DbState, password: string): Promise<Unlocked> {
    const payload: Payload = { meta, db: state, lastSync: null };
    const { file, dataKey } = await createVault(password, JSON.stringify(payload), this.opts.iterations ?? DEFAULT_ITERATIONS);
    await this.storage.write(vaultName(meta.id), JSON.stringify(file));
    await this.addToIndex(meta);
    return this.open(meta, state, file, dataKey, null);
  }

  private async load(id: string): Promise<VaultFile> {
    const raw = await this.storage.read(vaultName(id));
    if (!raw) throw new Error('vault-missing');
    return JSON.parse(raw) as VaultFile;
  }

  async unlock(id: string, password: string): Promise<Unlocked> {
    const file = await this.load(id);
    let r;
    try { r = await unlockVault(file, password); } catch { throw new WrongPassword(); }
    const p = JSON.parse(r.plaintext) as Payload;
    return this.open(p.meta, p.db, file, r.dataKey, p.lastSync);
  }

  async recoveryQuestions(id: string): Promise<RecoveryQuestion[] | null> {
    return (await this.load(id)).recovery?.questions ?? null;
  }

  /** שחזור: שלוש תשובות נכונות פותחות את החשבון וקובעות סיסמה חדשה. */
  async recover(id: string, answers: readonly string[], newPassword: string): Promise<Unlocked> {
    const file = await this.load(id);
    let r;
    try { r = await recoverVaultKey(file, answers); } catch { throw new WrongPassword(); }
    const reset = await changeVaultPassword(file, r.dataKey, newPassword);
    const p = JSON.parse(r.plaintext) as Payload;
    await this.storage.write(vaultName(id), JSON.stringify(reset));
    return this.open(p.meta, p.db, reset, r.dataKey, p.lastSync);
  }

  /** מחיקת חשבון מקומי מהמחשב הזה (הקובץ והרשומה באינדקס). */
  async remove(id: string): Promise<void> {
    await this.storage.remove(vaultName(id));
    await this.storage.write(INDEX, JSON.stringify((await this.list()).filter((m) => m.id !== id)));
  }
}
