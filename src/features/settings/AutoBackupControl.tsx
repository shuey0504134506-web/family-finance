import { useEffect, useState } from 'react';
import { AUTO_BACKUP_FILENAME } from '../../domain/autoBackup';
import { formatDisplayDate, todayIso } from '../../domain/dates';
import { Capacitor } from '@capacitor/core';
import { saveBackupFile } from '../../native/backupFile';
import { exportAllData } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { readAutoBackup, writeAutoBackup } from './autoBackupStore';

/** הגדרת גיבוי אוטומטי שבועי: קובץ אחד שכל גיבוי חדש מחליף. */
export function AutoBackupControl() {
  const { user } = useReadyAuth();
  const [state, setState] = useState(() => readAutoBackup(user.uid));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    const sync = () => setState(readAutoBackup(user.uid));
    window.addEventListener('ff-auto-backup', sync);
    return () => window.removeEventListener('ff-auto-backup', sync);
  }, [user.uid]);

  const toggle = (enabled: boolean) => {
    setError('');
    // הפעלה: הגיבוי הראשון ירוץ בפתיחה הבאה של האפליקציה (או מיד בלחיצה על "גיבוי עכשיו")
    writeAutoBackup(user.uid, { ...state, enabled });
  };

  const backupNow = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { backup } = await exportAllData(user.uid);
      await saveBackupFile(AUTO_BACKUP_FILENAME, JSON.stringify(backup, null, 2));
      writeAutoBackup(user.uid, { ...state, lastAt: Date.now() });
    } catch {
      setError('הגיבוי לא הצליח. יש לבדוק את החיבור ולנסות שוב.');
    } finally {
      setBusy(false);
    }
  };

  const last = state.lastAt === null ? null : new Date(state.lastAt);
  const lastText = last ? formatDisplayDate(todayIso(last)) : null;

  return (
    <div className="stack">
      <h4 className="subhead">גיבוי אוטומטי שבועי</h4>
      <label className="check-row">
        <input type="checkbox" checked={state.enabled} onChange={(e) => toggle(e.target.checked)} />
        <span>גיבוי אוטומטי פעם בשבוע, בקובץ אחד</span>
      </label>
      <p className="muted small">
        {native
          ? `כשהאפליקציה נפתחת ועבר שבוע מהגיבוי האחרון, נשמר קובץ בתיקיית המסמכים בטלפון בשם "${AUTO_BACKUP_FILENAME}". כל גיבוי חדש מחליף את הקודם, כך שתמיד יש קובץ אחד עדכני.`
          : `כשהאתר נפתח ועבר שבוע מהגיבוי האחרון, יורד קובץ בשם "${AUTO_BACKUP_FILENAME}". בדפדפן אי אפשר למחוק קובץ שהורד קודם, ולכן ייתכן שיצטברו עותקים. בטלפון (האפליקציה) כל גיבוי מחליף את הקודם.`}
      </p>
      <p className="muted small">{lastText ? `הגיבוי האחרון: ${lastText}.` : 'עדיין לא בוצע גיבוי אוטומטי.'}</p>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void backupNow()}>
        {busy ? 'מגבה…' : 'גיבוי עכשיו'}
      </button>
    </div>
  );
}
