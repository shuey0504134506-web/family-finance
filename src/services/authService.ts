import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserRecords, type NewAccountInput } from './profileService';

/**
 * הסיסמאות מנוהלות כולן על ידי Firebase Authentication.
 * האפליקציה לא שומרת סיסמאות בשום מקום, ולא ב-Firestore. לצורך נעילת האפליקציה נשמר במכשיר בלבד
 * גיבוב מלוח (PBKDF2) של הסיסמה, ולא הסיסמה עצמה (ראו appLockStorage).
 */

export async function registerAccount(input: NewAccountInput, password: string): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), password);
  const uid = credential.user.uid;
  try {
    await updateProfile(credential.user, {
      displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
    });
  } catch {
    // שם התצוגה אינו קריטי. הנתונים האמיתיים נשמרים ב-Firestore.
  }
  await createUserRecords(uid, input);
  return uid;
}

export async function loginWithEmail(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user.uid;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}
