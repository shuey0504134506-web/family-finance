import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isAdminEmail } from '../../config/admin';
import {
  approveExistingAccounts,
  deleteAccountByAdmin,
  deleteMessage,
  replyToMessage,
  type AdminMessage,
  loadAdminLog,
  loadAdminOverview,
  sendNoticeToGroup,
  setAccountNote,
  type AdminLogEntry,
  setAccountStatus,
  setApprovalRequired,
  subscribeApprovalRequired,
  sendNotice,
  setPaymentRequest,
  type AdminOverview,
  type AdminUserRow,
  type ApprovalStatus,
  type PaymentRequest,
  type UsageLevel,
} from '../../services/adminService';
import { saveFile } from '../../native/saveFile';
import {
  accountsCsv,
  FILTER_LABEL,
  logLine,
  matchesFilter,
  platformLabel,
  REPLY_TEMPLATES,
  sortAccounts,
  SORT_LABEL,
  type AccountFilter,
  type AccountSort,
} from './adminTools';
import { AccordionItem } from '../settings/Accordion';
import { useReadyAuth } from '../auth/AuthContext';
import { useAdminMessages } from './useAdminMessages';
import { useRevealOpen } from '../../hooks/useRevealOpen';

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

/** כשדרישת האישור כבויה, חשבון "ממתין" בפועל נכנס רגיל, ולכן לא מציגים אותו כממתין. */
function statusLabel(status: ApprovalStatus, required: boolean | null): string {
  return status === 'pending' && required === false ? 'פעיל (בלי אישור)' : STATUS_LABEL[status];
}

function dateOnly(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** YYYY-MM-DD של התאריך המקומי, לשדה תאריך */
function inputDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** המועד הוא סוף היום שנבחר (23:59 בשעון המכשיר). */
function endOfDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59).getTime();
}

