/**
 * מסד מסמכים מקומי בזיכרון, בצורה של Firestore: נתיבים כמו users/<uid>/householdTransactions/<id>.
 * כל המצב ניתן לסריאליזציה ל-JSON (state), ושינויים מדווחים דרך onChange כדי שהמארח ישמור לקובץ.
 * outbox: רשימת נתיבים שנכתבו או נמחקו מקומית ועוד לא סונכרנו לענן (רק בחשבון מסונכרן).
 */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type DocData = { [k: string]: Json };

export class IncrementValue {
  constructor(readonly by: number) {}
}

export interface DbState {
  docs: Record<string, DocData>;
  outbox: Record<string, 'set' | 'delete'>;
}

export type Where = { field: string; op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'; value: unknown };
export interface QuerySpec {
  collection: string;
  wheres: Where[];
  orders: { field: string; dir: 'asc' | 'desc' }[];
  max?: number;
}
export interface DocEntry {
  path: string;
  id: string;
  data: DocData;
  pending: boolean;
}

type Listener = () => void;

export const parentOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));
export const idOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof IncrementValue);
}

function resolve(existing: unknown, incoming: unknown): Json | undefined {
  if (incoming === undefined) return undefined;
  if (incoming instanceof IncrementValue) return (typeof existing === 'number' ? existing : 0) + incoming.by;
  if (isPlain(incoming)) {
    const out: DocData = {};
    for (const [k, v] of Object.entries(incoming)) {
      const r = resolve(undefined, v);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return incoming as Json;
}

function mergeInto(target: DocData, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isPlain(v) && isPlain(target[k])) {
      mergeInto(target[k] as DocData, v);
    } else {
      const r = resolve(target[k], v);
      if (r !== undefined) target[k] = r;
    }
  }
}

function setPath(target: DocData, dotted: string, value: unknown): void {
  const parts = dotted.split('.');
  let node = target;
  for (const p of parts.slice(0, -1)) {
    if (!isPlain(node[p])) node[p] = {};
    node = node[p] as DocData;
  }
  const last = parts[parts.length - 1]!;
  const r = resolve(node[last], value);
  if (r === undefined) delete node[last];
  else node[last] = r;
}

