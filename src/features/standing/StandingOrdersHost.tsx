import { useEffect, useRef } from 'react';
import { todayIso } from '../../domain/dates';
import { dueDatesUpTo } from '../../domain/standingOrder';
import { useStandingOrders } from '../../hooks/useStandingOrders';
import { runDueOrders } from '../../services/standingOrderService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * יוצר בשקט את פעולות הוראות הקבע שהגיע תאריך החיוב שלהן. רץ בפתיחת האפליקציה,
 * כשהוראות הקבע משתנות, ובכל חזרה לאפליקציה (למקרה שהיום התחלף).
 */
export function StandingOrdersHost() {
  const { user } = useReadyAuth();
  const { orders, loading, error } = useStandingOrders(user.uid);
  const { reportFailure } = useSyncNotice();
  const running = useRef(false);
  const latest = useRef(orders);
  latest.current = orders;

  useEffect(() => {
    if (loading || error) return undefined;
    const run = () => {
      const today = todayIso();
      if (running.current || !latest.current.some((o) => dueDatesUpTo(o, today).length > 0)) return;
      running.current = true;
      runDueOrders(user.uid, latest.current, today, Date.now())
        .catch(() => reportFailure('לא הצלחנו ליצור את פעולות הוראות הקבע. הן ייווצרו בפתיחה הבאה.'))
        .finally(() => {
          running.current = false;
        });
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user.uid, orders, loading, error, reportFailure]);

  return null;
}
