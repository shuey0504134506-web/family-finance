import { describe, expect, it } from 'vitest';
import { BACKUP_INTERVAL_MS, isBackupDue, parseAutoBackupState } from './autoBackup';

describe('isBackupDue', () => {
  const now = 1_000_000_000_000;
  it('כבוי: אף פעם לא', () => {
    expect(isBackupDue({ enabled: false, lastAt: null }, now)).toBe(false);
  });
  it('מופעל ועוד לא גובה: מגבים', () => {
    expect(isBackupDue({ enabled: true, lastAt: null }, now)).toBe(true);
  });
  it('פחות משבוע: לא; שבוע ויותר: כן', () => {
    expect(isBackupDue({ enabled: true, lastAt: now - BACKUP_INTERVAL_MS + 1 }, now)).toBe(false);
    expect(isBackupDue({ enabled: true, lastAt: now - BACKUP_INTERVAL_MS }, now)).toBe(true);
  });
  it('תאריך גיבוי בעתיד (שעון שהוזז): מגבים', () => {
    expect(isBackupDue({ enabled: true, lastAt: now + 5 }, now)).toBe(true);
  });
});

describe('parseAutoBackupState', () => {
  it('ערך תקין, חסר או שבור', () => {
    expect(parseAutoBackupState('{"enabled":true,"lastAt":5}')).toEqual({ enabled: true, lastAt: 5 });
    expect(parseAutoBackupState(null)).toEqual({ enabled: false, lastAt: null });
    expect(parseAutoBackupState('{{')).toEqual({ enabled: false, lastAt: null });
    expect(parseAutoBackupState('{"enabled":"yes","lastAt":"x"}')).toEqual({ enabled: false, lastAt: null });
  });
});
