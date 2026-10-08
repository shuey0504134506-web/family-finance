import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { buildBackup, type BackupFile, type ExportTransaction } from '../domain/export';
import type { RestorePlan } from '../domain/restore';
import type { AccountMode, Category, Transaction, UserSettings } from '../domain/types';
import { forgetDeviceUser } from './deviceUser';

/** שגיאה עם קוד, כדי ש-describeError יציג הודעה בעברית. */
function appError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function requireOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw appError('app/offline');
}

async function reauthenticate(user: User, password: string): Promise<void> {
  if (!user.email) throw appError('auth/invalid-credential');
  if (!password) throw appError('auth/missing-password');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

/** אימות סיסמת החשבון מול השרת (לפתיחת נעילת האפליקציה). */
export async function verifyAccountPassword(user: User, password: string): Promise<void> {
  requireOnline();
  await reauthenticate(user, password);
}

// ---------- הגדרות ופרופיל ----------

export function saveSettings(uid: string, settings: Omit<UserSettings, 'updatedAt'>): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'settings', 'main'), { ...settings, updatedAt: Date.now() });
}

export interface ProfileChanges {
  firstName: string;
  lastName: string;
  businessName: string;
  accountMode: AccountMode;
}

export function saveProfile(uid: string, changes: ProfileChanges): Promise<void> {
  return updateDoc(doc(db, 'users', uid), {
    firstName: changes.firstName.trim(),
    lastName: changes.lastName.trim(),
    businessName: changes.businessName.trim(),
    accountMode: changes.accountMode,
    updatedAt: Date.now(),
  });
}

/** מסנכרן את כתובת המייל בפרופיל לכתובת ב-Authentication (אחרי שינוי מייל מאומת). */
export function syncProfileEmail(uid: string, email: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid), { email, updatedAt: Date.now() });
}

// ---------- אבטחה ----------

export async function changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
  requireOnline();
  await reauthenticate(user, currentPassword);
  await updatePassword(user, newPassword);
}

/**
 * שינוי מייל: נשלח קישור אימות לכתובת החדשה. הכתובת מתחלפת רק אחרי שהמשתמש לוחץ עליו,
 * ולכן טעות הקלדה אינה נועלת אותו מחוץ לחשבון.
 */
export async function requestEmailChange(user: User, currentPassword: string, newEmail: string): Promise<void> {
  requireOnline();
  await reauthenticate(user, currentPassword);
  await verifyBeforeUpdateEmail(user, newEmail.trim());
}

// ---------- יצוא וגיבוי ----------

export interface ExportResult {
  backup: BackupFile;
  transactions: ExportTransaction[];
}

/** קורא את כל נתוני המשתמש (מהשרת כשיש חיבור, אחרת מהמטמון המקומי). */
export async function exportAllData(uid: string): Promise<ExportResult> {
  const read = async <T>(name: string): Promise<T[]> => {
    const ref = collection(db, 'users', uid, name);
    const snapshot = await (navigator.onLine === false ? getDocs(ref) : getDocsFromServer(ref));
    return snapshot.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  };

  const [businessTx, householdTx, businesses, categories, budgets, tasks, shoppingItems, settingsDocs] = await Promise.all([
    read<Transaction>('businessTransactions'),
    read<Transaction>('householdTransactions'),
    read<{ id: string; name?: string }>('businesses'),
    read<Category>('categories'),
    read<object>('budgets'),
    read<object>('tasks'),
    read<object>('shoppingItems'),
    read<object>('settings'),
  ]);

  const businessNames = new Map(businesses.map((b) => [b.id, (b as { name?: string }).name ?? '']));
  const legacyName = (await readLegacyBusinessName(uid)) ?? '';
  const nameOfBusiness = (t: Transaction) => businessNames.get(t.businessId || 'main') || (t.businessId ? '' : legacyName);

  const transactions: ExportTransaction[] = [
    ...businessTx.map((t) => ({ ...t, scope: 'business' as const, businessName: nameOfBusiness(t) })),
    ...householdTx.map((t) => ({ ...t, scope: 'household' as const })),
  ];

  const backup = buildBackup({
    uid,
    settings: settingsDocs,
    businesses,
    categories,
    budgets,
    tasks,
    shoppingItems,
    businessTransactions: businessTx,
    householdTransactions: householdTx,
  });
  return { backup, transactions };
}

