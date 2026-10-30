import { useLayoutEffect } from 'react';

/** כמה פיקסלים מרווח משאירים מתחת לכפתורי ההוספה. */
const BOTTOM_MARGIN = 14;

/**
 * מסך בית בטלפון קטן: אם כפתורי ההוספה יורדים מתחת לקצה המסך, מצמצמים את הרווחים בין השורות
 * (משתנה CSS ‎--sq‏ בין 0 ל-1) רק כמה שצריך כדי שהכפתורים יופיעו בלי גלילה, ולכל טלפון לפי גובהו.
 * אם גם הדחיסה המלאה לא מספיקה (מסך קטן מדי), לא דוחסים בכלל וממשיכים לגלול כרגיל.
 * במסך רחב (מחשב) אין דחיסה. ‎`key`‏ משתנה כשהתוכן משתנה (טעינה, שורת "החודש הקודם", יעד חיסכון).
 */
export function useCompactToFit(key: string): void {
  useLayoutEffect(() => {
    const run = () => {
      const shell = document.querySelector<HTMLElement>('.home-clean');
      const add = shell?.querySelector<HTMLElement>('.add-actions');
      if (!shell || !add) return;
      const set = (v: number) => shell.style.setProperty('--sq', v.toFixed(3));
      const bottomAt = (v: number) => {
        set(v);
        return add.getBoundingClientRect().bottom + window.scrollY;
      };
      const wide = window.matchMedia('(min-width: 900px), (min-aspect-ratio: 1/1)').matches;
      if (wide) return set(0);
      const limit = window.innerHeight - BOTTOM_MARGIN;
      const b0 = bottomAt(0);
      if (b0 <= limit) return;
      const saved = b0 - bottomAt(1);
      const over = b0 - limit;
      if (saved <= 0 || over > saved) return set(0); // מסך קטן מדי: נשארת גלילה
      // הרווחים אינם ליניאריים לגמרי (שורות שנשברות), לכן מתקדמים בצעדים עד שמתאים
      for (let v = Math.min(1, over / saved); v <= 1.0001; v += 0.04) {
        if (bottomAt(Math.min(1, v)) <= limit) return;
      }
      set(1);
    };
    run();
    window.addEventListener('resize', run);
    void document.fonts?.ready.then(run);
    return () => window.removeEventListener('resize', run);
  }, [key]);
}
