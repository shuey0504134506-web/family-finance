import { useEffect, useState } from 'react';
import type { YearMonth } from '../domain/dates';
import type { Scope, TransactionRecord } from '../domain/types';
import { subscribeTransactionsUpTo } from '../services/transactionService';

/** כל ההיסטוריה עד סוף החודש הנבחר, בזמן אמת. */
export function useTransactionsUpTo(
  uid: string,
  scope: Scope,
  yearMonth: YearMonth,
  enabled: boolean,
): { items: TransactionRecord[]; loading: boolean; error: Error | null } {
  const key = `${scope}|${yearMonth}`;
  const [state, setState] = useState<{
    key: string;
    items: TransactionRecord[];
    error: Error | null;
  }>({ key: '', items: [], error: null });

  useEffect(() => {
    if (!enabled) return;
    return subscribeTransactionsUpTo(
      uid,
      scope,
      yearMonth,
      (items) => setState({ key, items, error: null }),
      (error) => setState({ key, items: [], error }),
    );
  }, [uid, scope, yearMonth, enabled, key]);

  const isCurrent = state.key === key;
  return {
    items: isCurrent ? state.items : [],
    loading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
