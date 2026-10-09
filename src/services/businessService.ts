import { collection, doc, getDocsFromServer, onSnapshot, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { buildBusinessCategories } from '../data/defaultCategories';
import { DEFAULT_BUSINESS_ID, businessIdOf, type Business } from '../domain/spaces';
import { newId } from './ids';

/** כל העסקים של המשתמש (מעטים), ממוינים לפי סדר התצוגה. */
export function subscribeBusinesses(
  uid: string,
  onChange: (businesses: Business[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'businesses'),
    (snapshot) => {
      const businesses = snapshot.docs.map((d) => ({ ...(d.data() as Business), id: d.id }));
      businesses.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
      onChange(businesses);
    },
    onError,
  );
}

/** שמירת עסק (שינוי שם, או יצירת מסמך לעסק הראשון הישן). */
export function saveBusiness(uid: string, business: Business): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'businesses', business.id), {
    id: business.id,
    name: business.name.trim(),
    sortOrder: business.sortOrder,
    createdAt: business.createdAt,
    updatedAt: Date.now(),
  });
}

/**
 * מוסיף עסק חדש יחד עם קטגוריות ברירת המחדל שלו, בכתיבה אחת (הכול או כלום).
 * לכל עסק קטגוריות ותקציב משלו.
 */
export function addBusiness(uid: string, name: string, sortOrder: number): { id: string; saved: Promise<void> } {
  const now = Date.now();
  const id = newId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'businesses', id), {
    id,
    name: name.trim(),
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });
  for (const category of buildBusinessCategories(now, id)) {
    batch.set(doc(db, 'users', uid, 'categories', category.id), category);
  }
  return { id, saved: batch.commit() };
}

/**
 * מוחק עסק לגמרי: הרשומה שלו וכל מה ששייך לו (פעולות, קטגוריות, תקציבים, משימות). אין שחזור.
 * דורש חיבור, כי המחיקה נעשית לפי מה שקיים בשרת. בטוח להרצה חוזרת.
 * העסק הראשון הישן נבנה גם משם העסק בפרופיל, ולכן מנקים גם אותו.
 */
export async function deleteBusinessAndData(uid: string, businessId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw Object.assign(new Error('offline'), { code: 'app/offline' });
  }
  const refs = [] as ReturnType<typeof doc>[];
  for (const name of ['businessTransactions', 'categories', 'budgets', 'tasks', 'shoppingItems'] as const) {
    const snapshot = await getDocsFromServer(collection(db, 'users', uid, name));
    for (const d of snapshot.docs) {
      const data = d.data() as { scope?: string; businessId?: string };
      const isBusinessItem = name === 'businessTransactions' || data.scope === 'business';
      if (isBusinessItem && businessIdOf(data) === businessId) refs.push(d.ref);
    }
  }
  refs.push(doc(db, 'users', uid, 'businesses', businessId));
  if (businessId === DEFAULT_BUSINESS_ID) refs.push(doc(db, 'users', uid, 'businessProfile', 'main'));
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  if (businessId === DEFAULT_BUSINESS_ID) {
    await updateDoc(doc(db, 'users', uid), { businessName: '', updatedAt: Date.now() });
  }
}

// ---------- שם משק הבית ----------

export function subscribeHouseholdName(
  uid: string,
  onChange: (name: string | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'householdProfile', 'main'),
    (snapshot) => {
      const name = snapshot.exists() ? (snapshot.data() as { name?: unknown }).name : null;
      onChange(typeof name === 'string' && name.trim() ? name : null);
    },
    onError,
  );
}

export function saveHouseholdName(uid: string, name: string, createdAt: number): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'householdProfile', 'main'), {
    name: name.trim(),
    createdAt,
    updatedAt: Date.now(),
  });
}
