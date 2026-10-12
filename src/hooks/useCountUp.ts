import { useEffect, useRef, useState } from "react";

/** האם מותר להנפיש: דפדפן עם matchMedia, והמשתמש לא ביקש להפחית תנועה. בבדיקות (jsdom) אין הנפשה. */
export function motionAllowed(): boolean {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * מספר שעולה בהדרגה אל הערך החדש: בטעינה הראשונה מאפס, ובכל שינוי מהערך שהוצג עד עכשיו.
 * הערך הסופי תמיד מדויק (הסכום האמיתי), רק הדרך אליו מונפשת.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const animate = motionAllowed();
  const [shown, setShown] = useState(animate ? 0 : target);
  const fromRef = useRef(animate ? 0 : target);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!motionAllowed()) {
      setShown(target);
      fromRef.current = target;
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const value =
        t >= 1 ? target : Math.round(from + (target - from) * easeOutCubic(t));
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return shown;
}
