import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from '../../components/icons';

export interface WalkthroughStep {
  /** הכיתוב שמסביר מה לעשות בשלב הזה */
  caption: string;
  /** המסך המצויר בשלב הזה. הרכיב המודגש מסומן ב-className "mk-hl" והחץ האדום מצביע עליו. */
  screen: ReactNode;
  /** כיוון החץ. ברירת מחדל: מלמעלה למטה, ובחלק העליון של המסך מלמטה למעלה. */
  arrow?: 'down' | 'up';
}

const STEP_MS = 3400;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ArrowSpot {
  left: number;
  top: number;
  dir: 'down' | 'up';
}

/**
 * הדגמה מונפשת: טלפון מצויר, חץ אדום בכתב יד שמצביע על מה שצריך ללחוץ, כיתוב לכל שלב,
 * וחיצים לעבור בין השלבים. מתנגן אוטומטית בלולאה, ואפשר לעצור. מי שביקש פחות תנועה
 * מקבל הדגמה שמתקדמת רק בלחיצה.
 */
export function WalkthroughPlayer({ steps, label }: { steps: readonly WalkthroughStep[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [spot, setSpot] = useState<ArrowSpot | null>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const last = steps.length - 1;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIndex((i) => (i >= last ? 0 : i + 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, last]);

  const step = steps[index];

  // מיקום החץ נמדד מהמסך המצויר עצמו, כך שהוא תמיד מצביע על הפריט המודגש.
  useLayoutEffect(() => {
    const phone = phoneRef.current;
    const target = phone?.querySelector<HTMLElement>('.mk-hl');
    if (!phone || !target) {
      setSpot(null);
      return;
    }
    const p = phone.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const centerY = t.top - p.top + t.height / 2;
    const dir = step.arrow ?? (centerY < p.height * 0.3 ? 'up' : 'down');
    const left = Math.min(p.width - 34, Math.max(34, t.left - p.left + t.width / 2));
    setSpot({ left, top: dir === 'down' ? t.top - p.top - 2 : t.bottom - p.top + 2, dir });
  }, [index, step]);

  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.min(last, Math.max(0, next)));
  };

  return (
    <div className="walk" role="group" aria-label={label}>
      <div className="walk-phone" ref={phoneRef} aria-hidden="true">
        <div className="walk-screen" key={`s${index}`}>
          {step.screen}
        </div>
        {spot && (
          <span key={`a${index}`} className={`walk-arrow walk-arrow-${spot.dir}`} style={{ left: spot.left, top: spot.top }}>
            <svg viewBox="0 0 56 70" width="44" height="56" fill="none" stroke="#d62828" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path className="walk-arrow-line" d="M16 4 C 8 18, 26 24, 20 38 C 17 46, 28 50, 28 58" />
              <path className="walk-arrow-head" d="M28 62 L14 46 M28 62 L43 49" />
            </svg>
          </span>
        )}
      </div>
      <p className="walk-caption" aria-live="polite">
        <strong>
          שלב {index + 1} מתוך {steps.length}
        </strong>
        {' · '}
        {step.caption}
      </p>
      <div className="walk-dots" aria-hidden="true">
        {steps.map((_, i) => (
          <i key={i} className={i === index ? 'on' : ''} />
        ))}
      </div>
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
