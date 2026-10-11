import { useEffect, useState, type FormEvent } from 'react';
import { MAX_MESSAGE_LENGTH, sendMessageToAdmin, subscribeMyMessages, type UserMessage } from '../../services/messageService';
import { useAuth } from '../auth/AuthContext';

function when(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * פנייה למנהל האפליקציה, בסוף מדיניות הפרטיות. זמין למשתמש מחובר בלבד,
 * כדי שהמנהל ידע ממי ההודעה ויוכל להשיב. התשובה קופצת למשתמש כשהוא פותח את האפליקציה.
 */
export function ContactAdmin() {
  const { state } = useAuth();
  const user = 'user' in state ? state.user : null;
  if (!user) {
    return (
      <p className="muted">לשליחת הודעה למנהל האפליקציה יש להתחבר לחשבון. אפשר גם לפנות בטלפון שלמעלה.</p>
    );
  }
  return <Form uid={user.uid} email={user.email} />;
}

function Form({ uid, email }: { uid: string; email: string | null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<UserMessage[]>([]);

  useEffect(() => subscribeMyMessages(uid, setMine, () => setMine([])), [uid]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('יש לכתוב הודעה.');
      return;
    }
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await sendMessageToAdmin(uid, email, text);
      setText('');
      setSent(true);
    } catch {
      setError('לא הצלחנו לשלוח את ההודעה. יש לבדוק חיבור ולנסות שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <label className="field-label" htmlFor="contact-admin-text">
          ההודעה שלך
        </label>
        <textarea
          id="contact-admin-text"
          className="input"
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {sent ? <p className="muted" role="status">ההודעה נשלחה. אם תהיה תשובה, היא תקפוץ כשתפתח את האפליקציה.</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'שולח…' : 'שליחת הודעה למנהל'}
        </button>
      </form>
      {mine.length > 0 && (
        <>
          <h3 className="subhead">ההודעות ששלחתי</h3>
          <ul className="tx-list" aria-label="ההודעות ששלחתי">
            {mine.slice(0, 10).map((m) => (
              <li key={m.id} className="txc">
                <div className="txc-note">{when(m.createdAt)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {m.reply ? (
                  <div className="txc-note" style={{ whiteSpace: 'pre-wrap' }}>
                    {`תשובת המנהל (${when(m.repliedAt ?? 0)}): ${m.reply}`}
                  </div>
                ) : (
                  <div className="txc-note">ממתינה לתשובה</div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
