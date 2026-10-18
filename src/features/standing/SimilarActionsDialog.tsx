import { useState } from 'react';
import { Amount } from '../../components/Amount';
import { Modal } from '../../components/Modal';
import { formatDisplayDate } from '../../domain/dates';
import type { StandingOrder, Transaction } from '../../domain/types';

/**
 * אחרי שפעולה הפכה להוראת קבע: מציע לקטלג גם פעולות דומות שכבר קיימות בחודשים שאחריה
 * (אותו שם בקירוב, סכום ותאריך קרובים). אפשר לבחור אילו כן ואילו לא, או לדחות את ההצעה.
 */
export function SimilarActionsDialog({
  order,
  candidates,
  busy,
  onConfirm,
  onSkip,
}: {
  order: StandingOrder;
  candidates: Transaction[];
  busy: boolean;
  onConfirm: (selected: Transaction[]) => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((c) => c.id)));
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selected = candidates.filter((c) => picked.has(c.id));

  return (
    <Modal title="נמצאו פעולות דומות" onClose={onSkip}>
      <p>
        {`בחודשים שאחרי הפעולה הזו יש ${candidates.length === 1 ? 'פעולה דומה אחת' : `${candidates.length} פעולות דומות`}. `}
        {`לקטלג אותן גם כהוראת קבע, ולתת לכולן את השם "${order.name}" ואת הקטגוריה "${order.categoryName}"?`}
      </p>
      <ul className="standing-pick-list">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="check-row">
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="standing-pick-text">
                <span>{formatDisplayDate(c.date)}</span>
                <span>{c.counterparty || c.categoryName}</span>
                <Amount agorot={c.amountAgorot} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" disabled={busy || selected.length === 0} onClick={() => onConfirm(selected)}>
          קטלוג המסומנות
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onSkip}>
          לא, רק הפעולה הזו
        </button>
      </div>
    </Modal>
  );
}
