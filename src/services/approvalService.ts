import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * אישור חשבון על ידי המנהל. approvals/{uid} = {status: 'pending' | 'approved' | 'blocked'}.
 * המשתמש יכול רק ליצור בקשה ממתינה לעצמו; אישור וחסימה נכתבים בשרת בלבד (כללי Firestore).
 */
export type ApprovalState = 'approved' | 'pending' | 'blocked' | 'none';

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
  onState: (state: ApprovalState) => void,
  onUnavailable: () => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'approvals', uid),
    (snap) => onState(snap.exists() ? parse(snap.data().status) : 'none'),
    () => onUnavailable(),
  );
}
