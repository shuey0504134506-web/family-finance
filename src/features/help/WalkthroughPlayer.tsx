import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from '../../components/icons';
import { getLang } from '../../i18n/lang';
import scenes from './scenes.json';

export interface WalkthroughStep {
  /** הכיתוב שמסביר מה לעשות בשלב הזה */
  caption: string;
  /** מזהה הצילום של המסך האמיתי (scenes.json). החץ מצביע על האלמנט שנמדד בו. */
  scene: string;
}

interface Scene {
  img: string;
  /** מיקום היעד, כשבר מגודל המסך */
  x: number;
  y: number;
  w: number;
  h: number;
}

const STEP_MS = 3400;

const sceneFor = (id: string): { scene: Scene; lang: 'he' | 'en' } | null => {
  const all = scenes as Record<string, Record<string, Scene>>;
  const lang = getLang();
  const own = all[lang]?.[id];
  if (own) return { scene: own, lang };
  const fallback = all.he?.[id];
  return fallback ? { scene: fallback, lang: 'he' } : null;
};

/**
 * הדגמה מונפשת: צילום של המסך האמיתי של האפליקציה, חץ אדום בכתב יד שמצביע בדיוק על
 * מה שצריך ללחוץ (המיקום נמדד מהמסך האמיתי בעת הצילום), כיתוב לכל שלב וחיצים לעבור בין השלבים.
 * מתנגן אוטומטית בלולאה, ואפשר לעצור. מי שביקש פחות תנועה מקבל חץ נייח, בלי הנפשה.
 */
export function WalkthroughPlayer({ steps, label }: { steps: readonly WalkthroughStep[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = steps.length - 1;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIndex((i) => (i >= last ? 0 : i + 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, last]);

  const step = steps[index];

  const found = sceneFor(step.scene);
  const target = found?.scene;
  // יעד בחלק העליון של המסך: החץ מגיע מלמטה כלפי מעלה. אחרת מלמעלה כלפי מטה.
  const dir: 'down' | 'up' = target && target.y + target.h / 2 < 0.3 ? 'up' : 'down';
  const spot = target
    ? {
        left: Math.min(0.88, Math.max(0.12, target.x + target.w / 2)) * 100,
        top: (dir === 'down' ? target.y : target.y + target.h) * 100,
      }
    : null;

  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.min(last, Math.max(0, next)));
  };

  return (
    <div className="walk" role="group" aria-label={label}>
      <div className="walk-phone" aria-hidden="true">
        {found && target && (
          <>
            <img
              key={`s${index}`}
              className="walk-screen"
              src={`${import.meta.env.BASE_URL}help/${found.lang}/${target.img}`}
              alt=""
              width={540}
              height={960}
              loading="lazy"
              draggable={false}
            />
            <span
              key={`r${index}`}
              className="walk-ring"
              style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: `${target.w * 100}%`, height: `${target.h * 100}%` }}
            />
          </>
        )}
        {spot && (
          <span key={`a${index}`} className={`walk-arrow walk-arrow-${dir}`} style={{ left: `${spot.left}%`, top: `${spot.top}%` }}>
            <svg viewBox="0 0 60 112" width="36" height="68" fill="none" stroke="#d62828" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
              <line className="walk-arrow-line" x1="30" y1="4" x2="30" y2="102" />
              <polyline className="walk-arrow-head" points="12,82 30,104 48,82" />
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
