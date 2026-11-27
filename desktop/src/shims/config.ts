/** תחליף ל-src/firebase/config.ts של האפליקציה: בתוכנה אין צורך במשתני סביבה, והמסד מקומי. */
import { getAuth } from './auth';
import { initializeFirestore } from './firestore';

export const firebaseReady = true;
export const missingFirebaseVars: string[] = [];
export const app = {};
export const auth = getAuth();
export const db = initializeFirestore();


export const canVerifyAdminEmail = false;
export const verifyAdminEmail: (uid: string, send: boolean) => Promise<'verified' | 'sent' | 'pending'> = async () => {
  throw new Error('auth/operation-not-supported');
};
