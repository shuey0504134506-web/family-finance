import { useEffect, useMemo, useState } from 'react';
import { isPrimaryCurrency } from '../domain/currency';
import type { YearMonth } from '../domain/dates';
import type { Scope, TransactionRecord } from '../domain/types';
import { subscribeMonthTransactions } from '../services/transactionService';

interface Result {
  /** רק פעולות במטבע הראשי: אלה שנכנסות לסיכומים, לתקציב ולמעשרות. */
  items: TransactionRecord[];
  /** כל הפעולות, בכל מטבע (לרשימות ולסיכום לפי מטבע). */
  all: TransactionRecord[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

const EMPTY: TransactionRecord[] = [];

/**
 * פעולות של חודש אחד בזמן אמת. כשהחודש או התחום משתנים, ההאזנה הקודמת
 * נסגרת והחדשה נפתחת. נטענים רק נתוני החודש המבוקש.
 */
export function useMonthTransactions(
  uid: string,
  scope: Scope,
  yearMonth: YearMonth,
  enabled: boolean,
): Result {
  const key = `${scope}|${yearMonth}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    items: TransactionRecord[];
    error: Error | null;
  }>({ key: '', items: [], error: null });

  useEffect(() => {
    if (!enabled) return;
    return subscribeMonthTransactions(
      uid,
      scope,
      yearMonth,
      (items) => setState({ key, items, error: null }),
      (error) => setState({ key, items: [], error }),
    );
  }, [uid, scope, yearMonth, enabled, key, attempt]);

  const isCurrent = state.key === key;
  const all = isCurrent ? state.items : EMPTY;
  const items = useMemo(() => all.filter(isPrimaryCurrency), [all]);
  return {
    items,
    all,
    loading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
    retry: () => {
      setState({ key: '', items: [], error: null });
      setAttempt((n) => n + 1);
    },
  };
}
