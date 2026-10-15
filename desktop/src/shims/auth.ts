/**
 * תחליף ל-firebase/auth. המצב האמיתי (מי מחובר, סיסמאות, חשבון מקוון מול אופליין)
 * מנוהל בשכבת ה-session של התוכנה, שמתחברת לכאן דרך setAuthBackend.
 */
export interface User {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
  readonly offlineOnly: boolean;
}
export interface Auth { currentUser: User | null }
export interface UserCredential { user: User }

export interface AuthBackend {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  updateDisplayName(name: string): Promise<void>;
  reauthenticate(password: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  resetEmail(email: string): Promise<void>;
  changeEmail(newEmail: string): Promise<void>;
  deleteAccount(): Promise<void>;
}

const auth: Auth = { currentUser: null };
const listeners = new Set<(u: User | null) => void>();
let ready = false;
let backend: AuthBackend | null = null;

export const getAuth = (): Auth => auth;
export const setAuthBackend = (b: AuthBackend): void => { backend = b; };

/** נקרא על ידי ה-session בכניסה, ביציאה ובסיום האתחול. */
export function publishUser(user: User | null): void {
  auth.currentUser = user;
  ready = true;
  for (const l of [...listeners]) l(user);
}

export function onAuthStateChanged(_a: Auth, cb: (u: User | null) => void): () => void {
  listeners.add(cb);
  if (ready) queueMicrotask(() => cb(auth.currentUser));
  return () => listeners.delete(cb);
}

const need = (): AuthBackend => {
  if (!backend) throw Object.assign(new Error('auth/internal-error'), { code: 'auth/internal-error' });
  return backend;
};

export const signInWithEmailAndPassword = async (_a: Auth, email: string, password: string): Promise<UserCredential> => ({ user: await need().signIn(email, password) });
export const createUserWithEmailAndPassword = async (_a: Auth, email: string, password: string): Promise<UserCredential> => ({ user: await need().signUp(email, password) });
export const signOut = (_a: Auth): Promise<void> => need().signOut();
export const updateProfile = (_u: User, p: { displayName?: string | null }): Promise<void> => (p.displayName ? need().updateDisplayName(p.displayName) : Promise.resolve());
export const sendPasswordResetEmail = (_a: Auth, email: string): Promise<void> => need().resetEmail(email);
export const EmailAuthProvider = { credential: (email: string, password: string) => ({ email, password }) };
export const reauthenticateWithCredential = (_u: User, c: { password: string }): Promise<void> => need().reauthenticate(c.password);
export const updatePassword = (_u: User, p: string): Promise<void> => need().changePassword(p);
export const verifyBeforeUpdateEmail = (_u: User, e: string): Promise<void> => need().changeEmail(e);
export const deleteUser = (_u: User): Promise<void> => need().deleteAccount();
