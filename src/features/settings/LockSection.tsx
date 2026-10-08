import { useState } from 'react';
import { Field } from '../../components/Field';
import {
  MAX_PIN_LENGTH,
  effectiveMethod,
  patternToSecret,
  validatePattern,
  validatePin,
  type LockMethod,
  type LockTiming,
} from '../../domain/appLock';
import { PatternPad } from '../lock/PatternPad';
import { useLock } from '../lock/LockContext';

const METHOD_LABELS: Record<LockMethod, string> = {
  password: 'סיסמת החשבון (ברירת מחדל)',
  pin: 'קוד PIN',
  pattern: 'תבנית',
};

const TIMING_LABELS: Record<LockTiming, string> = {
  always: 'בכל יציאה מהמסך (מומלץ)',
  close: 'רק אחרי סגירה מוחלטת של האפליקציה',
  never: 'ללא נעילה',
};

/**
 * נעילת האפליקציה במכשיר הזה. הכול נשמר מיד, בלי כפתור שמירה.
 * הסיסמה, ה-PIN והתבנית נשמרים רק כגיבוב מוצפן במכשיר, ולא נשלחים לשום מקום.
 */
export function LockSection() {
  const lock = useLock();
  const method = effectiveMethod(lock.config);
  const [setup, setSetup] = useState<'pin' | 'pattern' | null>(null);
  const [notice, setNotice] = useState('');

  const choose = (next: LockMethod) => {
    setNotice('');
    if (next === 'password') {
      setSetup(null);
      lock.chooseMethod('password');
    } else if (next === 'pin' && !lock.config.pin) {
      setSetup('pin');
    } else if (next === 'pattern' && !lock.config.pattern) {
      setSetup('pattern');
    } else {
      setSetup(null);
      lock.chooseMethod(next);
    }
  };

  const shown = setup ?? method;

  return (
    <div className="settings-form">
      <fieldset className="radio-group">
        <legend>איך נכנסים לאפליקציה</legend>
        {(Object.keys(METHOD_LABELS) as LockMethod[]).map((m) => (
          <label key={m} className="check-row">
            <input type="radio" name="lock-method" checked={shown === m} onChange={() => choose(m)} />
            <span>{METHOD_LABELS[m]}</span>
          </label>
        ))}
      </fieldset>

      {setup === null && (method === 'pin' || method === 'pattern') && (
        <button type="button" className="btn btn-secondary" onClick={() => { setNotice(''); setSetup(method); }}>
          {method === 'pin' ? 'שינוי קוד PIN' : 'שינוי תבנית'}
        </button>
      )}

      {setup === 'pin' && <PinSetup onDone={() => { setSetup(null); setNotice('קוד ה-PIN הוגדר.'); }} onCancel={() => setSetup(null)} />}
      {setup === 'pattern' && <PatternSetup onDone={() => { setSetup(null); setNotice('התבנית הוגדרה.'); }} onCancel={() => setSetup(null)} />}

      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}

      <div className="field">
        <label htmlFor="lock-timing">מתי נדרש קוד</label>
        <select
          id="lock-timing"
          className="input"
          value={lock.config.timing}
          onChange={(e) => lock.setTiming(e.target.value as LockTiming)}
        >
          {(Object.keys(TIMING_LABELS) as LockTiming[]).map((t) => (
            <option key={t} value={t}>
              {TIMING_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="field-hint">
          {lock.config.timing === 'never'
            ? 'ללא נעילה: מי שמחזיק במכשיר פתוח רואה את הנתונים.'
            : 'ההגדרה נשמרת במכשיר הזה בלבד.'}
        </div>
      </div>

      <button type="button" className="btn btn-secondary" disabled={lock.config.timing === 'never'} onClick={lock.lockNow}>
        נעילה עכשיו
      </button>
    </div>
  );
}

function PinSetup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { savePin } = useLock();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');

  const update = (nextPin: string, nextAgain: string) => {
    setPin(nextPin);
    setAgain(nextAgain);
    setError('');
    // נשמר אוטומטית ברגע ששני השדות זהים ותקינים.
    if (nextAgain.length > 0 && nextAgain === nextPin) {
      const problem = validatePin(nextPin);
      if (problem) return setError(problem);
      savePin(nextPin).then(onDone, () => setError('לא הצלחנו לשמור את הקוד במכשיר הזה.'));
    }
  };

  return (
    <div className="settings-form">
      <Field label="קוד PIN חדש (4 עד 8 ספרות)" type="password" inputMode="numeric" autoComplete="off" maxLength={MAX_PIN_LENGTH} value={pin} onChange={(e) => update(e.target.value.replace(/\D/g, ''), again)} />
      <Field label="קוד PIN, שוב" type="password" inputMode="numeric" autoComplete="off" maxLength={MAX_PIN_LENGTH} value={again} onChange={(e) => update(pin, e.target.value.replace(/\D/g, ''))} error={error || undefined} hint="הקוד נשמר ברגע ששני השדות זהים." />
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        ביטול
      </button>
    </div>
  );
}

function PatternSetup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { savePattern } = useLock();
  const [first, setFirst] = useState<number[] | null>(null);
  const [error, setError] = useState('');

  const onComplete = (sequence: number[]) => {
    const problem = validatePattern(sequence);
    if (problem) return setError(problem);
    if (!first) {
      setFirst(sequence);
      return setError('');
    }
    if (patternToSecret(first) !== patternToSecret(sequence)) {
      setFirst(null);
      return setError('התבניות לא זהות. נסו שוב מההתחלה.');
    }
    savePattern(sequence).then(onDone, () => setError('לא הצלחנו לשמור את התבנית במכשיר הזה.'));
  };

  return (
    <div className="settings-form">
      <p className="muted center-text">{first ? 'ציירו את אותה תבנית שוב לאישור' : 'ציירו תבנית (לפחות 4 נקודות)'}</p>
      <PatternPad label="לוח תבנית להגדרה" onComplete={onComplete} invalid={error !== ''} />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        ביטול
      </button>
    </div>
  );
}
