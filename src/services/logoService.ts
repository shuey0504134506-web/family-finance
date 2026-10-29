import { deleteDoc, doc, setDoc, type Unsubscribe } from 'firebase/firestore';
import { onSnapshot } from '../firebase/cacheFirst';
import { db } from '../firebase/config';
import { isLogoData } from '../domain/logo';

/**
 * לוגו עסק. נשמר פעמיים: במכשיר (localStorage, שורד סגירת דפדפן) ובחשבון
 * (users/{uid}/settings/logo_{businessId}, משותף לכל המכשירים). אם השמירה בחשבון נכשלת
 * (בלי חיבור, או שכללי האבטחה בשרת עוד לא עודכנו) הלוגו ממשיך להופיע מהמכשיר.
 */
const localKey = (uid: string, businessId: string) => `ff.logo.v1.${uid}.${businessId}`;
const docRef = (uid: string, businessId: string) => doc(db, 'users', uid, 'settings', `logo_${businessId}`);

export function readLocalLogo(uid: string, businessId: string): string | null {
  try {
    const value = localStorage.getItem(localKey(uid, businessId));
    return isLogoData(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLocalLogo(uid: string, businessId: string, data: string | null): void {
  try {
    if (data) localStorage.setItem(localKey(uid, businessId), data);
    else localStorage.removeItem(localKey(uid, businessId));
  } catch {
    // ללא אחסון מקומי: הלוגו נשמר בחשבון בלבד.
  }
}

/** שומר לוגו (או מסיר, כש-data הוא null). המכשיר נשמר מיד, והחשבון כשאפשר. */
export function saveLogo(uid: string, businessId: string, data: string | null): Promise<void> {
  writeLocalLogo(uid, businessId, data);
  if (!data) return deleteDoc(docRef(uid, businessId));
  return setDoc(docRef(uid, businessId), { data, updatedAt: Date.now() });
}

/** מאזין ללוגו בחשבון. כשיש לוגו הוא נשמר גם במכשיר. */
export function subscribeLogo(uid: string, businessId: string, onChange: (data: string | null) => void): Unsubscribe {
  return onSnapshot(
    docRef(uid, businessId),
    (snapshot) => {
      const data = (snapshot.data() as { data?: unknown } | undefined)?.data;
      if (isLogoData(data)) {
        writeLocalLogo(uid, businessId, data);
        onChange(data);
      }
    },
    () => undefined,
  );
}
