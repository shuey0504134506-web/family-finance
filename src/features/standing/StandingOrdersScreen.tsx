import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { Field } from '../../components/Field';
import { ScreenHeader } from '../../components/ScreenHeader';
import { currencyOf } from '../../domain/currency';
import { addMonths, formatDisplayDate, todayIso, yearMonthOfDate } from '../../domain/dates';
import { parseShekelsToAgorot, MAX_TRANSACTION_AGOROT } from '../../domain/money';
import { detectRecurring, firstDueDate, type RecurringSuggestion } from '../../domain/standingOrder';
import { businessIdOf, inSpace } from '../../domain/spaces';
import type { StandingOrder, Transaction } from '../../domain/types';
import { useStandingOrders } from '../../hooks/useStandingOrders';
import { useRevealOpen } from '../../hooks/useRevealOpen';
import { newId } from '../../services/ids';
import {
  deleteStandingOrder,
  linkTransactionsToOrder,
  saveStandingOrder,
  subscribeOrderTransactions,
  subscribeTransactionsSince,
} from '../../services/standingOrderService';
import { AccordionItem } from '../settings/Accordion';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpaces } from '../spaces/SpacesContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSyncNotice } from '../sync/SyncNotice';

const dismissedKey = (uid: string) => `ff.standing.dismissed.v1.${uid}`;

function readDismissed(uid: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(dismissedKey(uid)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** "הוראות הקבע שלי": כל ההוראות של המרחב, פרטים ועריכה, והצעות להפוך פעולות שחוזרות להוראת קבע. */
export function StandingOrdersScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  const { nameOf } = useSpaces();
  const { orders: all, loading, error } = useStandingOrders(user.uid);
  const orders = useMemo(() => all.filter((o) => inSpace(o, space)), [all, space]);
  const [openId, setOpenId] = useState<string | null>(null);
  useRevealOpen(openId);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className={`app-shell scope-${space.scope}`}>
      <ScreenHeader title={`הוראות הקבע שלי · ${nameOf(space)}`} />
      <main className="content" aria-busy={loading}>
        <p className="muted small">
          הוראת קבע היא הכנסה או הוצאה שחוזרת כל חודש באותו תאריך ונרשמת אוטומטית. מסמנים אותה בטופס ההוספה, תחת &quot;פרטים נוספים&quot;.
        </p>

        {error ? (
          <div className="card error-card" role="alert">לא הצלחנו לטעון את הוראות הקבע. יש לבדוק את החיבור ולנסות שוב.</div>
        ) : loading ? (
          <div className="card notice-card" role="status">טוען…</div>
        ) : orders.length === 0 ? (
          <div className="card notice-card">עדיין אין הוראות קבע. אפשר לסמן &quot;הוראת קבע&quot; בהוספת הכנסה או הוצאה, או לאשר הצעה מהרשימה שלמטה.</div>
        ) : (
          <div className="acc-list">
            {orders.map((order) => (
              <AccordionItem key={order.id} id={order.id} title={`${order.name} · ${order.type === 'income' ? 'הכנסה' : 'הוצאה'}`} open={openId === order.id} onToggle={toggle}>
                <OrderDetails uid={user.uid} order={order} spaceKey={space.key} onDeleted={() => setOpenId(null)} />
              </AccordionItem>
            ))}
          </div>
        )}

        <Suggestions uid={user.uid} orders={orders} space={space} />
      </main>
    </div>
  );
}

