import { useEffect, useState } from 'react';
import type { StandingOrder } from '../domain/types';
import { subscribeStandingOrders } from '../services/standingOrderService';

export function useStandingOrders(uid: string): { orders: StandingOrder[]; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ orders: StandingOrder[]; loading: boolean; error: boolean }>({ orders: [], loading: true, error: false });
  useEffect(
    () =>
      subscribeStandingOrders(
        uid,
        (orders) => setState({ orders, loading: false, error: false }),
        () => setState({ orders: [], loading: false, error: true }),
      ),
    [uid],
  );
  return state;
}
