import { useEffect, useState, type ReactNode } from 'react';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import {
  ensureApprovalRequest,
  subscribeApproval,
  type ApprovalSnapshot,
  type PaymentNotice,
} from '../../services/approvalService';
import { recordAppOpen } from '../../services/usageService';
import { suppressLock } from '../../services/lockSuppress';
import { useAuth } from './AuthContext';

type Gate = ApprovalSnapshot | 'loading' | 'unavailable';

const WARN_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

function dateOnly(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function PayLink({ payment }: { payment: PaymentNotice }) {
  if (!payment.url) return null;
  return (
    <a className="btn btn-primary" href={payment.url} target="_blank" rel="noopener noreferrer" onClick={() => suppressLock()}>
      מעבר לתשלום
    </a>
  );
}

function UsageTracker({ uid }: { uid: string }) {
  useEffect(() => recordAppOpen(uid), [uid]);
  return null;
}

/**
 * שער אישור ותשלום: חשבון חדש ממתין לאישור המנהל, חשבון חסום לא נכנס,
 * וחשבון שמועד התשלום שלו עבר ננעל עד שהמנהל מסיר את הדרישה.
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setGate('loading');
    let requested = false;
    const stop = subscribeApproval(
      uid,
      (snapshot) => {
        setGate(snapshot);
        if (snapshot.state === 'none' && !requested) {
          requested = true;
          void ensureApprovalRequest(uid);
        }
      },
      () => setGate('unavailable'),
    );
    return stop;
  }, [uid]);

  // נעילה אוטומטית ברגע שהמועד מגיע, גם כשהאפליקציה פתוחה
  const dueAt = typeof gate === 'object' ? gate.payment?.dueAt : undefined;
  useEffect(() => {
    setNow(Date.now());
    if (dueAt === undefined) return;
    const wait = dueAt - Date.now();
    if (wait <= 0 || wait > 2_000_000_000) return;
    const timer = window.setTimeout(() => setNow(Date.now()), wait + 500);
    return () => window.clearTimeout(timer);
  }, [dueAt]);

  if (gate === 'loading') return <>{whileLoading}</>;
  if (gate === 'unavailable') return <>{children}</>;

  const { state, payment } = gate;
  const logout = (
    <button type="button" className="btn btn-secondary" onClick={() => void signOutUser()}>
      יציאה
    </button>
  );

  if (state === 'blocked') {
    return (
      <FullScreenMessage title="החשבון נחסם">
        <p className="muted">הגישה לחשבון הזה נחסמה. לפרטים יש לפנות למנהל האפליקציה.</p>
        {logout}
      </FullScreenMessage>
    );
  }
  if (state === 'pending' || state === 'none') {
    return (
      <FullScreenMessage title="החשבון ממתין לאישור">
        <p className="muted">
          הרישום נקלט. אחרי שמנהל האפליקציה יאשר את החשבון, האפליקציה תיפתח כאן אוטומטית. אין צורך לעשות דבר.
        </p>
        {logout}
      </FullScreenMessage>
    );
  }

  if (payment && payment.dueAt <= now) {
    return (
      <FullScreenMessage title="נדרש תשלום להמשך השימוש">
        {payment.amountText ? <p className="center-title">{payment.amountText}</p> : null}
        {payment.message ? <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{payment.message}</p> : null}
        <p className="muted small">הנתונים שלך שמורים ולא נמחקו. הגישה תיפתח אוטומטית אחרי עדכון מהמנהל.</p>
        <PayLink payment={payment} />
        {logout}
      </FullScreenMessage>
    );
  }

  const soon = payment && payment.dueAt - now <= WARN_BEFORE_MS;
  return (
    <>
      <UsageTracker uid={uid} />
      {soon && payment ? (
        <div className="payment-strip" role="status">
          <span>
            {`תשלום נדרש עד ${dateOnly(payment.dueAt)}`}
            {payment.amountText ? ` · ${payment.amountText}` : ''}
          </span>
          <PayLink payment={payment} />
        </div>
      ) : null}
      {children}
    </>
  );
}
