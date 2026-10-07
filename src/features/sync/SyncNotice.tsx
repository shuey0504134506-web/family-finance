import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface SyncNoticeValue {
  /** מדווח על כישלון סנכרון. ההודעה נשארת עד שהמשתמש סוגר אותה. */
  reportFailure: (message: string) => void;
}

const SyncNoticeContext = createContext<SyncNoticeValue | null>(null);

/**
 * הודעה גלובלית על פעולה שלא הצליחה להישמר בשרת. כתיבה בלי אינטרנט נשמרת במכשיר
 * ומסונכרנת בהמשך, אבל אם השרת דוחה אותה (למשל בגלל חוקי אבטחה), המשתמש חייב לדעת.
 */
export function SyncNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const reportFailure = useCallback((text: string) => setMessage(text), []);
  const value = useMemo(() => ({ reportFailure }), [reportFailure]);

  return (
    <SyncNoticeContext.Provider value={value}>
      {children}
      {message && (
        <div className="sync-failure" role="alert">
          <span>{message}</span>
          <button type="button" className="link-btn" onClick={() => setMessage(null)}>
            הבנתי
          </button>
        </div>
      )}
    </SyncNoticeContext.Provider>
  );
}

export function useSyncNotice(): SyncNoticeValue {
  const value = useContext(SyncNoticeContext);
  if (!value) throw new Error('useSyncNotice must be used inside SyncNoticeProvider');
  return value;
}
