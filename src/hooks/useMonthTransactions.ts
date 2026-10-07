import { useEffect, useState } from 'react';
import type { YearMonth } from '../domain/dates';
import type { Scope, TransactionRecord } from '../domain/types';
import { subscribeMonthTransactions } from '../services/transactionService';

interface Result {
  items: TransactionRecord[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

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
  return {
    items: isCurrent ? state.items : [],
    loading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
    retry: () => {
      setState({ key: '', items: [], error: null });
      setAttempt((n) => n + 1);
    },
  };
}
