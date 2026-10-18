import { useEffect, useState } from 'react';

/** מסך רחב (מחשב): מציג תפריט צד ופריסה רחבה. בטלפון ובטאבלט צר נשארת פריסת האפליקציה. */
export const WIDE_QUERY = '(min-width: 1000px)';

export function useIsWide(): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}
