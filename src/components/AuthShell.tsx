import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AuthBar } from './AuthBar';

const MIN_SCALE = 0.5;

/**
 * מעטפת אחידה לכל המסכים שלפני האפליקציה: שורת כותרת, רקע בהיר, והתוכן במסך אחד בלי גלילה.
 * התוכן מתכווץ אוטומטית לפי הגובה והרוחב הפנויים (עד גודל קריא); רק אם גם אז הוא לא נכנס
 * (למשל כשמקלדת פתוחה בטלפון קטן) מופיעה גלילה, כדי שלא יאבד שדה.
 * scroll: מסמכים ארוכים, כמו מדיניות פרטיות, שגוללים בתוך המסך.
 */
export function AuthShell({
  children,
  className = '',
  width = 440,
  scroll = false,
  label,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
  scroll?: boolean;
  label?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    if (scroll) return undefined;
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return undefined;
    const measure = () => {
      const needH = i.offsetHeight;
      const needW = i.offsetWidth;
      if (!needH || !needW) return;
      const z = Math.max(MIN_SCALE, Math.min(1, o.clientHeight / needH, o.clientWidth / needW));
      setFit((cur) => (Math.abs(cur.scale - z) < 0.002 && cur.height === needH ? cur : { scale: z, height: needH }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [scroll]);

  const style = { '--shell-w': `${width}px` } as CSSProperties;
  return (
    <main className={`auth-shell ${className}`} aria-label={label} style={style}>
      <AuthBar />
      <div className="auth-shell-body">
        {scroll ? (
          <div className="fit-outer fit-scroll">
            <div className="fit-inner">{children}</div>
          </div>
        ) : (
          <div className="fit-outer" ref={outer}>
            <div className="fit-slot" style={{ height: fit.height ? fit.height * fit.scale : undefined }}>
              <div className="fit-inner" ref={inner} style={{ transform: `scale(${fit.scale})` }}>
                {children}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
