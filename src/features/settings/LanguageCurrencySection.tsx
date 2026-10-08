import { useState } from 'react';
import { CURRENCY_CODES, CURRENCY_SYMBOLS, type CurrencyCode } from '../../domain/currency';
import { changeLang, getLang, type Lang } from '../../i18n/lang';
import { saveSettings } from '../../services/accountService';
import { useSyncNotice } from '../sync/SyncNotice';
import { useReadyAuth } from '../auth/AuthContext';
import { useSettings } from './SettingsContext';

const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  ILS: 'שקל חדש',
  USD: 'דולר אמריקאי',
  EUR: 'אירו',
  GBP: 'לירה שטרלינג',
};

/** שפת הממשק (במכשיר הזה) ומטבע התצוגה והחישוב (בחשבון). */
export function LanguageCurrencySection() {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const { reportFailure } = useSyncNotice();
  const [error, setError] = useState('');

  const onCurrency = (currency: CurrencyCode) => {
    setError('');
    saveSettings(user.uid, {
      titheBps: settings.titheBps,
      countBusinessTithePayments: settings.countBusinessTithePayments,
      businessTransferMode: settings.businessTransferMode,
      currency,
      annualMode: settings.annualMode,
    }).catch(() => {
      reportFailure('לא הצלחנו לסנכרן את ההגדרות. יש לנסות שוב.');
      setError('לא הצלחנו לסנכרן את ההגדרות. יש לנסות שוב.');
    });
  };

  return (
    <form className="settings-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="field">
        <label htmlFor="app-lang">שפה</label>
        <select
          id="app-lang"
          className="input"
          value={getLang()}
          onChange={(e) => changeLang(e.target.value as Lang)}
        >
          <option value="he">עברית</option>
          <option value="en">English</option>
        </select>
        <div className="field-hint">נשמר במכשיר הזה בלבד. החלפת השפה מרעננת את האפליקציה.</div>
      </div>

      <div className="field">
        <label htmlFor="app-currency">מטבע</label>
        <select
          id="app-currency"
          className="input"
          value={settings.currency}
          onChange={(e) => onCurrency(e.target.value as CurrencyCode)}
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {`${CURRENCY_SYMBOLS[code]} ${CURRENCY_NAMES[code]} (${code})`}
            </option>
          ))}
        </select>
        <div className="field-hint">
          המטבע משמש בכל התצוגות והחישובים בחשבון. החלפת מטבע משנה רק את הסימן: סכומים שכבר נשמרו אינם
          מומרים לפי שער.
        </div>
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
