/* eslint-disable @typescript-eslint/no-unused-vars -- חתימות התחליפים משקפות במכוון את חתימות Firebase, כולל פרמטרים שאינם בשימוש */
/**
 * תחליף מקומי ל-firebase/firestore. האפליקציה המקורית נטענת כמות שהיא (קריאה בלבד),
 * ו-Vite מפנה אליה את הייבוא של firebase/firestore לכאן. הכל נקרא ונכתב למסד המקומי.
 */
import { IncrementValue, parentOf, idOf, type DocEntry, type QuerySpec, type Where } from '../db/localDb';
import { activeDb, onDbSwap } from './registry';

export type Unsubscribe = () => void;
export interface Firestore { readonly type: 'firestore' }
export interface DocumentReference { readonly type: 'document'; readonly path: string; readonly id: string; readonly parent: CollectionReference }
export interface CollectionReference { readonly type: 'collection'; readonly path: string; readonly id: string }
export interface Query { readonly type: 'query'; readonly spec: QuerySpec }
type Ref = CollectionReference | Query;

const specOf = (r: Ref): QuerySpec => (r.type === 'collection' ? { collection: r.path, wheres: [], orders: [] } : r.spec);

export function initializeFirestore(..._args: unknown[]): Firestore { return { type: 'firestore' }; }
export function getFirestore(..._args: unknown[]): Firestore { return { type: 'firestore' }; }
export const persistentLocalCache = (..._args: unknown[]): object => ({});
export const persistentMultipleTabManager = (..._args: unknown[]): object => ({});

const join = (segs: string[]): string => segs.filter(Boolean).join('/');

export function collection(_db: Firestore | DocumentReference, ...segs: string[]): CollectionReference {
  const path = join(segs);
  return { type: 'collection', path, id: idOf(path) };
}

export function doc(base: Firestore | CollectionReference, ...segs: string[]): DocumentReference {
  const path = base.type === 'collection' ? join([base.path, ...(segs.length ? segs : [newId()])]) : join(segs);
  const parentPath = parentOf(path);
  return { type: 'document', path, id: idOf(path), parent: { type: 'collection', path: parentPath, id: idOf(parentPath) } };
}

function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(15));
  return Array.from(b, (x) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[x % 62]).join('');
}

// ---- שאילתות ----
type Constraint = { kind: 'where'; w: Where } | { kind: 'order'; field: string; dir: 'asc' | 'desc' } | { kind: 'limit'; n: number };
export const where = (field: string, op: Where['op'], value: unknown): Constraint => ({ kind: 'where', w: { field, op, value } });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({ kind: 'order', field, dir });
export const limit = (n: number): Constraint => ({ kind: 'limit', n });
export function query(base: Ref, ...cs: Constraint[]): Query {
  const spec = structuredClone(specOf(base));
  for (const c of cs) {
    if (c.kind === 'where') spec.wheres.push(c.w);
    else if (c.kind === 'order') spec.orders.push({ field: c.field, dir: c.dir });
    else spec.max = c.n;
  }
  return { type: 'query', spec };
}

export const increment = (n: number): IncrementValue => new IncrementValue(n);

// ---- תמונות מצב ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocumentData = Record<string, any>;
export class DocumentSnapshot {
  constructor(readonly ref: DocumentReference, protected readonly entry: DocEntry | null) {}
  get id(): string { return this.ref.id; }
  exists(): this is QueryDocumentSnapshot { return this.entry !== null; }
  data(): DocumentData | undefined { return this.entry?.data; }
  get metadata(): { fromCache: boolean; hasPendingWrites: boolean } {
    return { fromCache: !activeDb().hydrated, hasPendingWrites: this.entry?.pending ?? false };
  }
}
export class QueryDocumentSnapshot extends DocumentSnapshot {
  override data(): DocumentData { return this.entry!.data; }
}
export class QuerySnapshot {
  readonly docs: QueryDocumentSnapshot[];
  constructor(entries: DocEntry[]) { this.docs = entries.map((e) => new QueryDocumentSnapshot(doc({ type: 'firestore' }, e.path), e)); }
  get size(): number { return this.docs.length; }
  get empty(): boolean { return this.docs.length === 0; }
  get metadata(): { fromCache: boolean; hasPendingWrites: boolean } {
    return { fromCache: !activeDb().hydrated, hasPendingWrites: this.docs.some((d) => d.metadata.hasPendingWrites) };
  }
  forEach(fn: (d: QueryDocumentSnapshot) => void): void { this.docs.forEach(fn); }
}

const snapDoc = (ref: DocumentReference) => new DocumentSnapshot(ref, activeDb().get(ref.path));
const snapQuery = (r: Ref) => new QuerySnapshot(activeDb().list(specOf(r)));

export const getDoc = async (ref: DocumentReference) => snapDoc(ref);
export const getDocFromServer = getDoc;
export const getDocs = async (r: Ref) => snapQuery(r);
export const getDocsFromServer = getDocs;

export interface SnapshotOptions { includeMetadataChanges?: boolean }
export function onSnapshot(r: DocumentReference, next: (s: DocumentSnapshot) => void, error?: (e: Error) => void): Unsubscribe;
export function onSnapshot(r: DocumentReference, opts: SnapshotOptions, next: (s: DocumentSnapshot) => void, error?: (e: Error) => void): Unsubscribe;
export function onSnapshot(r: Ref, next: (s: QuerySnapshot) => void, error?: (e: Error) => void): Unsubscribe;
export function onSnapshot(r: Ref, opts: SnapshotOptions, next: (s: QuerySnapshot) => void, error?: (e: Error) => void): Unsubscribe;
export function onSnapshot(r: DocumentReference | Ref, ...rest: unknown[]): Unsubscribe {
  const hasOpts = typeof rest[0] !== 'function';
  const next = (hasOpts ? rest[1] : rest[0]) as (s: unknown) => void;
  const error = (hasOpts ? rest[2] : rest[1]) as ((e: Error) => void) | undefined;
  const emit = (): void => {
    try {
      next(r.type === 'document' ? snapDoc(r) : snapQuery(r));
    } catch (e) {
      error?.(e as Error);
    }
  };
  let off = activeDb().subscribe(emit);
  const offSwap = onDbSwap(() => { off(); off = activeDb().subscribe(emit); emit(); });
  queueMicrotask(emit);
  return () => { off(); offSwap(); };
}

// ---- כתיבה ----
export async function setDoc(ref: DocumentReference, data: object, opts?: { merge?: boolean }): Promise<void> {
  activeDb().set(ref.path, data as Record<string, unknown>, opts?.merge === true);
}
export async function addDoc(ref: CollectionReference, data: object): Promise<DocumentReference> {
  const d = doc(ref);
  activeDb().set(d.path, data as Record<string, unknown>);
  return d;
}
export async function updateDoc(ref: DocumentReference, data: object): Promise<void> {
  activeDb().update(ref.path, data as Record<string, unknown>);
}
export async function deleteDoc(ref: DocumentReference): Promise<void> {
  activeDb().delete(ref.path);
}

export function writeBatch(_db?: Firestore) {
  const ops: (() => void)[] = [];
  const api = {
    set(ref: DocumentReference, data: object, opts?: { merge?: boolean }) { ops.push(() => activeDb().set(ref.path, data as Record<string, unknown>, opts?.merge === true)); return api; },
    update(ref: DocumentReference, data: object) { ops.push(() => activeDb().update(ref.path, data as Record<string, unknown>)); return api; },
    delete(ref: DocumentReference) { ops.push(() => activeDb().delete(ref.path)); return api; },
    async commit() { activeDb().batch(ops); },
  };
  return api;
}
