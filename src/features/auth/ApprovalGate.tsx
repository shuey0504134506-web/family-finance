import { useEffect, useState, type ReactNode } from 'react';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { Modal } from '../../components/Modal';
import {
  ensureApprovalRequest,
  subscribeApproval,
  type AdminNotice,
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

/** פס תזכורת בראש האפליקציה. לחיצה פותחת את דרישת התשלום המלאה. */
function PaymentStrip({ payment }: { payment: PaymentNotice }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="payment-strip" onClick={() => setOpen(true)}>
        <span className="payment-strip-text">
          {`תשלום נדרש עד ${dateOnly(payment.dueAt)}`}
          {payment.amountText ? ` · ${payment.amountText}` : ''}
        </span>
        <span className="payment-strip-more">לפרטים</span>
      </button>
      {open ? (
        <Modal title="דרישת תשלום" onClose={() => setOpen(false)}>
          <div className="stack">
            {payment.amountText ? <p className="center-title">{payment.amountText}</p> : null}
            <p className="muted">{`האפליקציה תינעל בסוף ${dateOnly(payment.dueAt)} אם התשלום לא יתקבל. הנתונים שלך נשמרים.`}</p>
            {payment.message ? <p style={{ whiteSpace: 'pre-wrap' }}>{payment.message}</p> : null}
            <PayLink payment={payment} />
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              סגירה
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

const seenKey = (uid: string) => `ff.notice.seen.${uid}`;

/** הודעה מהמנהל: קופצת עד שהמשתמש לוחץ "הבנתי". נזכרת במכשיר, כך שלא חוזרת על עצמה. */
function NoticePopup({ uid, notice }: { uid: string; notice: AdminNotice }) {
  const [seen, setSeen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(seenKey(uid));
    } catch {
      return null;
    }
  });
  if (seen === notice.id) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(uid), notice.id);
    } catch {
      // אחסון חסום: ההודעה תוצג שוב בפתיחה הבאה
    }
    setSeen(notice.id);
  };
  return (
    <Modal title={notice.title || 'הודעה ממנהל האפליקציה'} onClose={() => undefined}>
      <div className="stack">
        <p style={{ whiteSpace: 'pre-wrap' }}>{notice.text}</p>
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          הבנתי
        </button>
      </div>
    </Modal>
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
    // בלי רשת Firestore ממתין עד 10 שניות לפני שהוא מודה שאין חיבור; לא מחכים לו.
    const offlineTimer =
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? window.setTimeout(() => setGate((g) => (g === 'loading' ? 'unavailable' : g)), 1200)
        : undefined;
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
    return () => {
      window.clearTimeout(offlineTimer);
      stop();
    };
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
      {gate.notice ? <NoticePopup uid={uid} notice={gate.notice} /> : null}
      {soon && payment ? <PaymentStrip payment={payment} /> : null}
      {children}
    </>
  );
}
