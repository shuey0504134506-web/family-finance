import { missingFirebaseVars } from '../../firebase/config';

/** מוצג כשהקובץ .env לא הוגדר. מסביר בפשטות מה חסר. */
export function NotConfiguredScreen() {
  return (
    <main className="auth-screen">
      <div className="auth-column">
        <div className="card">
          <h1>האפליקציה עדיין לא מחוברת ל-Firebase</h1>
          <p>
            כדי להפעיל את האפליקציה צריך להגדיר את פרטי ה-Firebase שלך. חסרים הערכים הבאים:
          </p>
          <ul className="plain-list" dir="ltr">
            {missingFirebaseVars.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
          <p>
            מעתיקים את הקובץ <code dir="ltr">.env.example</code> לקובץ בשם <code dir="ltr">.env</code>,
            ממלאים את הערכים, ומפעילים מחדש את האפליקציה. הוראות מלאות כתובות בקובץ
            <code dir="ltr"> README.md</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
