import { useState } from 'react';
import { CURRENCY_CODES, CURRENCY_NAMES, CURRENCY_SYMBOLS, getCurrency, type CurrencyCode } from '../../domain/currency';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../../domain/types';
import { readFormDefaults, writeFormDefaults, type FormDefaults } from '../../services/formDefaults';

/** ברירות מחדל לטופס הוספת הכנסה והוצאה: מטבע ואמצעי תשלום. נשמרות במכשיר הזה. */
export function FormDefaultsSection() {
  const [defaults, setDefaults] = useState<FormDefaults>(readFormDefaults);
  const change = (next: FormDefaults) => {
    setDefaults(next);
    writeFormDefaults(next);
  };
  const currency = defaults.currency ?? getCurrency();
  const payment = defaults.paymentMethod ?? 'cash';

  return (
    <div className="settings-form">
      <div className="field">
        <label htmlFor="def-currency">מטבע ברירת מחדל</label>
        <select id="def-currency" className="input" value={currency} onChange={(e) => change({ ...defaults, currency: e.target.value as CurrencyCode })}>
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {`${CURRENCY_SYMBOLS[code]} ${CURRENCY_NAMES[code]} (${code})`}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="def-payment">אמצעי תשלום ברירת מחדל</label>
        <select id="def-payment" className="input" value={payment} onChange={(e) => change({ ...defaults, paymentMethod: e.target.value as PaymentMethod })}>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="field-hint">
        הערכים האלה נבחרים מראש בכל פעולה חדשה, ואפשר לשנות אותם בפרטים נוספים. נשמרים במכשיר הזה בלבד. התאריך תמיד היום (או החודש שבו אתה נמצא).
      </div>
    </div>
  );
}
