import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

/**
 * אתחול Firebase. כל הערכים מגיעים ממשתני Environment (קובץ .env מקומי,
 * או משתני הסביבה של מערכת הפריסה). אין מפתחות בקוד.
 */
const env = import.meta.env;

const values = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** האם כל הערכים הנדרשים הוגדרו. כשלא, האפליקציה מציגה מסך הנחיות הגדרה. */
export const firebaseReady = Boolean(
  values.apiKey && values.authDomain && values.projectId && values.appId,
);

/** שמות משתני הסביבה שחסרים (להצגה במסך ההגדרה). */
export const missingFirebaseVars: string[] = [
  ['VITE_FIREBASE_API_KEY', values.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', values.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', values.projectId],
  ['VITE_FIREBASE_APP_ID', values.appId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name as string);

// כשההגדרה חסרה משתמשים בערכי מקום, כדי שהייבוא לא יקרוס. האפליקציה
// לא מרכיבה שום רכיב שמשתמש ב-Firebase לפני שבדקה את firebaseReady.
const app = initializeApp({
  apiKey: values.apiKey ?? 'not-configured',
  authDomain: values.authDomain ?? 'not-configured.firebaseapp.com',
  projectId: values.projectId ?? 'not-configured',
  storageBucket: values.storageBucket,
  messagingSenderId: values.messagingSenderId,
  appId: values.appId ?? 'not-configured',
});

export const auth = getAuth(app);

/**
 * Firestore עם מטמון מקומי מתמיד (IndexedDB), שעובד גם בכמה לשוניות.
 * פעולה שנכתבת בלי אינטרנט נשמרת במכשיר ומסונכרנת אוטומטית כשהחיבור חוזר.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
