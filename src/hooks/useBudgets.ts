import { useEffect, useState } from 'react';
import type { Budget } from '../domain/types';
import { subscribeBudgets } from '../services/budgetService';

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
  return state;
}
