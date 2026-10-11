import { changeLang, getLang, type Lang } from '../../i18n/lang';

/** שפת הממשק (במכשיר הזה), והסבר על בחירת המטבע בטופס. */
export function LanguageCurrencySection() {
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

      <p className="muted small">
        המטבע נבחר בכל הוספת הכנסה או הוצאה, בטופס עצמו. הפעולה נשארת ברשימה במטבע שבו הוזנה, ובסכומים, בתקציב
        ובמעשרות היא נספרת אחרי המרה אוטומטית לפי שער יום הפעולה. כשיש פעולות ביותר ממטבע אחד, מופיע סיכום לפי
        מטבע, עם כפתור המרה לפי השער העדכני.
      </p>

    </form>
  );
}
