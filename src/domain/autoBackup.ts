/** גיבוי אוטומטי שבועי: קובץ אחד בשם קבוע, שכל גיבוי חדש מחליף. */
export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTO_BACKUP_FILENAME = 'ניהול-כספים-גיבוי-אוטומטי.json';

export interface AutoBackupState {
  enabled: boolean;
  /** מתי הושלם הגיבוי האחרון (ms), או null אם עוד לא היה */
  lastAt: number | null;
}

export const DEFAULT_AUTO_BACKUP: AutoBackupState = { enabled: false, lastAt: null };

export function isBackupDue(state: AutoBackupState, now: number): boolean {
  if (!state.enabled) return false;
  if (state.lastAt === null) return true;
  // שעון שהוזז אחורה: מגבים מיד במקום להמתין שנים
  if (state.lastAt > now) return true;
  return now - state.lastAt >= BACKUP_INTERVAL_MS;
}

export function parseAutoBackupState(raw: string | null): AutoBackupState {
  if (!raw) return DEFAULT_AUTO_BACKUP;
  try {
    const v = JSON.parse(raw) as { enabled?: unknown; lastAt?: unknown };
    return {
      enabled: v.enabled === true,
      lastAt: typeof v.lastAt === 'number' && Number.isFinite(v.lastAt) ? v.lastAt : null,
    };
  } catch {
    return DEFAULT_AUTO_BACKUP;
  }
}
