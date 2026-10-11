import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from '../../components/icons';

export interface WalkthroughStep {
  /** הכיתוב שמסביר מה לעשות בשלב הזה */
  caption: string;
  /** המסך המצויר בשלב הזה. הרכיב המודגש מסומן ב-className "mk-hl" */
  screen: ReactNode;
  /** מיקום האצבע (באחוזים מהמסך המצויר). בלי ערך אין אצבע. */
  tap?: { top: number; left: number };
}

const STEP_MS = 3200;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * הדגמה מונפשת: טלפון מצויר עם הדגשה ואצבע, כיתוב לכל שלב, וחיצים לעבור בין השלבים.
 * מתנגן אוטומטית בלולאה, ואפשר לעצור. מי שביקש פחות תנועה מקבל הדגמה שמתקדמת רק בלחיצה.
 */
export function WalkthroughPlayer({ steps, label }: { steps: readonly WalkthroughStep[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const last = steps.length - 1;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIndex((i) => (i >= last ? 0 : i + 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, last]);

  const step = steps[index];
  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.min(last, Math.max(0, next)));
  };

  return (
    <div className="walk" role="group" aria-label={label}>
      <div className="walk-phone" aria-hidden="true">
        <div className="walk-screen" key={index}>
          {step.screen}
        </div>
        {step.tap && <span className="walk-tap" style={{ top: `${step.tap.top}%`, left: `${step.tap.left}%` }} />}
      </div>
      <p className="walk-caption" aria-live="polite">
        <strong>
          שלב {index + 1} מתוך {steps.length}
        </strong>
        {' · '}
        {step.caption}
      </p>
      <div className="walk-controls">
        <button type="button" className="icon-btn" aria-label="לשלב הקודם" disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronRight />
        </button>
        <button type="button" className="chip-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'עצירה' : 'הפעלה'}
        </button>
        <button type="button" className="icon-btn" aria-label="לשלב הבא" disabled={index === last} onClick={() => go(index + 1)}>
          <ChevronLeft />
        </button>
      </div>
    </div>
  );
}
