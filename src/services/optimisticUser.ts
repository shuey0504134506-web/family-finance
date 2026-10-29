import type { User } from 'firebase/auth';
import type { UserProfile } from '../domain/types';

/**
 * תמונת מצב של המשתמש המחובר, שנשמרת במכשיר. בפתיחה קרה (האפליקציה נסגרה לגמרי) בלי אינטרנט,
 * Firebase Auth עלול להמתין הרבה זמן לרענון החשבון מול השרת לפני שהוא מדווח מי המשתמש.
 * בזמן הזה מציגים את האפליקציה מיד מהתמונה השמורה, ואימות Firebase מחליף אותה כשהוא מסיים.
 * התמונה נמחקת ביציאה מהחשבון, ואם Firebase מדווח שאין משתמש.
 */
export interface OptimisticSnapshot {
  uid: string;
  email: string | null;
  lastSignInTime: string | null;
  creationTime: string | null;
  profile: UserProfile;
}

const KEY = 'ff.auth.snapshot';

export function readOptimistic(): OptimisticSnapshot | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<OptimisticSnapshot> | null;
    if (!raw || typeof raw.uid !== 'string' || !raw.profile || typeof raw.profile !== 'object') return null;
    return raw as OptimisticSnapshot;
  } catch {
    return null;
  }
}

export function saveOptimistic(user: User, profile: UserProfile): void {
  try {
    const snapshot: OptimisticSnapshot = {
      uid: user.uid,
      email: user.email,
      lastSignInTime: user.metadata.lastSignInTime ?? null,
      creationTime: user.metadata.creationTime ?? null,
      profile,
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // אחסון חסום: בפתיחה הבאה נחכה לאימות כרגיל
  }
}

export function clearOptimistic(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // אחסון חסום
  }
}

/** אובייקט משתמש זמני עם הפרטים שהמסכים קוראים (מזהה, מייל, זמן כניסה). פעולות אימות אמיתיות נעשות על auth.currentUser. */
export function optimisticUser(s: OptimisticSnapshot): User {
  return {
    uid: s.uid,
    email: s.email,
    emailVerified: true,
    isAnonymous: false,
    displayName: null,
    phoneNumber: null,
    photoURL: null,
    providerData: [],
    metadata: { lastSignInTime: s.lastSignInTime ?? undefined, creationTime: s.creationTime ?? undefined },
  } as unknown as User;
}
