import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  MAX_LOCAL_FAILS,
  isFreshSignIn,
  lockOnBackground,
  lockOnLaunch,
  needsPasswordFallback,
  patternToSecret,
  type LockConfig,
  type LockMethod,
  type LockTiming,
} from '../../domain/appLock';
import { reloadedForLangChange } from '../../i18n/lang';
import { verifyAccountPassword } from '../../services/accountService';
import { loadLockConfig, patchLockConfig, hashSecret, verifySecret } from '../../services/appLockStorage';
import { describeError } from '../../services/authErrors';

export type UnlockResult = { ok: true } | { ok: false; message: string };

interface LockValue {
  config: LockConfig;
  locked: boolean;
  /** ננעל מחדש מיד (למשל מכפתור). */
  lockNow: () => void;
  unlockWithPassword: (password: string) => Promise<UnlockResult>;
  unlockWithSecret: (method: 'pin' | 'pattern', secret: string | readonly number[]) => Promise<UnlockResult>;
  setTiming: (timing: LockTiming) => void;
  chooseMethod: (method: LockMethod) => void;
  savePin: (pin: string) => Promise<void>;
  savePattern: (sequence: readonly number[]) => Promise<void>;
}

const LockContext = createContext<LockValue | null>(null);

const WRONG_CODES = new Set(['auth/invalid-credential', 'auth/wrong-password', 'auth/missing-password']);

export function LockProvider({ user, children }: { user: User; children: ReactNode }) {
  const uid = user.uid;
  const [config, setConfig] = useState<LockConfig>(() => loadLockConfig(uid));
  // בהפעלה נועלים, אלא אם הסיסמה הוקלדה זה עתה בכניסה לחשבון.
  const [locked, setLocked] = useState(
    () => !reloadedForLangChange && lockOnLaunch(loadLockConfig(uid)) && !isFreshSignIn(user.metadata.lastSignInTime, Date.now()),
  );
  const configRef = useRef(config);
  configRef.current = config;

  const patch = useCallback(
    (change: (current: LockConfig) => LockConfig) => setConfig(patchLockConfig(uid, change)),
    [uid],
  );

  // יציאה מהמסך (מעבר לאפליקציה אחרת, נעילת מכשיר, מעבר לשונית אחרת).
  useEffect(() => {
    const onHidden = () => {
      if (lockOnBackground(loadLockConfig(uid))) setLocked(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHidden();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHidden);
    let removeNative: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) onHidden();
      }).then((handle) => {
        removeNative = () => void handle.remove();
      });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHidden);
      removeNative?.();
    };
  }, [uid]);

  const finishUnlock = useCallback(() => {
    patch((c) => ({ ...c, fails: 0 }));
    setLocked(false);
  }, [patch]);

  const unlockWithPassword = useCallback(
    async (password: string): Promise<UnlockResult> => {
      if (!password) return { ok: false, message: 'יש להזין סיסמה.' };
      try {
        const stored = loadLockConfig(uid).password;
        // אימות מקומי מאפשר כניסה גם בלי אינטרנט. אם הסיסמה שונתה במכשיר אחר, האימות מול השרת יעדכן.
        if (stored && (await verifySecret(password, stored))) {
          finishUnlock();
          return { ok: true };
        }
        await verifyAccountPassword(user, password);
        const hash = await hashSecret(password);
        patch((c) => ({ ...c, password: hash, fails: 0 }));
        setLocked(false);
        return { ok: true };
      } catch (caught) {
        const code = (caught as { code?: string }).code ?? '';
        if (WRONG_CODES.has(code)) return { ok: false, message: 'הסיסמה שגויה.' };
        return { ok: false, message: describeError(caught) };
      }
    },
    [user, uid, finishUnlock, patch],
  );

  const unlockWithSecret = useCallback(
    async (method: 'pin' | 'pattern', secret: string | readonly number[]): Promise<UnlockResult> => {
      const current = loadLockConfig(uid);
      if (needsPasswordFallback(current)) {
        return { ok: false, message: 'יותר מדי ניסיונות שגויים. יש להיכנס עם סיסמת החשבון.' };
      }
      const stored = method === 'pin' ? current.pin : current.pattern;
      const text = typeof secret === 'string' ? secret : patternToSecret(secret);
      if (stored && (await verifySecret(text, stored))) {
        finishUnlock();
        return { ok: true };
      }
      const next = patchLockConfig(uid, (c) => ({ ...c, fails: c.fails + 1 }));
      setConfig(next);
      if (needsPasswordFallback(next)) {
        return { ok: false, message: 'יותר מדי ניסיונות שגויים. יש להיכנס עם סיסמת החשבון.' };
      }
      const left = MAX_LOCAL_FAILS - next.fails;
      const subject = method === 'pin' ? 'הקוד שגוי' : 'התבנית שגויה';
      return { ok: false, message: `${subject}. נותרו ${left} ניסיונות.` };
    },
    [uid, finishUnlock],
  );

  const value = useMemo<LockValue>(
    () => ({
      config,
      locked,
      lockNow: () => setLocked(true),
      unlockWithPassword,
      unlockWithSecret,
      setTiming: (timing) => patch((c) => ({ ...c, timing })),
      chooseMethod: (method) => patch((c) => ({ ...c, method })),
      savePin: async (pin) => {
        const hash = await hashSecret(pin);
        patch((c) => ({ ...c, method: 'pin', pin: { ...hash, length: pin.length }, fails: 0 }));
      },
      savePattern: async (sequence) => {
        const hash = await hashSecret(patternToSecret(sequence));
        patch((c) => ({ ...c, method: 'pattern', pattern: hash, fails: 0 }));
      },
    }),
    [config, locked, unlockWithPassword, unlockWithSecret, patch],
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockValue {
  const value = useContext(LockContext);
  if (!value) throw new Error('useLock must be used inside LockProvider');
  return value;
}
