import { CURRENCY_CODES, CURRENCY_NAMES, CURRENCY_SYMBOLS, type CurrencyCode } from '../../domain/currency';
import { changeLang, getLang, type Lang } from '../../i18n/lang';
import { saveSettings } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useSettings } from './SettingsContext';

/** שפת הממשק (במכשיר הזה) והמטבע הראשי של החשבון. */
export function LanguageCurrencySection() {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const { reportFailure } = useSyncNotice();

  const changeMainCurrency = (currency: CurrencyCode) => {
    saveSettings(user.uid, {
      titheBps: settings.titheBps,
      countBusinessTithePayments: settings.countBusinessTithePayments,
      businessTransferMode: settings.businessTransferMode,
      annualMode: settings.annualMode,
      currency,
    }).catch(() => reportFailure('לא הצלחנו לסנכרן את ההגדרות. יש לנסות שוב.'));
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
        <label htmlFor="main-currency">מטבע ראשי</label>
        <select
          id="main-currency"
          className="input"
          value={settings.currency}
          onChange={(e) => changeMainCurrency(e.target.value as CurrencyCode)}
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {`${CURRENCY_NAMES[code]} (${CURRENCY_SYMBOLS[code]})`}
            </option>
          ))}
        </select>
        <div className="field-hint">
          בו מוצגים היתרה המרכזית, התקציב והמעשרות. פעולות במטבע אחר מומרות אליו אוטומטית לפי שער יום הפעולה,
          וגם נתונים מהעבר.
        </div>
      </div>

      <p className="muted small">
        כלל יסוד: כל הכנסה והוצאה נשמרות תמיד בסכום ובמטבע שבהם הוזנו, וההמרה נעשית רק לתצוגה. החלפת המטבע הראשי
        לא משנה שום פעולה שמורה, ואפשר לחזור אחורה בכל רגע. מטבע ההזנה הרגיל נקבע בנפרד, בהגדרות ברירות המחדל של
        הטפסים, כך שאפשר להזין בשקלים ולראות הכול בדולרים. ברשימות מופיע הסכום המקורי, ומתחתיו ההמרה. כשיש פעולות
        ביותר ממטבע אחד, מופיע בבית סיכום לפי מטבע, עם כפתור המרה לפי השער העדכני.
      </p>
    </form>
  );
}
