import { useEffect, useState } from 'react';
import { useConvertedTransactions } from './useConvertedTransactions';
import type { YearMonth } from '../domain/dates';
import type { Scope, TransactionRecord } from '../domain/types';
import { subscribeMonthTransactions } from '../services/transactionService';

interface Result {
  /** לחישובים (סיכומים, תקציב, מעשרות): פעולות במטבע הראשי, ופעולות זרות אחרי המרה לפי שער יום הפעולה. */
  items: TransactionRecord[];
  /** כל הפעולות במטבע המקורי (לרשימות ולסיכום לפי מטבע), עם mainAgorot לפעולות זרות שהומרו. */
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
  const converted = useConvertedTransactions(all);
  return {
    items: converted.items,
    all: converted.all,
    loading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
    retry: () => {
      setState({ key: '', items: [], error: null });
      setAttempt((n) => n + 1);
    },
  };
}
