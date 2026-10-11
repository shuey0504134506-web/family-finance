import { useEffect, useMemo, useState } from 'react';
import { isPrimaryCurrency } from '../domain/currency';
import type { YearMonth } from '../domain/dates';
import type { Scope, TransactionRecord } from '../domain/types';
import { subscribeTransactionsUpTo } from '../services/transactionService';

const EMPTY: TransactionRecord[] = [];

/**
 * כל ההיסטוריה עד סוף החודש הנבחר, בזמן אמת.
 * items = רק המטבע הראשי (לחישובים); all = כל הפעולות.
 */
export function useTransactionsUpTo(
  uid: string,
  scope: Scope,
  yearMonth: YearMonth,
  enabled: boolean,
): { items: TransactionRecord[]; all: TransactionRecord[]; loading: boolean; error: Error | null } {
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
  const all = isCurrent ? state.items : EMPTY;
  const items = useMemo(() => all.filter(isPrimaryCurrency), [all]);
  return {
    items,
    all,
    loading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
  };
}
