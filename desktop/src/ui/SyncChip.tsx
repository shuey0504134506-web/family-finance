import { useState } from 'react';
import { useController, useUi } from './useController';

const fmt = (t: number | null) => (t ? new Date(t).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : 'עוד לא');

/** מצב הסנכרון במבט אחד: מקומי בלבד, מסונכרן, ממתין לחיבור, או סנכרון בעיצומו. */
export function SyncChip() {
  const ui = useUi();
  const c = useController();
  const [open, setOpen] = useState(false);
  const s = ui.sync;
  let text: string;
  let tone: string;
  if (s.kind === 'local') { text = 'חשבון מנותק · הנתונים במחשב בלבד'; tone = 'local'; }
  else if (ui.needsPasswordSync) { text = 'הסיסמה שונתה במקום אחר'; tone = 'warn'; }
  else if (s.kind === 'offline' || !ui.online) { text = s.pending > 0 ? `אין חיבור · ${s.pending} שינויים ממתינים` : 'אין חיבור · נשמר במחשב'; tone = 'offline'; }
  else if (s.kind === 'syncing') { text = 'מסנכרן…'; tone = 'sync'; }
  else if (s.kind === 'error') { text = `${s.failed} שינויים לא סונכרנו`; tone = 'warn'; }
  else { text = s.pending > 0 ? `${s.pending} שינויים ממתינים` : 'מסונכרן'; tone = 'ok'; }

  return (
    <div className={`sync-chip sync-${tone}`} role="status" aria-live="polite">
      <button type="button" className="sync-chip-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sync-dot" aria-hidden="true" /> {text}
      </button>
      {open && (
        <div className="sync-detail">
          {s.kind === 'local' ? <p className="muted small">החשבון הזה מנותק לצמיתות: שום דבר ממנו לא נשלח לשרת, גם כשיש אינטרנט.</p> : (
            <>
              <p className="muted small">סנכרון אחרון: {fmt(s.lastSync)}</p>
              <button type="button" className="chip-btn" disabled={!ui.online} onClick={() => void c.syncNow()}>סנכרון עכשיו</button>
            </>
          )}
          {ui.needsPasswordSync && <AdoptPassword />}
        </div>
      )}
    </div>
  );
}

function AdoptPassword() {
  const c = useController();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <form className="sync-adopt" onSubmit={(e) => { e.preventDefault(); void c.adoptCloudPassword(pw).catch(() => setErr('הסיסמה שגויה')); }}>
      <label className="small">הסיסמה החדשה של החשבון</label>
      <input className="input" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <div className="field-error">{err}</div>}
      <button type="submit" className="chip-btn">עדכון</button>
    </form>
  );
}
