import { useEffect, useState } from 'react';
import { loadAdminAi, setAiActionsAccess, setAiActionsEnabled, type AdminAiInfo, type AdminUserRow } from '../../services/adminService';

export function AiActionsAdminSection({ users }: { users: AdminUserRow[] }) {
  const [info, setInfo] = useState<AdminAiInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  async function refresh(change?: () => Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      if (change) await change();
      setInfo(await loadAdminAi());
    } catch {
      setError(true);
    } finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const access = new Set(info?.actionsAccessUids ?? []);
  const enabled = info?.actionsEnabled === true;
  return <div className="stack">
    <p className="muted small">הרשאה נפרדת מסקירת AI. יצירת פעולות משתמשת באותם ספקים ובאותן מכסות, ורק לאחר אישור המשתמש.</p>
    {error && <div className="form-error" role="alert">הפעולה נכשלה. יש לנסות שוב.<button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void refresh()}>ניסיון חוזר</button></div>}
    {!info ? (!error && <p role="status">טוען…</p>) : <>
      <dl className="detail-list"><div><dt>מורשים</dt><dd>{access.size}</dd></div></dl>
      <button type="button" className="btn btn-secondary" aria-pressed={enabled} disabled={busy} onClick={() => void refresh(() => setAiActionsEnabled(!enabled))}>{enabled ? 'כיבוי יצירת פעולות באמצעות AI' : 'הפעלת יצירת פעולות באמצעות AI'}</button>
      {!enabled && <p className="muted small">יצירת פעולות באמצעות AI כבויה לכולם.</p>}
      <h3 className="subhead">מי מורשה</h3>
      <input className="input" aria-label="חיפוש חשבון לפי אימייל" placeholder="חיפוש לפי אימייל" value={search} onChange={e => setSearch(e.target.value)} />
      <ul className="ai-saved">{users.filter(u => u.email.toLowerCase().includes(search.trim().toLowerCase())).map(u => <li key={u.uid} className="ai-saved-row">
        <span className="ai-saved-main">{u.email}</span>
        <button type="button" className={`btn btn-small ${access.has(u.uid) ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} aria-pressed={access.has(u.uid)} onClick={() => void refresh(() => setAiActionsAccess(u.uid, !access.has(u.uid)))}>{access.has(u.uid) ? 'מורשה' : 'ללא גישה'}</button>
      </li>)}</ul>
    </>}
  </div>;
}
