import { DEFAULT_ANNUAL_MODE, isAnnualMode } from '../domain/annual';
import { DEFAULT_CURRENCY, isCurrencyCode } from '../domain/currency';
import { doc, onSnapshot, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { buildBusinessCategories, buildDefaultCategories } from '../data/defaultCategories';
import { DEFAULT_BUSINESS_ID } from '../domain/spaces';
import {
  DEFAULT_SETTINGS,
  type AccountMode,
  type UserProfile,
  type UserSettings,
} from '../domain/types';

export interface NewAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  accountMode: AccountMode;
  /** עסקים נוספים (מעבר לראשון), בשמות שהוזנו. */
  extraBusinessNames?: string[];
  /** שם משק הבית. ריק = "משק הבית של <שם> <משפחה>". */
  householdName?: string;
}

/**
 * יוצר את כל רשומות החשבון בכתיבה אחת אטומית (הכול או כלום):
 * פרופיל משתמש, הגדרות, פרופיל עסק, פרופיל משק בית וקטגוריות ברירת מחדל.
 * בטוחה להרצה חוזרת: המזהים קבועים, ולכן אין כפילויות.
 */
export async function createUserRecords(uid: string, input: NewAccountInput): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', uid);

  batch.set(userRef, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    businessName: input.businessName.trim(),
    accountMode: input.accountMode,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(doc(db, 'users', uid, 'settings', 'main'), { ...DEFAULT_SETTINGS, updatedAt: now });
  batch.set(doc(db, 'users', uid, 'businessProfile', 'main'), {
    name: input.businessName.trim(),
    createdAt: now,
    updatedAt: now,
  });
  batch.set(doc(db, 'users', uid, 'householdProfile', 'main'), {
    name: input.householdName?.trim() || `משק הבית של ${input.firstName.trim()} ${input.lastName.trim()}`,
    createdAt: now,
    updatedAt: now,
  });
  for (const category of buildDefaultCategories(now)) {
    batch.set(doc(db, 'users', uid, 'categories', category.id), category);
  }

  // העסק הראשון נשמר גם כרשומת עסק (מזהה main), ועסקים נוספים מקבלים מזהה קבוע לפי מיקומם,
  // כך שניסיון חוזר של הרשמה שנקטעה אינו יוצר עסקים כפולים.
  const businessNames = [input.businessName, ...(input.extraBusinessNames ?? [])]
    .map((name) => name.trim())
    .filter((name, index) => index === 0 || name.length > 0);
  businessNames.forEach((name, index) => {
    if (index === 0 && !name) return;
    const id = index === 0 ? DEFAULT_BUSINESS_ID : `b${index + 1}`;
    batch.set(doc(db, 'users', uid, 'businesses', id), {
      id,
      name,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    });
    if (index > 0) {
      for (const category of buildBusinessCategories(now, id)) {
        batch.set(doc(db, 'users', uid, 'categories', category.id), category);
      }
    }
  });

  await batch.commit();
}

export type ProfileSnapshot =
  | { kind: 'found'; profile: UserProfile }
  /** המסמך לא קיים בשרת (אימות מול השרת, לא מול המטמון) */
  | { kind: 'missing' }
  /** לא ידוע: אין נתונים במטמון ואין חיבור לשרת. אסור להניח שהחשבון חסר. */
  | { kind: 'unknown' };

/**
 * מאזין לפרופיל המשתמש. מבדיל בין "אין מסמך" לבין "אין חיבור ואין מטמון",
 * כדי שמשתמש קיים בלי אינטרנט לא יקבל בטעות מסך "השלמת הגדרת חשבון".
 */
export function subscribeUserProfile(
  uid: string,
  onChange: (snapshot: ProfileSnapshot) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.exists()) {
        onChange({ kind: 'found', profile: snapshot.data() as UserProfile });
      } else if (snapshot.metadata.fromCache) {
        onChange({ kind: 'unknown' });
      } else {
        onChange({ kind: 'missing' });
      }
    },
    onError,
  );
}

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    currency: isCurrencyCode(settings.currency) ? settings.currency : DEFAULT_CURRENCY,
    annualMode: isAnnualMode(settings.annualMode) ? settings.annualMode : DEFAULT_ANNUAL_MODE,
  };
}

/** הגדרות המשתמש. אם עדיין אין מסמך, מחזיר את ברירות המחדל. */
export function subscribeSettings(
  uid: string,
  onChange: (settings: UserSettings) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'settings', 'main'),
    (snapshot) => {
      onChange(
        snapshot.exists()
          ? normalizeSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<UserSettings>) })
          : DEFAULT_SETTINGS,
      );
    },
    onError,
  );
}
