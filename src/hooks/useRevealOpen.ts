import { useEffect } from 'react';

/**
 * אחרי פתיחת פריט במסך עם רשימה מתקפלת: אם סגירת הפריט הקודם הזיזה את הפריט שנפתח אל מחוץ למסך,
 * גוללים אליו. הפריט מסומן במאפיין data-reveal עם המזהה שלו.
 */
export function useRevealOpen(openId: string | null): void {
  useEffect(() => {
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).find(
        (node) => node.dataset.reveal === openId,
      );
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 64 || top > window.innerHeight * 0.65) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openId]);
}
