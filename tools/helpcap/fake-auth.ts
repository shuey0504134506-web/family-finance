/** Firebase Auth מדומה לצילום מסכי ההדגמה: משתמש מחובר קבוע. */
export interface User { uid: string; email: string }
const user = { uid: 'demo', email: 'dana@example.com', displayName: 'Dana', metadata: { lastSignInTime: new Date().toUTCString() } };
const auth = { currentUser: user };
export const getAuth = () => auth;
export const onAuthStateChanged = (_a: unknown, cb: (u: unknown) => void) => { queueMicrotask(() => cb(user)); return () => undefined; };
const no = async () => { throw new Error('demo'); };
export const createUserWithEmailAndPassword = no;
export const signInWithEmailAndPassword = no;
export const sendPasswordResetEmail = no;
export const signOut = async () => undefined;
export const updateProfile = async () => undefined;
export const reauthenticateWithCredential = no;
export const updatePassword = no;
export const verifyBeforeUpdateEmail = no;
export const deleteUser = no;
export const EmailAuthProvider = { credential: () => ({}) };
