import { useEffect, useRef, useState } from 'react';
import type { CurrencyCode } from '../domain/currency';
import { Amount } from './Amount';

/** האם מותר להזיז: לא בבדיקות ולא למי שביקש פחות תנועה. */
function motionAllowed(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** סכום שנספר מ-0 (בפעם הראשונה) או מהערך הקודם אל הערך החדש, בהאטה בסוף. */
export function CountUpAmount({ agorot, className, currency }: { agorot: number; className?: string; currency?: CurrencyCode }) {
  const [shown, setShown] = useState<number>(() => (motionAllowed() ? 0 : agorot));
  const from = useRef(shown);
  useEffect(() => {
    if (!motionAllowed()) {
      setShown(agorot);
      return undefined;
    }
    const start = performance.now();
    const base = from.current;
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(base + (agorot - base) * eased);
      from.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [agorot]);
  return <Amount agorot={shown} className={className} currency={currency} />;
}
