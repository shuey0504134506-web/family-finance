import { beforeEach, describe, expect, it } from 'vitest';
import { LocalDb } from '../db/localDb';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from './firestore';
import { setActiveDb } from './registry';

const db = {} as never;
beforeEach(() => setActiveDb(new LocalDb()));

describe('firestore shim', () => {
  it('doc/collection/setDoc/getDoc/getDocs', async () => {
    const c = collection(db, 'users', 'u', 'householdTransactions');
    await setDoc(doc(c, 'a'), { date: '2026-10-01', n: 1 });
    await setDoc(doc(db, 'users', 'u', 'householdTransactions', 'b'), { date: '2026-10-02', n: 2 });
    expect((await getDoc(doc(c, 'a'))).data()).toEqual({ date: '2026-10-01', n: 1 });
    expect((await getDoc(doc(c, 'zzz'))).exists()).toBe(false);
    const q = query(c, where('date', '>=', '2026-10-02'), orderBy('date', 'desc'), limit(5));
    const snap = await getDocs(q);
    expect(snap.docs.map((d) => d.id)).toEqual(['b']);
    expect(snap.docs[0]!.ref.path).toBe('users/u/householdTransactions/b');
    expect(snap.empty).toBe(false);
  });
  it('addDoc יוצר מזהה, updateDoc ו-deleteDoc', async () => {
    const c = collection(db, 'messages');
    const ref = await addDoc(c, { uid: 'u', text: 'x' });
    expect(ref.id).toHaveLength(15);
    await updateDoc(ref, { text: 'y' });
    expect((await getDoc(ref)).data()?.text).toBe('y');
    await deleteDoc(ref);
    expect((await getDoc(ref)).exists()).toBe(false);
  });
  it('writeBatch ו-increment עם merge', async () => {
    const u = doc(db, 'users', 'u', 'usage', 'main');
    const b = writeBatch(db);
    b.set(u, { days: { d1: increment(1) } }, { merge: true });
    b.set(doc(db, 'x', '1'), { v: 1 });
    await b.commit();
    await setDoc(u, { days: { d1: increment(2) } }, { merge: true });
    expect((await getDoc(u)).data()).toEqual({ days: { d1: 3 } });
  });
  it('onSnapshot עם ובלי options מקבל עדכונים ומפסיק אחרי unsubscribe', async () => {
    const ref = doc(db, 'users', 'u');
    const seen: (boolean)[] = [];
    const off = onSnapshot(ref, { includeMetadataChanges: true }, (s) => seen.push(s.exists()));
    const seenQ: number[] = [];
    const offQ = onSnapshot(collection(db, 'users'), (s) => seenQ.push(s.size));
    await Promise.resolve();
    await setDoc(ref, { a: 1 });
    off(); offQ();
    await setDoc(doc(db, 'users', 'v'), { a: 1 });
    expect(seen).toEqual([false, true]);
    expect(seenQ).toEqual([0, 1]);
  });
  it('מעבר למסד אחר מרענן את ההאזנות', async () => {
    const seen: number[] = [];
    const off = onSnapshot(collection(db, 'users'), (s) => seen.push(s.size));
    await Promise.resolve();
    const other = new LocalDb();
    other.set('users/z', { a: 1 });
    setActiveDb(other);
    off();
    expect(seen).toEqual([0, 1]);
  });
});
