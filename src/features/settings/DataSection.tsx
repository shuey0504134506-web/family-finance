import { useRef, useState } from 'react';
import { transactionsToCsv } from '../../domain/export';
import { MAX_BACKUP_BYTES, parseBackup, type RestorePlan } from '../../domain/restore';
import { applyRestore, exportAllData, planNewData } from '../../services/accountService';
import { describeError } from '../../services/authErrors';
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

const countOf = (plan: RestorePlan) =>
  plan.categories.length + plan.budgets.length + plan.businessTransactions.length + plan.householdTransactions.length;

/** יצוא, גיבוי ושחזור. הקבצים נשמרים במכשיר בלבד ואינם נשלחים לשום מקום. */
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

  const fileInput = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<{ plan: RestorePlan; existing: number; fileHadSettings: boolean } | null>(null);
  const [replaceSettings, setReplaceSettings] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const onPickFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError('');
    setMessage('');
    setRestore(null);
    if (file.size > MAX_BACKUP_BYTES) return setError('הקובץ גדול מדי.');
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) return setError(parsed.error);
      const { plan, alreadyExisting } = await planNewData(user.uid, parsed.plan);
      setReplaceSettings(false);
      setRestore({ plan: { ...plan, invalid: parsed.plan.invalid }, existing: alreadyExisting, fileHadSettings: parsed.plan.settings !== null });
    } catch (caught) {
      setError(describeError(caught));
    }
  };

  const onRestore = async () => {
    if (!restore || restoring) return;
    setRestoring(true);
    setError('');
    try {
      await applyRestore(user.uid, restore.plan, replaceSettings);
      setMessage(`השחזור הושלם: ${countOf(restore.plan)} פריטים נוספו.`);
      setRestore(null);
    } catch (caught) {
      setError(`${describeError(caught)} אפשר להריץ את השחזור שוב: מה שכבר נוסף לא יוכפל.`);
    } finally {
      setRestoring(false);
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

        <hr className="divider" />
        <h4 className="subhead">שחזור מקובץ גיבוי</h4>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void onPickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={busy !== null || restoring} onClick={() => fileInput.current?.click()}>
          בחירת קובץ גיבוי (JSON)
        </button>
        <p className="muted small">השחזור רק מוסיף מה שחסר. פעולות וקטגוריות שכבר קיימות לא נדרסות ולא נמחקות.</p>

        {restore && (
          <div className="card notice-card" role="status">
            <p>
              <strong>נמצאו בקובץ {countOf(restore.plan)} פריטים חדשים לשחזור:</strong>
            </p>
            <ul className="plain-list">
              <li>{restore.plan.businessTransactions.length} פעולות עסק</li>
              <li>{restore.plan.householdTransactions.length} פעולות משק בית</li>
              <li>{restore.plan.categories.length} קטגוריות</li>
              <li>{restore.plan.budgets.length} תקציבים</li>
            </ul>
            {restore.existing > 0 && <p className="muted small">{restore.existing} פריטים כבר קיימים בחשבון ולא ישונו.</p>}
            {restore.plan.invalid > 0 && <p className="muted small">{restore.plan.invalid} פריטים בקובץ אינם תקינים ויידלגו.</p>}
            {restore.fileHadSettings && (
              <label className="check-row">
                <input type="checkbox" checked={replaceSettings} onChange={(e) => setReplaceSettings(e.target.checked)} />
                <span>להחליף גם את הגדרות המעשרות והחישוב בהגדרות מהקובץ</span>
              </label>
            )}
            <div className="stack">
              <button type="button" className="btn btn-primary" disabled={restoring || (countOf(restore.plan) === 0 && !replaceSettings)} onClick={() => void onRestore()}>
                {restoring ? 'משחזר…' : 'שחזור'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={restoring} onClick={() => setRestore(null)}>
                ביטול
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
