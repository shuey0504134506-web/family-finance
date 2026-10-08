import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Field } from '../../components/Field';
import { effectiveMethod, needsPasswordFallback } from '../../domain/appLock';
import { describeError } from '../../services/authErrors';
import { requestPasswordReset } from '../../services/authService';
import { useAuth, useReadyAuth } from '../auth/AuthContext';
import { useLock, type UnlockResult } from './LockContext';
import { PatternPad } from './PatternPad';

/** מכסה את כל המסך כשהאפליקציה נעולה. התוכן שמתחתיו נשאר במקומו, כדי שטופס שהתחלתם למלא לא יימחק. */
export function LockGate({ children }: { children: ReactNode }) {
  const { locked } = useLock();
  return (
    <>
      <div style={{ visibility: locked ? 'hidden' : 'visible' }} aria-hidden={locked}>
        {children}
      </div>
      {locked && <LockScreen />}
    </>
  );
}

function LockScreen() {
  const { config, unlockWithPassword, unlockWithSecret } = useLock();
  const { signOutUser } = useAuth();
  const { user } = useReadyAuth();
  const [resetInfo, setResetInfo] = useState('');
  const method = effectiveMethod(config);
  const [forcePassword, setForcePassword] = useState(false);
  const usePassword = method === 'password' || forcePassword || needsPasswordFallback(config);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<UnlockResult>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (!result.ok) setMessage(result.message);
    } catch (caught) {
      setMessage(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    const email = user.email;
    if (!email || busy) return;
    setBusy(true);
    setMessage('');
    setResetInfo('');
    try {
      await requestPasswordReset(email);
      setResetInfo(
        `שלחנו קישור לאיפוס הסיסמה אל ${email}. לוחצים עליו, בוחרים סיסמה חדשה, וחוזרים לכאן להיכנס איתה. כדאי לבדוק גם בתיקיית הספאם.`,
      );
    } catch (caught) {
      setMessage(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="lock-screen" aria-label="האפליקציה נעולה">
      <div className="lock-card">
        <h1 className="center-title">האפליקציה נעולה</h1>
        {usePassword ? (
          <PasswordUnlock busy={busy} onSubmit={(pw) => run(() => unlockWithPassword(pw))} />
        ) : method === 'pin' && config.pin ? (
          <PinUnlock
            length={config.pin.length}
            busy={busy}
            onSubmit={(pin) => run(() => unlockWithSecret('pin', pin))}
          />
        ) : (
          <>
            <p className="muted center-text">ציירו את התבנית לפתיחה</p>
            <PatternPad
              label="לוח תבנית לפתיחת האפליקציה"
              disabled={busy}
              invalid={message !== ''}
              onComplete={(seq) => void run(() => unlockWithSecret('pattern', seq))}
            />
          </>
        )}

        {message && (
          <div className="form-error" role="alert">
            {message}
          </div>
        )}
        {resetInfo && (
          <div className="form-success" role="status">
            {resetInfo}
          </div>
        )}

        <div className="stack">
          {usePassword && (
            <button type="button" className="link-btn" disabled={busy} onClick={() => void sendReset()}>
              שכחתי סיסמה
            </button>
          )}
          {!usePassword && (
            <button type="button" className="link-btn" onClick={() => { setForcePassword(true); setMessage(''); }}>
              כניסה באמצעות סיסמה
            </button>
          )}
          <button type="button" className="link-btn" disabled={busy} onClick={() => void signOutUser()}>
            יציאה מהחשבון
          </button>
        </div>
      </div>
    </main>
  );
}

function PasswordUnlock({ busy, onSubmit }: { busy: boolean; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(password);
    setPassword('');
  };
  return (
    <form className="settings-form" onSubmit={submit} noValidate>
      <Field
        label="סיסמת החשבון"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'בודק…' : 'כניסה'}
      </button>
    </form>
  );
}

function PinUnlock({ length, busy, onSubmit }: { length: number; busy: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  // נכנסים אוטומטית כשהוקלד מספר הספרות של הקוד.
  useEffect(() => {
    if (pin.length === length) {
      onSubmit(pin);
      setPin('');
    }
    // onSubmit משתנה בכל רינדור ואינו חלק מהתנאי
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, length]);
  return (
    <div className="settings-form">
      <Field
        label="קוד PIN"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={length}
        disabled={busy}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  );
}
