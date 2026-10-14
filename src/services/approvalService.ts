import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * אישור חשבון על ידי המנהל. approvals/{uid} = {status: 'pending' | 'approved' | 'blocked'}.
 * המשתמש יכול רק ליצור בקשה ממתינה לעצמו; אישור וחסימה נכתבים בשרת בלבד (כללי Firestore).
 */
export type ApprovalState = 'approved' | 'pending' | 'blocked' | 'none';

export interface PaymentNotice {
  dueAt: number;
  amountText: string;
  url: string;
  message: string;
}

export interface AdminNotice {
  id: string;
  title: string;
  text: string;
}

export interface ApprovalSnapshot {
  state: ApprovalState;
  payment: PaymentNotice | null;
  notice: AdminNotice | null;
}

function parseNotice(raw: unknown): AdminNotice | null {
  const n = raw as Partial<AdminNotice> | null | undefined;
  if (!n || typeof n.id !== 'string' || typeof n.text !== 'string' || !n.text) return null;
  return { id: n.id, title: typeof n.title === 'string' ? n.title : '', text: n.text };
}

function parsePayment(raw: unknown): PaymentNotice | null {
  const p = raw as Partial<PaymentNotice> | null | undefined;
  if (!p || typeof p.dueAt !== 'number') return null;
  return {
    dueAt: p.dueAt,
    amountText: typeof p.amountText === 'string' ? p.amountText : '',
    url: typeof p.url === 'string' ? p.url : '',
    message: typeof p.message === 'string' ? p.message : '',
  };
}

function parse(status: unknown): ApprovalState {
  return status === 'approved' || status === 'pending' || status === 'blocked' ? status : 'none';
}

/**
 * יוצר בקשת אישור אם אין. לא נכשל: בכללים הישנים (לפני פרסום כללי האישור) הכתיבה נדחית,
 * וזה תקין, כי אז אין עדיין דרישת אישור.
 */
export async function ensureApprovalRequest(uid: string): Promise<void> {
  try {
    const ref = doc(db, 'approvals', uid);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, { status: 'pending', createdAt: Date.now() });
  } catch {
    // ראו את ההערה למעלה
  }
}

/**
 * מאזין למצב האישור. שגיאת הרשאה (כללים ישנים, בלי אישור חשבונות) או כל שגיאה אחרת מדווחות כ-'unavailable',
 * וה-UI ממשיך כרגיל: ההגנה האמיתית היא בכללי השרת ולא כאן.
 */
export function subscribeApproval(
  uid: string,
  onState: (snapshot: ApprovalSnapshot) => void,
  onUnavailable: () => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'approvals', uid),
    (snap) => {
      // בלי רשת, מסמך שלא נשמר במכשיר עדיין נראה "לא קיים". זה לא אומר שהחשבון ממתין, ולכן לא מחליטים על סמך זה.
      if (snap.metadata.fromCache && !snap.exists()) {
        onUnavailable();
        return;
      }
      onState({
        state: snap.exists() ? parse(snap.data().status) : 'none',
        payment: snap.exists() ? parsePayment(snap.data().payment) : null,
        notice: snap.exists() ? parseNotice(snap.data().notice) : null,
      });
    },
    () => onUnavailable(),
  );
}