function PaymentForm({
  row,
  onSaved,
  onCancel,
}: {
  row: AdminUserRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const existing = row.payment;
  const [date, setDate] = useState(existing ? inputDate(existing.dueAt) : '');
  const [amountText, setAmountText] = useState(existing?.amountText ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [message, setMessage] = useState(existing?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (payment: PaymentRequest | null) => {
    setBusy(true);
    setError(null);
    try {
      await setPaymentRequest(row.uid, payment);
      onSaved();
    } catch (e) {
      const msg = (e as { message?: string }).message;
      setError(msg && /https/.test(msg) ? 'קישור התשלום חייב להתחיל ב-https://' : 'השמירה נכשלה. יש לבדוק את הפרטים ולנסות שוב.');
      setBusy(false);
    }
  };

  const save = () => {
    const dueAt = endOfDay(date);
    if (dueAt === null) {
      setError('יש לבחור מועד נעילה.');
      return;
    }
    void run({ dueAt, amountText: amountText.trim(), url: url.trim(), message: message.trim() });
  };

  return (
    <div className="stack" role="group" aria-label="דרישת תשלום">
      <label className="field-label" htmlFor={`pay-date-${row.uid}`}>נעילה בסוף היום</label>
      <input id={`pay-date-${row.uid}`} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="field-label" htmlFor={`pay-amount-${row.uid}`}>סכום (טקסט חופשי, לא חובה)</label>
      <input id={`pay-amount-${row.uid}`} className="input" maxLength={60} value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="לדוגמה: 50 ₪ לחודש" />
      <label className="field-label" htmlFor={`pay-url-${row.uid}`}>קישור לתשלום (לא חובה)</label>
      <input id={`pay-url-${row.uid}`} className="input" dir="ltr" inputMode="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      <label className="field-label" htmlFor={`pay-msg-${row.uid}`}>הודעה למשתמש (לא חובה)</label>
      <textarea id={`pay-msg-${row.uid}`} className="input" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      <p className="muted small">עד מועד הנעילה מוצג למשתמש פס תזכורת בשבוע האחרון. אחריו האפליקציה ננעלת, והנתונים נשמרים.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>שמירה</button>
        {existing ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run(null)}>הסרת דרישת תשלום</button>
        ) : null}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function NoticeForm({
  target,
  groupUids,
  existing,
  onDone,
  onCancel,
}: {
  /** מזהה חשבון, 'all', או 'group' (עם groupUids) */
  target: string;
  groupUids?: string[];
  existing?: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (remove: boolean) => {
    if (!remove && !text.trim()) {
      setError('יש לכתוב הודעה.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sent = groupUids
        ? await sendNoticeToGroup(groupUids, title.trim(), text.trim())
        : await sendNotice(target, title.trim(), remove ? '' : text.trim());
      onDone(remove ? 'ההודעה הוסרה.' : target === 'all' || groupUids ? `ההודעה נשלחה ל-${sent} חשבונות.` : 'ההודעה נשלחה. תקפוץ אצל המשתמש כשיפתח את האפליקציה.');
    } catch {
      setError('השליחה נכשלה. יש לבדוק חיבור ולנסות שוב.');
      setBusy(false);
    }
  };

  return (
    <div className="stack" role="group" aria-label="שליחת הודעה">
      <label className="field-label" htmlFor={`notice-title-${target}`}>כותרת (לא חובה)</label>
      <input id={`notice-title-${target}`} className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field-label" htmlFor={`notice-text-${target}`}>
        {target === 'all' ? 'הודעה לכל החשבונות המאושרים' : groupUids ? `הודעה ל-${groupUids.length} החשבונות המסוננים` : 'הודעה'}
      </label>
      <textarea id={`notice-text-${target}`} className="input" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      <p className="muted small">ההודעה קופצת מיד אם האפליקציה פתוחה, או בפתיחה הבאה, ונשארת עד שהמשתמש לוחץ "הבנתי".</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(false)}>שליחה</button>
        {existing ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run(true)}>הסרת ההודעה הקיימת</button>
        ) : null}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function Messages({
  list,
  loadError,
  search,
  emailOf,
}: {
  list: AdminMessage[] | null;
  loadError: boolean;
  search: string;
  /** אימייל לפי מזהה חשבון, להודעות ישנות שנשמרו בלי אימייל */
  emailOf: ReadonlyMap<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (m: AdminMessage) => {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await replyToMessage(m.id, draft.trim());
      setReplyId(null);
      setDraft('');
    } catch {
      setError('המענה לא נשלח. יש לנסות שוב.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: AdminMessage) => {
    setBusy(true);
    setError(null);
    try {
      await deleteMessage(m.id);
    } catch {
      setError('המחיקה נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = (list ?? []).filter(
    (m) => !q || `${m.email || emailOf.get(m.uid) || ''} ${m.text} ${m.reply}`.toLowerCase().includes(q),
  );
  return (
    <div className="stack">
      {loadError ? (
        <p className="form-error" role="alert">
          לא הצלחנו לטעון את ההודעות. ייתכן שכללי Firestore החדשים עוד לא פורסמו.
        </p>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {list && shown.length === 0 ? <p className="muted">{q ? 'לא נמצאו הודעות.' : 'אין הודעות.'}</p> : null}
      <ul className="tx-list admin-list" aria-label="הודעות">
        {shown.map((m) => (
          <li key={m.id} className="txc">
            <div className="txc-top">
              <span className="txc-title" dir="ltr">{m.email || emailOf.get(m.uid) || 'חשבון שנמחק'}</span>
            </div>
            <div className="txc-note">{dateTime(m.createdAt)}{m.reply ? '' : ' · ללא מענה'}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            {m.reply ? (
              <div className="txc-note" style={{ whiteSpace: 'pre-wrap' }}>
                {`עניתי (${dateTime(m.repliedAt)}): ${m.reply}`}
              </div>
            ) : null}
            {replyId === m.id ? (
              <div className="stack">
                <label className="field-label" htmlFor={`reply-${m.id}`}>תשובה (קופצת אצל המשתמש)</label>
                <div className="form-actions" aria-label="תבניות תשובה">
                  {REPLY_TEMPLATES.map((t) => (
                    <button key={t.label} type="button" className="btn btn-outline btn-small" onClick={() => setDraft(t.text)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea id={`reply-${m.id}`} className="input" rows={3} maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send(m)}>שליחת תשובה</button>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setReplyId(null)}>ביטול</button>
                </div>
              </div>
            ) : (
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setReplyId(m.id); setDraft(''); }}>
                  {m.reply ? 'מענה נוסף' : 'מענה'}
                </button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void remove(m)}>
                  מחיקה
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="search"
      className="input"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

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
  const [payingUid, setPayingUid] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [noticeFor, setNoticeFor] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useRevealOpen(openId);
  const [openDay, setOpenDay] = useState<string | null>(null);
  // פרטי בעל החשבון: פתוחים כברירת מחדל בחשבון שממתין להחלטה, וניתנים להצגה והסתרה בכפתור
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [accountSearch, setAccountSearch] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');
  const [sort, setSort] = useState<AccountSort>('lastSeen');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [log, setLog] = useState<AdminLogEntry[] | null>(null);
  const [logError, setLogError] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const messages = useAdminMessages();
  const unanswered = messages.list?.filter((m) => !m.reply).length ?? 0;
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalRequired, setApprovalRequiredState] = useState<boolean | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  useEffect(() => subscribeApprovalRequired(setApprovalRequiredState), []);
  const toggleApproval = async () => {
    if (approvalRequired === null) return;
    setApprovalBusy(true);
    setActionError(null);
    try {
      await setApprovalRequired(!approvalRequired);
    } catch {
      setActionError('השינוי נכשל. אם כללי האבטחה החדשים עוד לא פורסמו, יש לפרוס אותם קודם. אחרת, לבדוק חיבור ולנסות שוב.');
    } finally {
      setApprovalBusy(false);
    }
  };

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

  const remove = async (row: AdminUserRow) => {
    setBusyUid(row.uid);
    setActionError(null);
    setConfirmDelete(null);
    try {
      await deleteAccountByAdmin(row.uid);
      setNotice('החשבון נמחק.');
      load();
    } catch {
      setActionError('המחיקה נכשלה. יש לבדוק חיבור ולנסות שוב.');
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

  const exportCsv = async () => {
    setActionError(null);
    try {
      await saveFile('accounts.csv', accountsCsv(filteredUsers), 'text/csv;charset=utf-8');
    } catch {
      setActionError('הייצוא נכשל.');
    }
  };
  const saveNote = async (uid: string) => {
    setActionError(null);
    try {
      await setAccountNote(uid, noteDraft);
      setNoteFor(null);
      load();
    } catch {
      setActionError('שמירת ההערה נכשלה. יש לבדוק חיבור ולנסות שוב.');
    }
  };
  const loadLogNow = () => {
    setLogError(false);
    loadAdminLog().then(setLog).catch(() => setLogError(true));
  };

  const emailOf = new Map((data?.users ?? []).map((u) => [u.uid, u.email] as const));
  const aq = accountSearch.trim().toLowerCase();
  // חשבון המנהל תמיד ראשון
  const filteredUsers = sortAccounts(data?.users ?? [], sort)
    .filter((u) => matchesFilter(u, filter, data?.generatedAt ?? 0))
    .filter((u) => !aq || `${u.email} ${statusLabel(u.status, approvalRequired)} ${USAGE_LABEL[u.usage]} ${isAdminEmail(u.email) ? 'חשבון מנהל' : ''}`.toLowerCase().includes(aq))
    .sort((a, b) => Number(isAdminEmail(b.email)) - Number(isAdminEmail(a.email)));

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
            <div className="acc-list">
              <AccordionItem id="summary" title="סיכום כללי" open={openId === 'summary'} onToggle={toggle}>
                <div className="stack">
              <dl className="detail-list">
                <div><dt>חשבונות</dt><dd>{data.totals.accounts}</dd></div>
                <div><dt>נכנסו ב-24 שעות</dt><dd>{data.totals.active24h}</dd></div>
                <div><dt>נכנסו בשבוע</dt><dd>{data.totals.active7d}</dd></div>
                <div><dt>נכנסו בחודש</dt><dd>{data.totals.active30d}</dd></div>
                <div><dt>חשבונות חדשים בשבוע</dt><dd>{data.totals.newLast7d}</dd></div>
                <div><dt>חסומים</dt><dd>{data.totals.disabled}</dd></div>
                <div><dt>עם דרישת תשלום</dt><dd>{data.totals.paymentRequired}</dd></div>
                <div><dt>{approvalRequired === false ? 'נרשמו בלי אישור (הדרישה כבויה)' : 'ממתינים לאישור'}</dt><dd>{data.totals.pending}</dd></div>
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

                </div>
              </AccordionItem>

              <AccordionItem id="approval" title="אישור חשבונות חדשים" open={openId === 'approval'} onToggle={toggle}>
                <div className="stack">
                  <p>
                    {approvalRequired === null
                      ? 'טוען…'
                      : approvalRequired
                        ? 'דרישת האישור פעילה: חשבון חדש ממתין עד שתאשר אותו.'
                        : 'דרישת האישור כבויה: חשבון חדש נכנס ומשתמש באפליקציה מיד, בלי אישור.'}
                  </p>
                  <p className="muted small">
                    אפשר להפעיל או לכבות בכל עת. כשהיא מופעלת, חשבונות ממתינים נעצרים עד אישור, וחשבונות שכבר אושרו ממשיכים כרגיל.
                  </p>
                  <button
                    type="button"
                    className={approvalRequired ? 'btn btn-secondary' : 'btn btn-primary'}
                    disabled={approvalRequired === null || approvalBusy}
                    onClick={() => void toggleApproval()}
                  >
                    {approvalRequired ? 'כיבוי דרישת האישור' : 'הפעלת דרישת אישור'}
                  </button>
                </div>
              </AccordionItem>

              <AccordionItem id="activity" title="כניסות לאפליקציה (14 ימים)" open={openId === 'activity'} onToggle={toggle}>
                <div className="stack">
              <ul className="share-list" aria-label="פתיחות לפי יום">
                {data.daily.map((d) => {
                  const max = Math.max(1, ...data.daily.map((x) => x.opens));
                  const isOpen = openDay === d.date;
                  return (
                    <li key={d.date}>
                      <button
                        type="button"
                        className="day-btn"
                        aria-expanded={isOpen}
                        disabled={d.opens === 0}
                        onClick={() => setOpenDay(isOpen ? null : d.date)}
                      >
                        <span className="row-between">
                          <span>{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                          <span>{d.opens} פתיחות · {d.activeAccounts} חשבונות</span>
                        </span>
                        <span className="share-bar share-income" aria-hidden="true">
                          <span style={{ width: `${d.opens === 0 ? 0 : Math.max(2, (d.opens / max) * 100)}%` }} />
                        </span>
                      </button>
                      {isOpen ? (
                        d.accounts ? (
                          <ul className="day-accounts">
                            {d.accounts.map((a) => (
                              <li key={a.uid} className="row-between">
                                <span className="day-email">{a.email || a.uid}</span>
                                <span>{a.opens} פתיחות</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">הפירוט לפי חשבון זמין אחרי פריסה מחדש של פונקציות השרת.</p>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
                </div>
              </AccordionItem>

              <AccordionItem id="messages" title={`הודעות ממשתמשים${unanswered > 0 ? ` (${unanswered} ללא מענה)` : ""}`} open={openId === 'messages'} onToggle={toggle}>
                <div className="stack">
                {noticeFor === 'all' ? (
                  <NoticeForm
                    target="all"
                    onCancel={() => setNoticeFor(null)}
                    onDone={(m) => {
                      setNoticeFor(null);
                      setNotice(m);
                    }}
                  />
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => setNoticeFor('all')}>
                    הודעה לכל החשבונות
                  </button>
                )}
                  {notice ? <p className="muted small" role="status">{notice}</p> : null}
                  <SearchBox value={messageSearch} onChange={setMessageSearch} label="חיפוש בהודעות" />
                  <Messages list={messages.list} loadError={messages.error} search={messageSearch} emailOf={emailOf} />
                </div>
              </AccordionItem>

              <AccordionItem id="clients" title="פלטפורמות וגרסאות" open={openId === 'clients'} onToggle={toggle}>
                <div className="stack">
                  {data.platforms ? (
                    <>
                      <dl className="detail-list">
                        {Object.entries(data.platforms).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                          <div key={k}><dt>{platformLabel(k)}</dt><dd>{n}</dd></div>
                        ))}
                      </dl>
                      {data.versions && Object.keys(data.versions).length > 0 ? (
                        <>
                          <h3 className="section-title">גרסאות בשימוש</h3>
                          <dl className="detail-list">
                            {Object.entries(data.versions).sort((a, b) => b[0].localeCompare(a[0], 'en', { numeric: true })).map(([k, n]) => {
                              const [plat, ...ver] = k.split(' ');
                              return <div key={k}><dt dir="auto">{`${platformLabel(plat)} ${ver.join(' ')}`.trim()}</dt><dd>{n}</dd></div>;
                            })}
                          </dl>
                        </>
                      ) : null}
                      <p className="muted small">לפי הפתיחה האחרונה של כל חשבון. חשבון שלא פתח את האפליקציה מאז העדכון מופיע כ"לא ידוע".</p>
                    </>
                  ) : (
                    <p className="muted small">הנתונים יופיעו אחרי פריסה מחדש של פונקציות השרת.</p>
                  )}
                </div>
              </AccordionItem>

              <AccordionItem id="signups" title="הרשמות לפי שבוע" open={openId === 'signups'} onToggle={toggle}>
                <div className="stack">
                  {data.signups ? (
                    <ul className="share-list" aria-label="הרשמות לפי שבוע">
                      {data.signups.map((w) => {
                        const max = Math.max(1, ...data.signups!.map((x) => x.count));
                        return (
                          <li key={w.weekStart}>
                            <span className="row-between">
                              <span>{`שבוע מ-${w.weekStart.slice(8)}/${w.weekStart.slice(5, 7)}`}</span>
                              <span>{w.count} הרשמות</span>
                            </span>
                            <span className="share-bar share-income" aria-hidden="true">
                              <span style={{ width: `${w.count === 0 ? 0 : Math.max(2, (w.count / max) * 100)}%` }} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted small">הנתונים יופיעו אחרי פריסה מחדש של פונקציות השרת.</p>
                  )}
                </div>
              </AccordionItem>

              <AccordionItem
                id="log"
                title="יומן פעולות מנהל"
                open={openId === 'log'}
                onToggle={(id) => {
                  toggle(id);
                  if (openId !== 'log' && log === null) loadLogNow();
                }}
              >
                <div className="stack">
                  {logError ? <p className="form-error" role="alert">לא הצלחנו לטעון את היומן.</p> : null}
                  {log && log.length === 0 ? <p className="muted">עוד לא נרשמו פעולות.</p> : null}
                  <ul className="tx-list admin-list" aria-label="יומן פעולות">
                    {(log ?? []).map((e) => (
                      <li key={e.id} className="txc">
                        <div dir="auto">{logLine(e)}</div>
                        <div className="txc-note">{dateTime(e.at)}</div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn btn-secondary" onClick={loadLogNow}>רענון היומן</button>
                </div>
              </AccordionItem>

              <AccordionItem id="accounts" title={`חשבונות (${data.users.length})`} open={openId === 'accounts'} onToggle={toggle}>
                <div className="stack">
                  <SearchBox value={accountSearch} onChange={setAccountSearch} label="חיפוש חשבון לפי אימייל או סטטוס" />
                  <div className="form-actions" role="group" aria-label="סינון">
                    {(Object.keys(FILTER_LABEL) as AccountFilter[]).map((f) => (
                      <button key={f} type="button" className={`btn btn-small ${filter === f ? 'btn-primary' : 'btn-outline'}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                        {FILTER_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  <label className="field-label" htmlFor="acc-sort">מיון לפי</label>
                  <select id="acc-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as AccountSort)}>
                    {(Object.keys(SORT_LABEL) as AccountSort[]).map((k) => (
                      <option key={k} value={k}>{SORT_LABEL[k]}</option>
                    ))}
                  </select>
                  <p className="muted small">{`מוצגים ${filteredUsers.length} חשבונות`}</p>
                  <div className="form-actions">
                    <button type="button" className="btn btn-outline" disabled={filteredUsers.length === 0} onClick={() => void exportCsv()}>
                      ייצוא לאקסל (CSV)
                    </button>
                    {noticeFor !== 'group' ? (
                      <button type="button" className="btn btn-outline" disabled={filteredUsers.length === 0} onClick={() => setNoticeFor('group')}>
                        הודעה לחשבונות המסוננים
                      </button>
                    ) : null}
                  </div>
                  {noticeFor === 'group' ? (
                    <NoticeForm
                      target="group"
                      groupUids={filteredUsers.filter((u) => !isAdminEmail(u.email)).map((u) => u.uid)}
                      onCancel={() => setNoticeFor(null)}
                      onDone={(m) => {
                        setNoticeFor(null);
                        setNotice(m);
                      }}
                    />
                  ) : null}
            <ul className="tx-list admin-list" aria-label="חשבונות">
              {filteredUsers.map((u) => (
                <li key={u.uid} className={`txc${isAdminEmail(u.email) ? ' txc-admin' : ''}`}>
                  <div className="txc-top">
                    <span className="txc-title" dir="ltr">{u.email || u.uid}</span>
                  </div>
                  <div className="txc-mid">
                    <span className="txc-chips">
                      {isAdminEmail(u.email) ? <span className="txc-chip txc-chip-admin">חשבון מנהל</span> : null}
                      <span className="txc-chip">{USAGE_LABEL[u.usage]}</span>
                      <span className="txc-chip">{statusLabel(u.status, approvalRequired)}</span>
                      {u.client ? <span className="txc-chip" dir="auto">{`${platformLabel(u.client.platform)}${u.client.version ? ` ${u.client.version}` : ''}`}</span> : null}
                      {u.notice ? <span className="txc-chip">הודעה פעילה</span> : null}
                      {u.payment ? (
                        <span className="txc-chip">
                          {u.payment.dueAt <= data.generatedAt ? 'נעול לתשלום' : `תשלום עד ${dateOnly(u.payment.dueAt)}`}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {(() => {
                    const open = detailsOpen[u.uid] ?? ((u.status === 'pending' && approvalRequired !== false) || u.status === 'none');
                    const d = u.details;
                    const empty = 'לא הוזן';
                    return (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          aria-expanded={open}
                          onClick={() => setDetailsOpen((m) => ({ ...m, [u.uid]: !open }))}
                        >
                          {open ? 'הסתרת פרטים' : 'הצגת פרטים'}
                        </button>
                        {open ? (
                          d ? (
                            <dl className="admin-details">
                              <div>
                                <dt>שם</dt>
                                <dd>{`${d.firstName} ${d.lastName}`.trim() || empty}</dd>
                              </div>
                              <div>
                                <dt>טלפון</dt>
                                <dd dir="ltr">{d.phone || empty}</dd>
                              </div>
                              <div>
                                <dt>מייל</dt>
                                <dd dir="ltr">{u.email || empty}</dd>
                              </div>
                              <div>
                                <dt>שם העסק</dt>
                                <dd>{d.businessName || empty}</dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="muted small">הפרטים יוצגו אחרי פריסה מחדש של פונקציות השרת.</p>
                          )
                        ) : null}
                      </>
                    );
                  })()}
                  <div className="txc-note">
                    נרשם: {dateTime(u.createdAt)} · כניסה אחרונה: {dateTime(u.lastSignInAt)}
                  </div>
                  {noteFor === u.uid ? (
                    <div className="stack">
                      <label className="field-label" htmlFor={`note-${u.uid}`}>הערה פרטית (רק אתה רואה)</label>
                      <textarea id={`note-${u.uid}`} className="input" rows={2} maxLength={500} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                      <div className="form-actions">
                        <button type="button" className="btn btn-primary" onClick={() => void saveNote(u.uid)}>שמירה</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setNoteFor(null)}>ביטול</button>
                      </div>
                    </div>
                  ) : (
                    <div className="txc-note" style={{ whiteSpace: 'pre-wrap' }}>
                      {u.note ? `הערה: ${u.note} ` : ''}
                      <button type="button" className="link-btn" onClick={() => { setNoteFor(u.uid); setNoteDraft(u.note ?? ''); }}>
                        {u.note ? 'עריכת הערה' : 'הוספת הערה'}
                      </button>
                    </div>
                  )}
                  <div className="txc-note">
                    פעולות: {u.txTotal} בסך הכול, {u.tx7d} בשבוע האחרון · פתיחות בשבוע: {u.opens7d}
                  </div>
                  {isAdminEmail(u.email) ? null : noticeFor === u.uid ? (
                    <NoticeForm
                      target={u.uid}
                      existing={Boolean(u.notice)}
                      onCancel={() => setNoticeFor(null)}
                      onDone={(m) => {
                        setNoticeFor(null);
                        setNotice(m);
                        load();
                      }}
                    />
                  ) : payingUid === u.uid ? (
                    <PaymentForm
                      row={u}
                      onCancel={() => setPayingUid(null)}
                      onSaved={() => {
                        setPayingUid(null);
                        load();
                      }}
                    />
                  ) : confirmDelete === u.uid ? (
                    <div className="txc-confirm" role="alertdialog" aria-label="אישור מחיקה">
                      <span dir="auto">למחוק לצמיתות את {u.email} וכל הנתונים שלו? אי אפשר לשחזר.</span>
                      <span className="txc-confirm-actions">
                        <button type="button" className="btn btn-danger" onClick={() => void remove(u)}>
                          כן, למחוק
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                          ביטול
                        </button>
                      </span>
                    </div>
                  ) : confirmBlock === u.uid ? (
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
                      <button type="button" className="btn btn-outline" onClick={() => setPayingUid(u.uid)}>
                        {u.payment ? 'עריכת תשלום' : 'דרישת תשלום'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => setNoticeFor(u.uid)}>
                        הודעה
                      </button>
                      {u.status !== 'approved' && u.status !== 'blocked' && (
                        <button type="button" className="btn btn-primary" disabled={busyUid === u.uid} onClick={() => void change(u, 'approved')}>
                          אישור
                        </button>
                      )}
                      {u.status === 'blocked' ? (
                        <button type="button" className="btn btn-outline" disabled={busyUid === u.uid} onClick={() => void change(u, 'approved')}>
                          ביטול חסימה
                        </button>
                      ) : (
                        <button type="button" className="btn btn-outline" disabled={busyUid === u.uid} onClick={() => setConfirmBlock(u.uid)}>
                          חסימה
                        </button>
                      )}
                      <button type="button" className="btn btn-outline" disabled={busyUid === u.uid} onClick={() => setConfirmDelete(u.uid)}>
                        מחיקה
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
                </div>
              </AccordionItem>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
