import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MAX_HIDDEN_DEBT_CATEGORIES } from '../domain/debt';

/** קטגוריות חובות שהמשתמש הסיר מהרשימה. חובות קיימים נשארים עם הקטגוריה שלהם. מסמך אחד לכל המכשירים. */
const clean = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= 60)
        .slice(0, MAX_HIDDEN_DEBT_CATEGORIES)
    : [];

export function subscribeHiddenDebtCategories(
  uid: string,
  onChange: (hidden: string[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'settings', 'debtCategories'),
    (snapshot) => onChange(clean((snapshot.data() as { hidden?: unknown } | undefined)?.hidden)),
    onError,
  );
}

export function saveHiddenDebtCategories(uid: string, hidden: readonly string[]): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'settings', 'debtCategories'), {
    hidden: hidden.slice(0, MAX_HIDDEN_DEBT_CATEGORIES),
    updatedAt: Date.now(),
  });
}
