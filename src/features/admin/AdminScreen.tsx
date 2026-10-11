import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isAdminEmail } from '../../config/admin';
import {
  approveExistingAccounts,
  loadAdminOverview,
  setAccountStatus,
  type AdminOverview,
  type AdminUserRow,
  type ApprovalStatus,
  type UsageLevel,
} from '../../services/adminService';
import { useReadyAuth } from '../auth/AuthContext';

const USAGE_LABEL: Record<UsageLevel, string> = {
  high: 'שימוש גבוה',
  medium: 'שימוש בינוני',
  low: 'שימוש נמוך',
  idle: 'לא פעיל',
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  approved: 'מאושר',
  pending: 'ממתין לאישור',
  blocked: 'חסום',
  none: 'בלי החלטה',
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
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const change = async (row: AdminUserRow, status: 'approved' | 'pending' | 'blocked') => {
    setBusyUid(row.uid);
    setActionError(null);
    setConfirmBlock(null);
    try {
      await setAccountStatus(row.uid, status);
      load();
    } catch {
      setActionError('הפעולה נכשלה. יש לבדוק חיבור ולנסות שוב.');
    } finally {
      setBusyUid(null);
    }
  };

  const approveAll = async () => {
    setConfirmAll(false);
    setActionError(null);
    try {
      const n = await approveExistingAccounts();
      setNotice(`אושרו ${n} חשבונות.`);
      load();
    } catch {
      setActionError('הפעולה נכשלה. יש לבדוק חיבור ולנסות שוב.');
    }
  };

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
                <div><dt>ממתינים לאישור</dt><dd>{data.totals.pending}</dd></div>
                <div><dt>בלי החלטה (קיימים)</dt><dd>{data.totals.undecided}</dd></div>
              </dl>
              {data.totals.pending + data.totals.undecided > 0 && (
                <div className="stack">
                  {confirmAll ? (
                    <div className="form-actions" role="alertdialog" aria-label="אישור">
                      <p className="muted small">
                        לאשר את כל החשבונות הממתינים והקיימים בלי החלטה? חשבונות חסומים לא ישתנו.
                      </p>
                      <button type="button" className="btn btn-primary" onClick={() => void approveAll()}>
                        כן, לאשר הכול
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setConfirmAll(false)}>
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirmAll(true)}>
                      אישור כל החשבונות הקיימים
                    </button>
                  )}
                </div>
              )}
              {notice ? <p className="muted small" role="status">{notice}</p> : null}
              {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
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
                      <span className="txc-chip">{STATUS_LABEL[u.status]}</span>
                    </span>
                  </div>
                  <div className="txc-note">
                    נרשם: {dateTime(u.createdAt)} · כניסה אחרונה: {dateTime(u.lastSignInAt)}
                  </div>
                  <div className="txc-note">
                    פעולות: {u.txTotal} בסך הכול, {u.tx7d} בשבוע האחרון
                  </div>
                  {isAdminEmail(u.email) ? null : confirmBlock === u.uid ? (
                    <div className="txc-confirm" role="alertdialog" aria-label="אישור חסימה">
                      <span>לחסום את החשבון? המשתמש ינותק ולא יוכל להיכנס.</span>
                      <span className="txc-confirm-actions">
                        <button type="button" className="btn btn-danger" onClick={() => void change(u, 'blocked')}>
                          כן, לחסום
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirmBlock(null)}>
                          ביטול
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="form-actions">
                      {u.status !== 'approved' && u.status !== 'blocked' && (
                        <button type="button" className="btn btn-primary" disabled={busyUid === u.uid} onClick={() => void change(u, 'approved')}>
                          אישור
                        </button>
                      )}
                      {u.status === 'blocked' ? (
                        <button type="button" className="btn btn-secondary" disabled={busyUid === u.uid} onClick={() => void change(u, 'approved')}>
                          ביטול חסימה
                        </button>
                      ) : (
                        <button type="button" className="btn btn-outline" disabled={busyUid === u.uid} onClick={() => setConfirmBlock(u.uid)}>
                          חסימה
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  );
}
