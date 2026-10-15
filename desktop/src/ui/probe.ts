import { onAuthStateChanged, getAuth, type User } from '../shims/auth';

/** עזר לבדיקות: עוקב אחרי המשתמש האחרון שפורסם בשכבת ההתחברות. */
let last: User | null = null;
onAuthStateChanged(getAuth(), (u) => { last = u; });
export const auth_probe = { user: (): User | null => last, reset: (): void => { last = null; } };
