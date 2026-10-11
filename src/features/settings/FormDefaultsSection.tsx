import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { CURRENCY_CODES, CURRENCY_NAMES, CURRENCY_SYMBOLS, getCurrency, type CurrencyCode } from '../../domain/currency';
import { choiceKey, choiceText, choicesFor, parseChoiceKey, validateCustomMethod } from '../../domain/payment';
import type { Scope, TransactionType } from '../../domain/types';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import { defaultsKey, readFormDefaults, writeFormDefaults, type FormDefaults } from '../../services/formDefaults';
import { saveCustomMethods } from '../../services/paymentMethodsService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

const CASES: ReadonlyArray<{ scope: Scope; type: TransactionType; title: string }> = [
  { scope: 'household', type: 'income', title: 'הכנסה במשק הבית' },
  { scope: 'household', type: 'expense', title: 'הוצאה במשק הבית' },
  { scope: 'business', type: 'income', title: 'הכנסה בעסק' },
  { scope: 'business', type: 'expense', title: 'הוצאה בעסק' },
];

/**
 * ברירות מחדל לטופס ההוספה (מטבע וצורת תשלום), בנפרד להכנסה והוצאה ולעסק ולמשק הבית,
 * וניהול אמצעי תשלום משלך. ברירות המחדל נשמרות במכשיר הזה; האמצעים האישיים משותפים לכל המכשירים.
 */
export function FormDefaultsSection() {
  const { user } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const custom = useCustomMethods(user.uid);
  const [defaults, setDefaults] = useState<FormDefaults>(readFormDefaults);
  const [newType, setNewType] = useState<TransactionType>('income');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const change = (next: FormDefaults) => {
    setDefaults(next);
    writeFormDefaults(next);
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateCustomMethod(newName, custom[newType], newType);
    if (problem) return setError(problem);
    saveCustomMethods(user.uid, { ...custom, [newType]: [...custom[newType], newName.trim()] }).catch(() =>
      reportFailure('לא הצלחנו לשמור את האמצעי. יש לנסות שוב.'),
    );
    setNewName('');
    setError('');
  };

  const onRemove = (type: TransactionType, label: string) =>
    saveCustomMethods(user.uid, { ...custom, [type]: custom[type].filter((x) => x !== label) }).catch(() =>
      reportFailure('לא הצלחנו לשמור את השינוי. יש לנסות שוב.'),
    );

  return (
    <div className="settings-form">
      {CASES.map(({ scope, type, title }) => {
        const k = defaultsKey(scope, type);
        const entry = defaults[k] ?? {};
        const options = choicesFor(type, custom[type]);
        const paymentKey = entry.payment && options.some((o) => choiceKey(o) === choiceKey(entry.payment!)) ? choiceKey(entry.payment) : 'cash';
        return (
          <div key={k} className="defaults-block">
            <h3 className="subhead">{title}</h3>
            <div className="field">
              <label htmlFor={`def-pay-${k}`}>{type === 'income' ? 'צורת הכנסה' : 'צורת תשלום'}</label>
              <select
                id={`def-pay-${k}`}
                className="input"
                value={paymentKey}
                onChange={(e) => change({ ...defaults, [k]: { ...entry, payment: parseChoiceKey(e.target.value) } })}
              >
                {options.map((o) => (
                  <option key={choiceKey(o)} value={choiceKey(o)}>
                    {choiceText(o)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`def-cur-${k}`}>מטבע</label>
              <select
                id={`def-cur-${k}`}
                className="input"
                value={entry.currency ?? getCurrency()}
                onChange={(e) => change({ ...defaults, [k]: { ...entry, currency: e.target.value as CurrencyCode } })}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {`${CURRENCY_SYMBOLS[code]} ${CURRENCY_NAMES[code]} (${code})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
      <div className="field-hint">
        הערכים האלה נבחרים מראש בכל פעולה חדשה. נשמרים במכשיר הזה בלבד. התאריך תמיד היום (או החודש שבו אתה נמצא).
      </div>

      <hr className="divider" />
      <h3 className="subhead">אמצעי תשלום משלי</h3>
      <p className="muted small">
        בהכנסה יש כברירת מחדל מזומן, העברה וצ'ק, ובהוצאה גם אשראי ודיירקט. אפשר להוסיף אמצעים משלך, והם יופיעו בטופס ההוספה.
      </p>
      {(['income', 'expense'] as const).map((type) =>
        custom[type].length === 0 ? null : (
          <div key={type} className="custom-methods">
            <span className="field-label">{type === 'income' ? 'להכנסות' : 'להוצאות'}</span>
            <div className="chip-group">
              {custom[type].map((label) => (
                <span key={label} className="chip-option custom-chip">
                  {label}
                  <button type="button" className="chip-x" aria-label={`הסרת ${label}`} onClick={() => void onRemove(type, label)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        ),
      )}
      <form className="inline-add" onSubmit={onAdd} noValidate>
        <div className="segmented" role="group" aria-label="סוג">
          {(['income', 'expense'] as const).map((t) => (
            <button key={t} type="button" className={newType === t ? 'is-active' : ''} aria-pressed={newType === t} onClick={() => setNewType(t)}>
              {t === 'income' ? 'הכנסות' : 'הוצאות'}
            </button>
          ))}
        </div>
        <Field label="שם האמצעי החדש" value={newName} onChange={(e) => setNewName(e.target.value)} error={error || undefined} autoComplete="off" />
        <button type="submit" className="btn btn-secondary">
          הוספת אמצעי
        </button>
      </form>
    </div>
  );
}
