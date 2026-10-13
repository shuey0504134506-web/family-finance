import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getCurrency, currencyOf } from '../domain/currency';
import { todayIso } from '../domain/dates';
import { convertBudgets } from '../domain/fx';
import type { Budget } from '../domain/types';
import { subscribeBudgets } from '../services/budgetService';
import { getRatesFor, ratesVersion, requestRates, subscribeRates } from '../services/historicalRates';

/** התקציבים במטבע הראשי. תקציב שנקבע במטבע אחר מומר לפי השער העדכני, בלי לשנות את המסמך השמור. */
export function useBudgets(uid: string): { budgets: Budget[]; loading: boolean; error: boolean } {
  const [state, setState] = useState({ budgets: [] as Budget[], loading: true, error: false });
  useEffect(
    () =>
      subscribeBudgets(
        uid,
        (budgets) => setState({ budgets, loading: false, error: false }),
        () => setState({ budgets: [], loading: false, error: true }),
      ),
    [uid],
  );
  const version = useSyncExternalStore(subscribeRates, ratesVersion);
  const needsRates = state.budgets.some((b) => currencyOf(b) !== getCurrency());
  const today = todayIso();
  useEffect(() => {
    if (needsRates) requestRates([today]);
  }, [needsRates, today, version]);
  const budgets = useMemo(
    () => (needsRates ? convertBudgets(state.budgets, getRatesFor(today)) : state.budgets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.budgets, needsRates, today, version],
  );
  return { budgets, loading: state.loading, error: state.error };
}
