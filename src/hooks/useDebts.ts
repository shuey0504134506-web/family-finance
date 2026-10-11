import { useEffect, useState } from 'react';
import type { Debt } from '../domain/debt';
import { subscribeDebts } from '../services/debtService';

export function useDebts(uid: string): { debts: Debt[]; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ debts: Debt[]; loading: boolean; error: boolean }>({ debts: [], loading: true, error: false });
  useEffect(
    () =>
      subscribeDebts(
        uid,
        (debts) => setState({ debts, loading: false, error: false }),
        () => setState({ debts: [], loading: false, error: true }),
      ),
    [uid],
  );
  return state;
}