/** שם העסק הראשון מהפרופיל, לנתונים ישנים שאין להם רשומת עסק. */
async function readLegacyBusinessName(uid: string): Promise<string | null> {
  try {
    const snapshot = await (navigator.onLine === false ? getDoc(doc(db, 'users', uid)) : getDocFromServer(doc(db, 'users', uid)));
    const name = (snapshot.data() as { businessName?: unknown } | undefined)?.businessName;
    return typeof name === 'string' ? name : null;
  } catch {
    return null;
  }
}

const BATCH_SIZE = 400;

// ---------- שחזור מקובץ גיבוי ----------

const RESTORE_COLLECTIONS = [
  ['businesses', 'businesses'],
  ['categories', 'categories'],
  ['budgets', 'budgets'],
  ['tasks', 'tasks'],
  ['shoppingItems', 'shoppingItems'],
  ['businessTransactions', 'businessTransactions'],
  ['householdTransactions', 'householdTransactions'],
] as const;

export interface NewDataPlan {
  plan: RestorePlan;
  /** מסמכים מהקובץ שכבר קיימים בחשבון. הם אינם נדרסים. */
  alreadyExisting: number;
}

/**
 * משאיר מהקובץ רק מה שעדיין אינו קיים בחשבון. שחזור לעולם לא דורס ולא מוחק נתונים קיימים,
 * ולכן אפשר להריץ אותו שוב בבטחה. דורש חיבור, כי הבדיקה נעשית מול השרת.
 */
export async function planNewData(uid: string, plan: RestorePlan): Promise<NewDataPlan> {
  requireOnline();
  const result: RestorePlan = { ...plan, businesses: [], categories: [], budgets: [], tasks: [], shoppingItems: [], businessTransactions: [], householdTransactions: [] };
  let alreadyExisting = 0;
  for (const [key, name] of RESTORE_COLLECTIONS) {
    const snapshot = await getDocsFromServer(collection(db, 'users', uid, name));
    const existing = new Set(snapshot.docs.map((d) => d.id));
    for (const item of plan[key]) {
      if (existing.has(item.id)) alreadyExisting += 1;
      else result[key].push(item);
    }
  }
  return { plan: result, alreadyExisting };
}

export async function applyRestore(uid: string, plan: RestorePlan, replaceSettings: boolean): Promise<void> {
  requireOnline();
  for (const [key, name] of RESTORE_COLLECTIONS) {
    const items = plan[key];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      items.slice(i, i + BATCH_SIZE).forEach((item) => batch.set(doc(db, 'users', uid, name, item.id), item.data));
      await batch.commit();
    }
  }
  if (replaceSettings && plan.settings) {
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), { ...plan.settings, updatedAt: Date.now() });
  }
}

// ---------- מחיקת חשבון ----------

const USER_COLLECTIONS = [
  'businessTransactions',
  'householdTransactions',
  'businesses',
  'categories',
  'budgets',
  'tasks',
  'shoppingItems',
  'titheRecords',
  'settings',
  'businessProfile',
  'householdProfile',
] as const;


/**
 * מוחק את כל נתוני המשתמש ואת החשבון עצמו, ללא אפשרות שחזור.
 * דורש חיבור לאינטרנט וסיסמה. סדר הפעולות: אימות מחדש, מחיקת נתונים, מחיקת פרופיל, מחיקת
 * ההתחברות. אם נכשל באמצע אפשר להריץ שוב: מחיקה חוזרת של מה שכבר נמחק אינה גורמת נזק.
 */
export async function deleteAccountAndData(user: User, password: string): Promise<void> {
  requireOnline();
  await reauthenticate(user, password);

  const uid = user.uid;
  for (const name of USER_COLLECTIONS) {
    const snapshot = await getDocsFromServer(collection(db, 'users', uid, name));
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'users', uid));
  await deleteUser(auth.currentUser ?? user);
  forgetDeviceUser();
}
