import { useEffect, useRef } from 'react';
import { AUTO_BACKUP_FILENAME, isBackupDue } from '../../domain/autoBackup';
import { saveBackupFile } from '../../native/backupFile';
import { exportAllData } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { readAutoBackup, writeAutoBackup } from './autoBackupStore';

/** מריץ גיבוי אוטומטי (פעם בשבוע) כשהאפליקציה נפתחת או חוזרת לחזית, אם הוא מופעל ועבר שבוע. */
export function AutoBackupHost() {
  const { user } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const running = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (running.current || failed.current) return;
      const state = readAutoBackup(user.uid);
      if (!isBackupDue(state, Date.now())) return;
      running.current = true;
      try {
        const { backup } = await exportAllData(user.uid);
        await saveBackupFile(AUTO_BACKUP_FILENAME, JSON.stringify(backup, null, 2));
        writeAutoBackup(user.uid, { enabled: true, lastAt: Date.now() });
      } catch {
        reportFailure('הגיבוי האוטומטי לא הצליח. אפשר להוריד גיבוי ידני בהגדרות, בחלק "ניהול נתונים", ולנסות שוב מאוחר יותר.');
        failed.current = true; // לא מציפים בהודעות: ננסה שוב בפתיחה הבאה של האפליקציה
      } finally {
        running.current = false;
      }
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user.uid, reportFailure]);

  return null;
}
