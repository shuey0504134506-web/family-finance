import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase/config';
import type { UserProfile } from '../../domain/types';
import { loginWithEmail, logout, registerAccount } from '../../services/authService';
import { syncProfileEmail } from '../../services/accountService';
import { saveDeviceUser } from '../../services/deviceUser';
import {
  createUserRecords,
  subscribeUserProfile,
  type NewAccountInput,
  type ProfileSnapshot,
} from '../../services/profileService';

export type AuthState =
  /** עדיין לא ידוע אם יש משתמש מחובר */
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** מחובר, אך אי אפשר לדעת אם החשבון הושלם (אין חיבור ואין מטמון) */
  | { status: 'checking'; user: User }
  /** מחובר, אך רשומות החשבון לא נוצרו (יצירה שנקטעה) */
  | { status: 'needsSetup'; user: User }
  | { status: 'ready'; user: User; profile: UserProfile };

interface AuthContextValue {
  state: AuthState;
  /** true מיד אחרי הרשמה, עד שהמשתמש לוחץ "מעבר ליומן שלי" */
  justRegistered: boolean;
  register: (input: NewAccountInput, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  completeSetup: (input: Omit<NewAccountInput, 'email'>) => Promise<void>;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = עדיין בודקים, null = אין משתמש מחובר
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profileSnapshot, setProfileSnapshot] = useState<{
    uid: string;
    snapshot: ProfileSnapshot;
  } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (user) => setAuthUser(user)), []);

  const uid = authUser?.uid ?? null;
  useEffect(() => {
    if (!uid) {
      setProfileSnapshot(null);
      return;
    }
    return subscribeUserProfile(
      uid,
      (snapshot) => setProfileSnapshot({ uid, snapshot }),
      // שגיאת קריאה אינה הוכחה שהחשבון חסר, ולכן "לא ידוע" ולא "חסר".
      () => setProfileSnapshot({ uid, snapshot: { kind: 'unknown' } }),
    );
  }, [uid]);

  const state: AuthState = useMemo(() => {
    if (authUser === undefined) return { status: 'loading' };
    // בזמן הרשמה נשארים במצב "לא מחובר" כדי שטופס ההרשמה יישאר מוצג
    // עד שכל רשומות החשבון נשמרו.
    if (authUser === null || registering) return { status: 'signedOut' };
    if (!profileSnapshot || profileSnapshot.uid !== authUser.uid) return { status: 'loading' };
    const { snapshot } = profileSnapshot;
    if (snapshot.kind === 'found') {
      return { status: 'ready', user: authUser, profile: snapshot.profile };
    }
    if (snapshot.kind === 'missing') return { status: 'needsSetup', user: authUser };
    return { status: 'checking', user: authUser };
  }, [authUser, profileSnapshot, registering]);

  // זוכרים במכשיר מי המשתמש, כדי שבכניסה הבאה יוצג שמו ויידרש רק סיסמה.
  useEffect(() => {
    if (state.status === 'ready') {
      saveDeviceUser({
        email: state.user.email ?? state.profile.email,
        firstName: state.profile.firstName,
      });
    }
  }, [state]);

  // אחרי שינוי מייל מאומת, הכתובת ב-Authentication משתנה. מעדכנים גם את הפרופיל.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const authEmail = state.user.email;
    if (authEmail && authEmail !== state.profile.email) {
      syncProfileEmail(state.user.uid, authEmail).catch(() => {
        // לא קריטי: ננסה שוב בפתיחה הבאה.
      });
    }
  }, [state]);

  const register = useCallback(async (input: NewAccountInput, password: string) => {
    setRegistering(true);
    try {
      await registerAccount(input, password);
      setJustRegistered(true);
    } finally {
      setRegistering(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await loginWithEmail(email, password);
  }, []);

  const signOutUser = useCallback(async () => {
    setJustRegistered(false);
    await logout();
  }, []);

  const completeSetup = useCallback(
    async (input: Omit<NewAccountInput, 'email'>) => {
      if (state.status !== 'needsSetup') return;
      await createUserRecords(state.user.uid, { ...input, email: state.user.email ?? '' });
    },
    [state],
  );

  const dismissWelcome = useCallback(() => setJustRegistered(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, justRegistered, register, login, signOutUser, completeSetup, dismissWelcome }),
    [state, justRegistered, register, login, signOutUser, completeSetup, dismissWelcome],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** לשימוש במסכים שמוגנים: מחזיר את המשתמש והפרופיל, וזורק שגיאה אם אין. */
export function useReadyAuth(): { user: User; profile: UserProfile } {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('useReadyAuth used outside a signed-in screen');
  return { user: state.user, profile: state.profile };
}
