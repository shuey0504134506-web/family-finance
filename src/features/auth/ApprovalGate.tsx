import { useEffect, useState, type ReactNode } from 'react';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { ensureApprovalRequest, subscribeApproval, type ApprovalState } from '../../services/approvalService';
import { useAuth } from './AuthContext';

type Gate = ApprovalState | 'loading' | 'unavailable';

/**
 * שער אישור: חשבון חדש ממתין לאישור המנהל, וחשבון חסום לא נכנס.
 * זו הצגה בלבד: כללי Firestore בשרת הם שחוסמים בפועל את הנתונים.
 */
export function ApprovalGate({
  uid,
  children,
  whileLoading,
}: {
  uid: string;
  children: ReactNode;
  whileLoading: ReactNode;
}) {
  const { signOutUser } = useAuth();
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    setGate('loading');
    let requested = false;
    const stop = subscribeApproval(
      uid,
      (state) => {
        setGate(state);
        if (state === 'none' && !requested) {
          requested = true;
          void ensureApprovalRequest(uid);
        }
      },
      () => setGate('unavailable'),
    );
    return stop;
  }, [uid]);

  if (gate === 'loading') return <>{whileLoading}</>;
  if (gate === 'approved' || gate === 'unavailable') return <>{children}</>;

  const blocked = gate === 'blocked';
  return (
    <FullScreenMessage title={blocked ? 'החשבון נחסם' : 'החשבון ממתין לאישור'}>
      <p className="muted">
        {blocked
          ? 'הגישה לחשבון הזה נחסמה. לפרטים יש לפנות למנהל האפליקציה.'
          : 'הרישום נקלט. אחרי שמנהל האפליקציה יאשר את החשבון, האפליקציה תיפתח כאן אוטומטית. אין צורך לעשות דבר.'}
      </p>
      <button type="button" className="btn btn-secondary" onClick={() => void signOutUser()}>
        יציאה
      </button>
    </FullScreenMessage>
  );
}
