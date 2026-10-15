/** תחליף ל-src/firebase/config.ts של האפליקציה: בתוכנה אין צורך במשתני סביבה, והמסד מקומי. */
import { getAuth } from './auth';
import { initializeFirestore } from './firestore';

export const firebaseReady = true;
export const missingFirebaseVars: string[] = [];
export const app = {};
export const auth = getAuth();
export const db = initializeFirestore();
