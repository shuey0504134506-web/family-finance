import { useState } from 'react';
import { CURRENCY_CODES, CURRENCY_NAMES, CURRENCY_SYMBOLS, getCurrency, type CurrencyCode } from '../../domain/currency';
import { choiceKey, choiceText, choicesFor, parseChoiceKey } from '../../domain/payment';
import type { Scope, TransactionType } from '../../domain/types';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import { defaultsKey, readFormDefaults, writeFormDefaults, type FormDefaults } from '../../services/formDefaults';
import { useReadyAuth } from '../auth/AuthContext';

const CASES: ReadonlyArray<{ scope: Scope; type: TransactionType; title: string }> = [
  { scope: 'household', type: 'income', title: 'הכנסה במשק הבית' },
  { scope: 'household', type: 'expense', title: 'הוצאה במשק הבית' },
  { scope: 'business', type: 'income', title: 'הכנסה בעסק' },
  { scope: 'business', type: 'expense', title: 'הוצאה בעסק' },
];

/**
 * ברירות מחדל לטופס ההוספה (מטבע וצורת תשלום), בנפרד להכנסה והוצאה ולעסק ולמשק הבית,
 * ברירות המחדל נשמרות במכשיר הזה. אמצעי תשלום אישיים מוסיפים ומוחקים בטופס עצמו.
 */
export function FormDefaultsSection() {
  const { user } = useReadyAuth();
  const custom = useCustomMethods(user.uid);
  const [defaults, setDefaults] = useState<FormDefaults>(readFormDefaults);
  const change = (next: FormDefaults) => {
    setDefaults(next);
    writeFormDefaults(next);
  };

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
    </div>
  );
}
