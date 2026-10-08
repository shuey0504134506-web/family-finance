import { useState } from 'react';
import { transactionsToCsv } from '../../domain/export';
import { exportAllData } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';

function download(filename: string, content: string, type: string) {
  // BOM בתחילת CSV כדי שאקסל יזהה עברית נכון.
  const blob = new Blob([type.startsWith('text/csv') ? `\uFEFF${content}` : content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** יצוא וגיבוי. הקבצים נשמרים במכשיר בלבד ואינם נשלחים לשום מקום. */
export function DataSection() {
  const { user } = useReadyAuth();
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (kind: 'json' | 'csv') => {
    if (busy) return;
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      const { backup, transactions } = await exportAllData(user.uid);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'json') {
        download(`גיבוי-ניהול-כספים-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      } else {
        download(`פעולות-${stamp}.csv`, transactionsToCsv(transactions), 'text/csv;charset=utf-8');
      }
      setMessage(`הקובץ הורד למכשיר (${transactions.length} פעולות).`);
    } catch {
      setError('לא הצלחנו לקרוא את הנתונים. יש לבדוק את החיבור ולנסות שוב.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
        <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void run('json')}>
          {busy === 'json' ? 'מכין…' : 'הורדת גיבוי מלא (JSON)'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void run('csv')}>
          {busy === 'csv' ? 'מכין…' : 'הורדת הפעולות לאקסל (CSV)'}
        </button>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="form-success" role="status">
            {message}
          </div>
        )}
        <p className="muted small">הקבצים נשמרים במכשיר בלבד. כדאי לשמור גיבוי במקום בטוח מדי פעם.</p>
    </div>
  );
}
