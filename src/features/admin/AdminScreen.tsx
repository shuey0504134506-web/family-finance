import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isAdminEmail } from '../../config/admin';
import { loadAdminOverview, type AdminOverview, type UsageLevel } from '../../services/adminService';
import { useReadyAuth } from '../auth/AuthContext';

const USAGE_LABEL: Record<UsageLevel, string> = {
  high: 'שימוש גבוה',
  medium: 'שימוש בינוני',
  low: 'שימוש נמוך',
  idle: 'לא פעיל',
};

function dateTime(ms: number | null): string {
  if (!ms) return 'אף פעם';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * מסך מנהל (קריאה בלבד): כל החשבונות ונתוני שימוש כלליים.
 * נפתח רק לחשבון המנהל; השרת בודק את ההרשאה בעצמו, ולכן גם גישה ישירה לכתובת לא חושפת נתונים.
 */
export function AdminScreen() {
  const { user } = useReadyAuth();
  if (!isAdminEmail(user.email)) return <Navigate to="/" replace />;
  return <AdminContent />;
}

function AdminContent() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    loadAdminOverview()
      .then(setData)
      .catch((e: { code?: string }) =>
        setError(
          e.code === 'functions/permission-denied'
            ? 'אין הרשאה.'
            : e.code === 'functions/not-found' || e.code === 'functions/unavailable'
              ? 'פונקציות השרת עוד לא פורסמו. יש לבצע את ההוראות בקובץ docs/ADMIN_SETUP.md.'
              : 'לא הצלחנו לטעון את הנתונים. יש לבדוק חיבור ולנסות שוב.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="app-shell">
      <ScreenHeader title="ניהול מתקדם" />
      <main className="content" aria-busy={loading}>
        {loading && !data ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : error ? (
          <div className="card error-card" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={load}>
              ניסיון חוזר
            </button>
          </div>
        ) : data ? (
          <>
            <section className="card" aria-label="סיכום כללי">
              <h2 className="card-title">סיכום כללי</h2>
              <dl className="detail-list">
                <div><dt>חשבונות</dt><dd>{data.totals.accounts}</dd></div>
                <div><dt>נכנסו ב-24 שעות</dt><dd>{data.totals.active24h}</dd></div>
                <div><dt>נכנסו בשבוע</dt><dd>{data.totals.active7d}</dd></div>
                <div><dt>נכנסו בחודש</dt><dd>{data.totals.active30d}</dd></div>
                <div><dt>חשבונות חדשים בשבוע</dt><dd>{data.totals.newLast7d}</dd></div>
                <div><dt>חסומים</dt><dd>{data.totals.disabled}</dd></div>
              </dl>
              {data.truncated ? <p className="muted small">מוצגים 1,000 החשבונות הראשונים בלבד.</p> : null}
              <p className="muted small">עודכן ב-{dateTime(data.generatedAt)}. מוצגים מספרים כלליים בלבד, בלי סכומים ובלי תוכן הפעולות.</p>
              <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
                {loading ? 'מרענן…' : 'רענון'}
              </button>
            </section>

            <ul className="tx-list" aria-label="חשבונות">
              {data.users.map((u) => (
                <li key={u.uid} className="txc">
                  <div className="txc-top">
                    <span className="txc-title" dir="ltr">{u.email || u.uid}</span>
                  </div>
                  <div className="txc-mid">
                    <span className="txc-chips">
                      <span className="txc-chip">{USAGE_LABEL[u.usage]}</span>
                      {u.disabled ? <span className="txc-chip">חסום</span> : null}
                    </span>
                  </div>
                  <div className="txc-note">
                    נרשם: {dateTime(u.createdAt)} · כניסה אחרונה: {dateTime(u.lastSignInAt)}
                  </div>
                  <div className="txc-note">
                    פעולות: {u.txTotal} בסך הכול, {u.tx7d} בשבוע האחרון
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  );
}
