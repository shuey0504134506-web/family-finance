/**
 * החיבור האמיתי ל-Firebase. נטען רק כאן (דרך הכינוי firebase-real), כדי שקוד האפליקציה,
 * שמייבא firebase/*, ימשיך לעבוד מול המסד המקומי בלבד.
 */
import { initializeApp, type FirebaseApp } from 'firebase-real/app';
import {
  createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, getAuth, reauthenticateWithCredential, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updatePassword, updateProfile, verifyBeforeUpdateEmail, type Auth,
} from 'firebase-real/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, query, setDoc, where, type Firestore } from 'firebase-real/firestore';
import { getFunctions, httpsCallable } from 'firebase-real/functions';
import type { DocData } from '../db/localDb';
import type { Cloud, Remote, Target } from './engine';

export interface CloudUser { uid: string; email: string; displayName: string }

export interface CloudAuth {
  configured: boolean;
  signIn(email: string, password: string): Promise<CloudUser>;
  signUp(email: string, password: string, displayName: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  reauth(password: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  resetEmail(email: string): Promise<void>;
  changeEmail(newEmail: string): Promise<void>;
  deleteAccount(): Promise<void>;
  call(name: string, data: unknown): Promise<unknown>;
  store(): Cloud;
}

const env = import.meta.env;

export function createFirebaseCloud(): CloudAuth {
  const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
  let app: FirebaseApp | null = null;
  let auth: Auth | null = null;
  let fs: Firestore | null = null;

  const init = (): { auth: Auth; fs: Firestore; app: FirebaseApp } => {
    if (!configured) throw Object.assign(new Error('not-configured'), { code: 'auth/not-configured' });
    app ??= initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
    auth ??= getAuth(app);
    fs ??= getFirestore(app);
    return { auth, fs, app };
  };
  const user = (): NonNullable<Auth['currentUser']> => {
    const u = init().auth.currentUser;
    if (!u) throw Object.assign(new Error('no-user'), { code: 'auth/requires-recent-login' });
    return u;
  };
  const info = (u: { uid: string; email: string | null; displayName: string | null }): CloudUser => ({ uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? '' });

  const queryOf = (t: Extract<Target, { kind: 'collection' }>) => {
    const c = collection(init().fs, t.path);
    return t.where ? query(c, where(t.where.field, '==', t.where.value)) : c;
  };

  const store: Cloud = {
    async read(t) {
      const { fs } = init();
      if (t.kind === 'doc') {
        const s = await getDoc(doc(fs, t.path));
        return s.exists() ? [{ path: t.path, data: s.data() as DocData }] : [];
      }
      const s = await getDocs(queryOf(t));
      return s.docs.map((d): Remote => ({ path: d.ref.path, data: d.data() as DocData }));
    },
    write: (path, data) => setDoc(doc(init().fs, path), data),
    remove: (path) => deleteDoc(doc(init().fs, path)),
    watch(t, onList, onError) {
      const { fs } = init();
      if (t.kind === 'doc') {
        return onSnapshot(doc(fs, t.path), (s) => onList(s.exists() ? [{ path: t.path, data: s.data() as DocData }] : []), onError);
      }
      return onSnapshot(queryOf(t), (s) => { if (!s.metadata.fromCache) onList(s.docs.map((d) => ({ path: d.ref.path, data: d.data() as DocData }))); }, onError);
    },
  };

  return {
    configured,
    async signIn(email, password) { return info((await signInWithEmailAndPassword(init().auth, email.trim(), password)).user); },
    async signUp(email, password, displayName) {
      const cred = await createUserWithEmailAndPassword(init().auth, email.trim(), password);
      try { await updateProfile(cred.user, { displayName }); } catch { /* שם תצוגה אינו קריטי */ }
      return info({ ...cred.user, displayName });
    },
    async signOut() { if (auth) await signOut(auth); },
    async reauth(password) { const u = user(); await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email ?? '', password)); },
    changePassword: (p) => updatePassword(user(), p),
    resetEmail: (e) => sendPasswordResetEmail(init().auth, e.trim()),
    changeEmail: (e) => verifyBeforeUpdateEmail(user(), e),
    deleteAccount: () => deleteUser(user()),
    async call(name, data) { const { app } = init(); return (await httpsCallable(getFunctions(app, 'europe-west1'), name)(data)).data; },
    store: () => store,
  };
}
