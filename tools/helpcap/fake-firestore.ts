/**
 * Firestore מדומה בזיכרון, לצילום מסכי ההדגמה בלבד (לא נכנס לאפליקציה האמיתית).
 * ראו tools/helpcap/README.md.
 */
type Data = Record<string, unknown>;
interface Ref { __kind: 'doc' | 'col'; path: string; id: string }
interface Constraint { kind: 'where' | 'orderBy' | 'limit'; field?: string; op?: string; value?: unknown; dir?: string; n?: number }
interface Query { __kind: 'query'; col: string; constraints: Constraint[] }

const store = new Map<string, Data>([['approvals/demo', { status: 'approved', createdAt: 1 }]]);
const listeners = new Set<() => void>();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const notify = () => queueMicrotask(() => listeners.forEach((l) => l()));

const join = (parent: unknown, segs: string[]): string => {
  const base = parent && typeof parent === 'object' && 'path' in (parent as Ref) ? (parent as Ref).path : '';
  return [base, ...segs].filter(Boolean).join('/');
};
export const initializeFirestore = () => ({});
export const increment = (n: number) => n;
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const collection = (parent: unknown, ...segs: string[]): Ref => {
  const path = join(parent, segs);
  return { __kind: 'col', path, id: path.split('/').pop() as string };
};
export const doc = (parent: unknown, ...segs: string[]): Ref => {
  const path = join(parent, segs);
  return { __kind: 'doc', path, id: path.split('/').pop() as string };
};
export const where = (field: string, op: string, value: unknown): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir = 'asc'): Constraint => ({ kind: 'orderBy', field, dir });
export const limit = (n: number): Constraint => ({ kind: 'limit', n });
export const query = (col: Ref, ...constraints: Constraint[]): Query => ({ __kind: 'query', col: col.path, constraints });

const meta = { hasPendingWrites: false, fromCache: false };
const docSnap = (path: string) => {
  const data = store.get(path);
  return { id: path.split('/').pop(), ref: doc(null, path), exists: () => data !== undefined, data: () => (data ? clone(data) : undefined), metadata: meta };
};
const runQuery = (q: Query | Ref) => {
  const colPath = q.__kind === 'query' ? q.col : q.path;
  const constraints = q.__kind === 'query' ? q.constraints : [];
  let rows = [...store.entries()].filter(([p]) => p.startsWith(colPath + '/') && !p.slice(colPath.length + 1).includes('/'));
  for (const c of constraints) {
    if (c.kind === 'where') {
      rows = rows.filter(([, d]) => {
        const v = d[c.field as string] as string | number;
        const t = c.value as string | number;
        switch (c.op) {
          case '>=': return v >= t;
          case '<=': return v <= t;
          case '>': return v > t;
          case '<': return v < t;
          case '==': return v === t;
          default: return true;
        }
      });
    }
  }
  const ord = constraints.find((c) => c.kind === 'orderBy');
  if (ord) {
    const f = ord.field as string;
    rows.sort(([, a], [, b]) => ((a[f] as string) < (b[f] as string) ? -1 : (a[f] as string) > (b[f] as string) ? 1 : 0) * (ord.dir === 'desc' ? -1 : 1));
  }
  const lim = constraints.find((c) => c.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const docs = rows.map(([p]) => docSnap(p));
  return { docs, empty: docs.length === 0, size: docs.length, metadata: meta, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) };
};
const snapshotOf = (target: Ref | Query) => (target.__kind === 'doc' ? docSnap(target.path) : runQuery(target));

export const getDoc = async (r: Ref) => docSnap(r.path);
export const getDocFromServer = getDoc;
export const getDocs = async (q: Ref | Query) => runQuery(q);
export const getDocsFromServer = getDocs;
export const getDocFromCache = getDoc;
export const getDocsFromCache = getDocs;

export const setDoc = async (r: Ref, data: Data, options?: { merge?: boolean }) => {
  store.set(r.path, options?.merge ? { ...(store.get(r.path) ?? {}), ...clone(data) } : clone(data));
  notify();
};
export const addDoc = async (col: Ref, data: Data) => {
  const id = `m${Date.now()}${Math.floor(Math.random() * 1000)}`;
  store.set(`${col.path}/${id}`, clone(data));
  notify();
  return { id };
};
export const updateDoc = async (r: Ref, data: Data) => {
  store.set(r.path, { ...(store.get(r.path) ?? {}), ...clone(data) });
  notify();
};
export const deleteDoc = async (r: Ref) => {
  store.delete(r.path);
  notify();
};
export const writeBatch = () => {
  const ops: Array<() => void> = [];
  const batch = {
    set: (r: Ref, data: Data) => { ops.push(() => store.set(r.path, clone(data))); return batch; },
    update: (r: Ref, data: Data) => { ops.push(() => store.set(r.path, { ...(store.get(r.path) ?? {}), ...clone(data) })); return batch; },
    delete: (r: Ref) => { ops.push(() => store.delete(r.path)); return batch; },
    commit: async () => { ops.forEach((o) => o()); notify(); },
  };
  return batch;
};
export const onSnapshot = (target: Ref | Query, ...args: unknown[]) => {
  const next = args.find((a) => typeof a === 'function') as (s: unknown) => void;
  const fire = () => next(snapshotOf(target));
  listeners.add(fire);
  queueMicrotask(fire);
  return () => { listeners.delete(fire); };
};
export type Unsubscribe = () => void;
