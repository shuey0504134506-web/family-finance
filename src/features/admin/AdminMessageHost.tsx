import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { replyToMessage, type AdminMessage } from '../../services/adminService';
import { useAdminMessages } from './useAdminMessages';

const SEEN_KEY = 'ff.admin.msgSeen';

function readSeen(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function dateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * חלון קופץ למנהל על המסך הראשי כשמגיעה הודעה חדשה, עם אפשרות מענה בלי לעבור לניהול.
 * מוצג רק למנהל, והודעה שנסגרה לא קופצת שוב באותו מכשיר. במסך הניהול עצמו לא קופץ, כי שם רואים את ההודעות.
 */
export function AdminMessageHost() {
  const { list } = useAdminMessages();
  const location = useLocation();
  const [seen, setSeen] = useState<string[]>(readSeen);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // הישנה ביותר שעדיין לא נראתה וללא מענה, כדי לטפל בהן לפי סדר ההגעה
  const next: AdminMessage | undefined = useMemo(
    () => [...(list ?? [])].reverse().find((m) => !m.reply && !seen.includes(m.id)),
    [list, seen],
  );

  if (!next || location.pathname.startsWith('/admin')) return null;

  const markSeen = () => {
    const updated = [...seen, next.id].slice(-300);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
    } catch {
      // אחסון חסום: ההודעה תקפוץ שוב בפתיחה הבאה
    }
    setSeen(updated);
    setDraft('');
    setError(null);
  };

  const reply = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await replyToMessage(next.id, draft.trim());
      markSeen();
    } catch {
      setError('המענה לא נשלח. יש לנסות שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="הודעה חדשה מחשבון" onClose={() => undefined}>
      <div className="stack">
        <p className="txc-title" dir="ltr">{next.email || 'שולח ישן (האימייל לא נשמר). השם יופיע בשורת ההודעות'}</p>
        <p className="txc-note">{dateTime(next.createdAt)}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{next.text}</p>
        <label className="field-label" htmlFor="admin-popup-reply">מענה (קופץ אצל המשתמש)</label>
        <textarea id="admin-popup-reply" className="input" rows={3} maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)} />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !draft.trim()} onClick={() => void reply()}>
            שליחת מענה
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={markSeen}>
            אענה אחר כך
          </button>
        </div>
      </div>
    </Modal>
  );
}
