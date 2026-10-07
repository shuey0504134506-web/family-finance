import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import type { Scope, TransactionRecord } from '../../domain/types';

/** "2026-10-07" -> "07/10" */
function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const SYNCED_FLASH_MS = 4000;
const HIGHLIGHT_MS = 3500;

/**
 * רשימת פעולות החודש. כל פעולה מציגה את מצב השמירה שלה בכנות:
 * "נשמר במכשיר – ממתין לסנכרון" כל עוד השרת לא אישר,
 * ו"נשמר וסונכרן" לכמה שניות מרגע שהשרת אישר.
 */
export function TransactionList({
  scope,
  items,
  highlightId,
}: {
  scope: Scope;
  items: readonly TransactionRecord[];
  /** פעולה להבלטה לכמה רגעים (למשל אחרי מעבר מהחיפוש) */
  highlightId?: string;
}) {
  const navigate = useNavigate();
  const [justSynced, setJustSynced] = useState<ReadonlySet<string>>(new Set());
  const previousPending = useRef<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashed = useRef(false);

  // הבלטה חד-פעמית: גלילה לפעולה, וצביעה שנעלמת אחרי כמה שניות.
  useEffect(() => {
    if (!highlightId || flashed.current) return;
    if (!items.some((i) => i.id === highlightId)) return;
    flashed.current = true;
    setFlashId(highlightId);
    document.getElementById(`tx-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = window.setTimeout(() => setFlashId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId, items]);

  useEffect(() => {
    const nowPending = new Set(items.filter((i) => i.pendingSync).map((i) => i.id));
    const present = new Set(items.map((i) => i.id));
    const completed = [...previousPending.current].filter((id) => !nowPending.has(id) && present.has(id));
    previousPending.current = nowPending;
    if (completed.length === 0) return;

    setJustSynced((current) => new Set([...current, ...completed]));
    const timer = window.setTimeout(() => {
      setJustSynced((current) => {
        const next = new Set(current);
        completed.forEach((id) => next.delete(id));
        return next;
      });
    }, SYNCED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="card notice-card" role="status">
        אין עדיין פעולות בחודש הזה.
      </div>
    );
  }

  return (
    <ul className="tx-list" aria-label="פעולות החודש">
      {items.map((item) => {
        const isIncome = item.type === 'income';
        const title = item.counterparty || item.categoryName;
        return (
          <li key={item.id} id={`tx-${item.id}`}>
            <button
              type="button"
              className={`tx-row${flashId === item.id ? ' is-highlight' : ''}`}
              onClick={() => navigate(`/${scope}/edit/${item.id}`)}
              aria-label={`${isIncome ? 'הכנסה' : 'הוצאה'}, ${title}, לעריכה`}
            >
              <span className="tx-date">{shortDate(item.date)}</span>
              <span className="tx-main">
                <span className="tx-title">{title}</span>
                <span className="tx-sub">
                  {item.categoryName}
                  {item.isTithePayment ? ' · מעשר' : ''}
                </span>
                {item.pendingSync ? (
                  <span className="tx-sync tx-sync-pending">נשמר במכשיר – ממתין לסנכרון</span>
                ) : justSynced.has(item.id) ? (
                  <span className="tx-sync tx-sync-done">נשמר וסונכרן</span>
                ) : null}
              </span>
              <Amount agorot={item.amountAgorot} className={isIncome ? 'tone-income' : 'tone-expense'} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