function OrderDetails({ uid, order, spaceKey, onDeleted }: { uid: string; order: StandingOrder; spaceKey: string; onDeleted: () => void }) {
  const { reportFailure } = useSyncNotice();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [name, setName] = useState(order.name);
  const [amountText, setAmountText] = useState(String(order.amountAgorot / 100));
  const [day, setDay] = useState(String(order.dayOfMonth));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(
    () => subscribeOrderTransactions(uid, order.scope, order.id, setTxs, () => setTxs([])),
    [uid, order.scope, order.id],
  );

  const save = (patch: Partial<StandingOrder> = {}) => {
    const nextName = (patch.name ?? name).trim();
    const nextAmount = patch.amountAgorot ?? parseShekelsToAgorot(amountText);
    const nextDay = patch.dayOfMonth ?? Number(day);
    if (!nextName) return setError('יש להזין שם.');
    if (nextAmount === null || nextAmount <= 0 || nextAmount > MAX_TRANSACTION_AGOROT) return setError('הסכום אינו תקין.');
    if (!Number.isInteger(nextDay) || nextDay < 1 || nextDay > 31) return setError('יום החיוב חייב להיות בין 1 ל-31.');
    setError('');
    const dayChanged = nextDay !== order.dayOfMonth;
    const nextOrder: StandingOrder = {
      ...order,
      name: nextName,
      amountAgorot: nextAmount,
      dayOfMonth: nextDay,
      ...patch,
      // שינוי יום החיוב: ממשיכים מהחיוב הקרוב לפי היום החדש, בלי ליצור חיובים שעברו
      nextDue: dayChanged ? firstDueDate(nextDay, addMonthsDate(todayIso()), todayIso()) : order.nextDue,
      updatedAt: Date.now(),
    };
    saveStandingOrder(uid, nextOrder).catch(() => reportFailure('לא הצלחנו לשמור את הוראת הקבע. יש לנסות שוב.'));
  };

  const remove = () => {
    deleteStandingOrder(uid, order.id).catch(() => reportFailure('לא הצלחנו למחוק את הוראת הקבע. יש לנסות שוב.'));
    onDeleted();
  };

  return (
    <div className="stack">
      <p className="muted small">
        {`${order.type === 'income' ? 'נכנסת' : 'יורדת'} ב-${order.dayOfMonth} לכל חודש · קטגוריה: ${order.categoryName} · `}
        {order.active ? `החיוב הבא: ${formatDisplayDate(order.nextDue)}` : 'מושהית: לא נוצרות פעולות חדשות'}
      </p>
      <p>
        <strong>{txs === null ? 'טוען…' : `${txs.length} פעולות נרשמו עד היום תחת ההוראה הזו`}</strong>
      </p>

      <Field label="שם" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="סכום החיוב" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
      <Field label="יום בחודש (1 עד 31)" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
      {error && <div className="form-error" role="alert">{error}</div>}
      <p className="muted small">שינוי נוגע לפעולות החדשות בלבד. פעולות שכבר נרשמו נשארות כפי שהן ואפשר לערוך אותן בנפרד.</p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={() => save()}>שמירת שינויים</button>
        <button type="button" className="btn btn-secondary" onClick={() => save({ active: !order.active })}>
          {order.active ? 'השהיית ההוראה' : 'חידוש ההוראה'}
        </button>
      </div>

      {txs && txs.length > 0 && (
        <>
          <h3 className="subhead">הפעולות שנרשמו</h3>
          <ul className="tx-list" aria-label="פעולות תחת הוראת הקבע">
            {txs.map((t) => (
              <li key={t.id} className="txc">
                <Link to={`/${spaceKey}/edit/${t.id}`} className="standing-tx-link">
                  <span>{formatDisplayDate(t.date)}</span>
                  <Amount agorot={t.amountAgorot} currency={currencyOf(t)} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmDelete ? (
        <div className="dialog-actions">
          <p className="muted small">למחוק את הוראת הקבע? הפעולות שכבר נרשמו נשארות, ופשוט לא ייווצרו חדשות.</p>
          <button type="button" className="btn btn-danger-outline" onClick={remove}>כן, למחוק</button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>ביטול</button>
        </div>
      ) : (
        <button type="button" className="link-btn" onClick={() => setConfirmDelete(true)}>מחיקת הוראת הקבע</button>
      )}
    </div>
  );
}

/** התאריך לחישוב החיוב הראשון אחרי שינוי יום: החודש הנוכחי (כך שהיום החדש יכול להיות עוד החודש). */
function addMonthsDate(today: string): string {
  return `${addMonths(yearMonthOfDate(today), -1)}-28`;
}

function Suggestions({ uid, orders, space }: { uid: string; orders: StandingOrder[]; space: ReturnType<typeof useSpace> }) {
  const { reportFailure } = useSyncNotice();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(uid));
  const today = todayIso();

  useEffect(
    () => subscribeTransactionsSince(uid, space.scope, `${addMonths(yearMonthOfDate(today), -6)}-01`, setTxs, () => setTxs([])),
    [uid, space.scope, today],
  );

  const suggestions = useMemo(() => {
    const mine = txs.filter((t) => space.scope === 'household' || businessIdOf(t) === space.businessId);
    return detectRecurring(mine, orders, today).filter((s) => !dismissed.includes(s.key));
  }, [txs, orders, today, dismissed, space.scope, space.businessId]);

  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    try {
      localStorage.setItem(dismissedKey(uid), JSON.stringify(next));
    } catch {
      /* אחסון חסום: ההצעה תחזור בפתיחה הבאה */
    }
  };

  const accept = (s: RecurringSuggestion) => {
    const latest = s.transactions[s.transactions.length - 1];
    const now = Date.now();
    const order: StandingOrder = {
      id: newId(),
      scope: space.scope,
      ...(latest.businessId ? { businessId: latest.businessId } : {}),
      type: s.type,
      name: s.name,
      amountAgorot: latest.amountAgorot,
      ...(latest.currency ? { currency: latest.currency } : {}),
      categoryId: latest.categoryId,
      categoryName: latest.categoryName,
      paymentMethod: latest.paymentMethod,
      ...(latest.paymentLabel ? { paymentLabel: latest.paymentLabel } : {}),
      note: latest.note,
      titheStatus: latest.titheStatus,
      isTithePayment: latest.isTithePayment,
      dayOfMonth: s.dayOfMonth,
      nextDue: firstDueDate(s.dayOfMonth, latest.date, today),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    linkTransactionsToOrder(uid, space.scope, s.transactions, order, now).catch(() =>
      reportFailure('לא הצלחנו ליצור את הוראת הקבע. יש לנסות שוב.'),
    );
  };

  if (suggestions.length === 0) return null;
  return (
    <section className="stack" aria-label="הצעות להוראות קבע">
      <h2 className="subhead">הצעות</h2>
      {suggestions.map((s) => {
        const months = s.transactions.length;
        const kind = s.type === 'income' ? 'הכנסה קבועה' : 'הוצאה קבועה';
        return (
          <div key={s.key} className="card suggest-card">
            <p>
              {`המערכת מזהה שב-${months} החודשים האחרונים הייתה ${kind} סביב ה-${s.dayOfMonth} בחודש, אצל "${s.name}", בסכום של `}
              <Amount agorot={s.amountAgorot} />
              {'. להפוך את זה להוראת קבע?'}
            </p>
            <ul className="standing-pick-list">
              {s.transactions.map((t) => (
                <li key={t.id} className="standing-pick-text">
                  <span>{formatDisplayDate(t.date)}</span>
                  <span>{t.counterparty || t.categoryName}</span>
                  <Amount agorot={t.amountAgorot} />
                </li>
              ))}
            </ul>
            <p className="muted small">אם כן, כל הפעולות האלה יקבלו את אותו שם ואותה קטגוריה, והפעולה הבאה תירשם אוטומטית בתאריך החיוב.</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={() => accept(s)}>כן, להפוך להוראת קבע</button>
              <button type="button" className="btn btn-secondary" onClick={() => dismiss(s.key)}>לא, תודה</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
