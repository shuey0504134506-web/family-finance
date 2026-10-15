import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { derivedCandidates } from '../core/recovery';
import { RecoveryEditor } from './RecoveryEditor';
import { useController, useUi } from './useController';

/** שאלות שחזור הסיסמה: מציג את המצב הנוכחי ומאפשר להחליף, כולל שאלות שנגזרות מהפעולות האחרונות. */
export function RecoverySettings() {
  const c = useController();
  const ui = useUi();
  const [editing, setEditing] = useState(!ui.recoveryQuestions);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const derived = useMemo(() => {
    const d = new Date();
    return derivedCandidates(c.txByScope(), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [c]);

  return (
    <div className="app-shell">
      <ScreenHeader title="שחזור סיסמה" />
      <main className="content">
        <p className="muted">
          {ui.me?.kind === 'offline'
            ? 'בחשבון מנותק אין שרת שיכול לאפס סיסמה. אם הסיסמה תישכח, שלוש התשובות הנכונות הן הדרך היחידה להיכנס לנתונים.'
            : 'שלוש התשובות מאפשרות להיכנס לנתונים שבמחשב הזה אם הסיסמה נשכחה. בחשבון מקוון אפשר גם לאפס סיסמה במייל.'}
        </p>
        {!editing && ui.recoveryQuestions && (
          <section className="card">
            <h2 className="recent-title">השאלות הנוכחיות</h2>
            <ol>{ui.recoveryQuestions.map((q, i) => <li key={i}>{q.text}{q.kind === 'derived' ? ' (מהפעולות שלך)' : ''}</li>)}</ol>
            {saved && <p className="muted" role="status">נשמר.</p>}
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>החלפת השאלות</button>
          </section>
        )}
        {editing && (
          <RecoveryEditor
            derived={derived}
            submitLabel="שמירת השאלות"
            busy={busy}
            error={error}
            onSubmit={(qs, ans) => {
              setBusy(true); setError('');
              void c.setRecovery(qs, ans).then(() => { setEditing(false); setSaved(true); }).catch(() => setError('השמירה נכשלה')).finally(() => setBusy(false));
            }}
          />
        )}
      </main>
    </div>
  );
}
