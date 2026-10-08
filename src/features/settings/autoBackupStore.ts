import { DEFAULT_AUTO_BACKUP, parseAutoBackupState, type AutoBackupState } from '../../domain/autoBackup';

/** מצב הגיבוי האוטומטי נשמר במכשיר הזה בלבד (הקובץ נשמר גם הוא במכשיר), לכל משתמש בנפרד. */
const key = (uid: string) => `ff.autoBackup.v1.${uid}`;

export function readAutoBackup(uid: string): AutoBackupState {
  try {
    return parseAutoBackupState(localStorage.getItem(key(uid)));
  } catch {
    return DEFAULT_AUTO_BACKUP;
  }
}

export function writeAutoBackup(uid: string, state: AutoBackupState): void {
  try {
    localStorage.setItem(key(uid), JSON.stringify(state));
  } catch {
    // אחסון חסום: ההגדרה פשוט לא תישמר
  }
  window.dispatchEvent(new Event('ff-auto-backup'));
}