export function getField(data: DocData, field: string): unknown {
  let node: unknown = data;
  for (const p of field.split('.')) {
    if (!isPlain(node)) return undefined;
    node = node[p];
  }
  return node;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matches(data: DocData, w: Where): boolean {
  const v = getField(data, w.field);
  switch (w.op) {
    case '==': return v === w.value;
    case '!=': return v !== w.value;
    case '<': return v !== undefined && v !== null && compare(v, w.value) < 0;
    case '<=': return v !== undefined && v !== null && compare(v, w.value) <= 0;
    case '>': return v !== undefined && v !== null && compare(v, w.value) > 0;
    case '>=': return v !== undefined && v !== null && compare(v, w.value) >= 0;
    case 'in': return Array.isArray(w.value) && w.value.includes(v);
    case 'array-contains': return Array.isArray(v) && v.includes(w.value);
  }
}

export class LocalDb {
  private docs = new Map<string, DocData>();
  private outbox = new Map<string, 'set' | 'delete'>();
  private listeners = new Set<Listener>();
  /** onChange נקרא אחרי כל שינוי מקומי או מרוחק, כדי לשמור לקובץ. */
  onChange: (() => void) | null = null;
  /** false עד שהמשיכה הראשונה מהענן הסתיימה (חשבון מקוון חדש במחשב). עד אז אסור להסיק שמסמך "חסר". */
  hydrated = true;

  constructor(state?: DbState, private readonly trackOutbox = false) {
    if (state) {
      for (const [p, d] of Object.entries(state.docs)) this.docs.set(p, d);
      for (const [p, o] of Object.entries(state.outbox ?? {})) this.outbox.set(p, o);
    }
  }

  get state(): DbState {
    return { docs: Object.fromEntries(this.docs), outbox: Object.fromEntries(this.outbox) };
  }

  get syncing(): boolean {
    return this.trackOutbox;
  }

  // ---- קריאה ----
  get(path: string): DocEntry | null {
    const data = this.docs.get(path);
    return data ? this.entry(path, data) : null;
  }

  private entry(path: string, data: DocData): DocEntry {
    return { path, id: idOf(path), data: structuredClone(data), pending: this.outbox.has(path) };
  }

  list(spec: QuerySpec): DocEntry[] {
    let rows: DocEntry[] = [];
    for (const [path, data] of this.docs) {
      if (parentOf(path) !== spec.collection) continue;
      if (!spec.wheres.every((w) => matches(data, w))) continue;
      rows.push(this.entry(path, data));
    }
    // Firestore מחזיר רק מסמכים שיש להם את שדה המיון
    rows = rows.filter((r) => spec.orders.every((o) => getField(r.data, o.field) !== undefined));
    rows.sort((a, b) => {
      for (const o of spec.orders) {
        const c = compare(getField(a.data, o.field), getField(b.data, o.field));
        if (c !== 0) return o.dir === 'desc' ? -c : c;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return spec.max === undefined ? rows : rows.slice(0, spec.max);
  }

  // ---- כתיבה (מקומית) ----
  set(path: string, data: Record<string, unknown>, merge = false): void {
    const base: DocData = merge && this.docs.has(path) ? structuredClone(this.docs.get(path)!) : {};
    mergeInto(base, data);
    this.docs.set(path, base);
    this.mark(path, 'set');
    this.touched();
  }

  update(path: string, patch: Record<string, unknown>): void {
    const cur = this.docs.get(path);
    if (!cur) throw Object.assign(new Error('not-found'), { code: 'not-found' });
    const next = structuredClone(cur);
    for (const [k, v] of Object.entries(patch)) setPath(next, k, v);
    this.docs.set(path, next);
    this.mark(path, 'set');
    this.touched();
  }

  delete(path: string): void {
    if (!this.docs.has(path)) return;
    this.docs.delete(path);
    this.mark(path, 'delete');
    this.touched();
  }

  /** כמה פעולות כתיבה כאחת (writeBatch): מדווח פעם אחת ורק אם הצליחו כולן. */
  batch(ops: (() => void)[]): void {
    const snapshot = this.state;
    try {
      this.silent = true;
      for (const op of ops) op();
    } catch (e) {
      this.docs = new Map(Object.entries(snapshot.docs));
      this.outbox = new Map(Object.entries(snapshot.outbox));
      throw e;
    } finally {
      this.silent = false;
    }
    this.touched();
  }
  private silent = false;

  private mark(path: string, op: 'set' | 'delete'): void {
    if (this.trackOutbox) this.outbox.set(path, op);
  }

  // ---- יישום שינויים מהענן (בלי לסמן כממתין) ----
  applyRemote(path: string, data: DocData | null): void {
    if (this.outbox.has(path)) return; // שינוי מקומי שעוד לא עלה גובר
    if (data === null) this.docs.delete(path);
    else this.docs.set(path, data);
    this.touched();
  }

  /** נקרא אחרי שהענן אישר כתיבה: מסיר מהתור רק אם לא נכתב שוב בינתיים. */
  ack(path: string, op: 'set' | 'delete'): void {
    if (this.outbox.get(path) === op) {
      this.outbox.delete(path);
      this.touched();
    }
  }

  pendingPaths(): [string, 'set' | 'delete'][] {
    return [...this.outbox];
  }

  /** מוחק את כל המסמכים בתת-עץ (למשל איפוס חשבון). */
  paths(prefix: string): string[] {
    return [...this.docs.keys()].filter((p) => p.startsWith(prefix));
  }

  // ---- האזנה ----
  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private touched(): void {
    if (this.silent) return;
    for (const l of [...this.listeners]) l();
    this.onChange?.();
  }
}
