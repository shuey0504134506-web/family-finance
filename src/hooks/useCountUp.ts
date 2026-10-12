import { useEffect, useRef, useState, type RefObject } from 'react';
import { countDone, countTick } from '../services/feedback';

/** האם מותר להנפיש: דפדפן עם matchMedia, והמשתמש לא ביקש להפחית תנועה. בבדיקות (jsdom) אין הנפשה. */
export function motionAllowed(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * מספר שעולה בהדרגה אל הערך החדש: מאפס, ורק כש-enabled (כלומר כשהוא נראה על המסך).
 * בכל שינוי הוא ממשיך מהערך שהוצג עד עכשיו. הערך הסופי תמיד מדויק, רק הדרך אליו מונפשת.
 */
export function useCountUp(target: number, enabled = true, durationMs = 1100): number {
  const animate = motionAllowed();
  const [shown, setShown] = useState(animate ? 0 : target);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!motionAllowed()) {
      setShown(target);
      return;
    }
    if (!enabled) return;
    const from = shownRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const value = t >= 1 ? target : Math.round(from + (target - from) * easeOutCubic(t));
      setShown(value);
      if (t < 1) {
        countTick(t);
        raf = requestAnimationFrame(step);
      } else {
        countDone();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, durationMs]);

  return shown;
}

/** נהיה true ברגע שהאלמנט נכנס למסך (ונשאר true). בלי IntersectionObserver: true מיד. */
export function useInView<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}
