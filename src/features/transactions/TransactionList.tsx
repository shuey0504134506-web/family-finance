import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { parseSpaceKey } from '../../domain/spaces';
import { PAYMENT_METHOD_LABELS, type TransactionRecord } from '../../domain/types';
import { deleteTransaction } from '../../services/transactionService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/** "2026-10-07" -> "07/10/2026" */
function fullDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

const SYNCED_FLASH_MS = 4000;
const HIGHLIGHT_MS = 3500;

/**
 * רשימת פעולות החודש. כל פעולה מציגה את מצב השמירה שלה בכנות:
 * "נשמר במכשיר – ממתין לסנכרון" כל עוד השרת לא אישר,
 * ו"נשמר וסונכרן" לכמה שניות מרגע שהשרת אישר.
 */
export function TransactionList({
  spaceKey,
  items,
  highlightId,
}: {
  spaceKey: string;
  items: readonly TransactionRecord[];
  /** פעולה להבלטה לכמה רגעים (למשל אחרי מעבר מהחיפוש) */
  highlightId?: string;
}) {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const scope = parseSpaceKey(spaceKey)?.scope ?? 'household';
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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

  const onDelete = (id: string) => {
    setConfirmingId(null);
    deleteTransaction(user.uid, scope, id).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את המחיקה. הפעולה עשויה להופיע שוב.'),
    );
  };

  return (
    <ul className="tx-list" aria-label="פעולות החודש">
      {items.map((item) => {
        const isIncome = item.type === 'income';
        const title = item.counterparty || item.categoryName;
        const edit = () => navigate(`/${spaceKey}/edit/${item.id}`);
        return (
          <li key={item.id} id={`tx-${item.id}`} className={`txc${flashId === item.id ? ' is-highlight' : ''}`}>
            <div className="txc-top">
              <button type="button" className="txc-head" onClick={edit} aria-label={`${title}, לעריכה`}>
                <span className="txc-title">{title}</span>
                <span className="txc-date">{fullDate(item.date)}</span>
              </button>
              <span className="txc-actions">
                <button type="button" className="txc-icon" onClick={edit} aria-label={`עריכה: ${title}`}>
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="txc-icon"
                  onClick={() => setConfirmingId(item.id)}
                  aria-label={`מחיקה: ${title}`}
                >
                  <TrashIcon />
                </button>
              </span>
            </div>
            <div className="txc-mid">
              <span className="txc-chips">
                <span className="txc-chip">{item.categoryName}</span>
                <span className="txc-chip">{PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}</span>
                {item.isTithePayment ? <span className="txc-chip">מעשר</span> : null}
              </span>
              <Amount agorot={item.amountAgorot} className={isIncome ? 'tone-income' : 'tone-expense'} />
            </div>
            {item.note ? <div className="txc-note">{item.note}</div> : null}
            {item.pendingSync ? (
              <div className="tx-sync tx-sync-pending">נשמר במכשיר – ממתין לסנכרון</div>
            ) : justSynced.has(item.id) ? (
              <div className="tx-sync tx-sync-done">נשמר וסונכרן</div>
            ) : null}
            {confirmingId === item.id && (
              <div className="txc-confirm" role="alertdialog" aria-label="אישור מחיקה">
                <span>למחוק את הפעולה? אי אפשר לשחזר.</span>
                <span className="txc-confirm-actions">
                  <button type="button" className="btn btn-danger" onClick={() => onDelete(item.id)}>
                    כן, למחוק
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmingId(null)}>
                    ביטול
                  </button>
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
