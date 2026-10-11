import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MAX_CUSTOM_METHODS, MAX_PAYMENT_LABEL } from '../domain/payment';
import type { TransactionType } from '../domain/types';

/** אמצעי תשלום שהמשתמש הוסיף, לכל סוג (הכנסה / הוצאה). מסמך אחד, משותף לכל המכשירים. */
export type CustomMethods = Record<TransactionType, string[]>;

export const NO_CUSTOM_METHODS: CustomMethods = { income: [], expense: [] };

const clean = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= MAX_PAYMENT_LABEL)
        .slice(0, MAX_CUSTOM_METHODS)
    : [];

export function subscribeCustomMethods(
  uid: string,
  onChange: (methods: CustomMethods) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'settings', 'paymentMethods'),
    (snapshot) => {
      const data = snapshot.data() as { income?: unknown; expense?: unknown } | undefined;
      onChange({ income: clean(data?.income), expense: clean(data?.expense) });
    },
    onError,
  );
}

export function saveCustomMethods(uid: string, methods: CustomMethods): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'settings', 'paymentMethods'), {
    income: methods.income,
    expense: methods.expense,
    updatedAt: Date.now(),
  });
}
