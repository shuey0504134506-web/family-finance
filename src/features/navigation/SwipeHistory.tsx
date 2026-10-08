import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { classifySwipe, isSwipeNavigationRoute } from '../../domain/swipeNav';

/** אזורים שבהם החלקה היא חלק מהממשק עצמו ולא ניווט. */
const IGNORE = 'input, textarea, select, .pattern-pad, .lock-screen, .modal, .chart-svg, [data-no-swipe]';

/**
 * החלקה אופקית במסכים פנימיים: ימינה חוזרת למסך הקודם, שמאלה מתקדמת למסך הבא.
 * בבית ההחלקה שייכת למעבר בין עסק למשק בית, ולכן לא פועלת שם.
 */
export function SwipeHistory() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = isSwipeNavigationRoute(pathname);

  useEffect(() => {
    if (!active) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || target?.closest(IGNORE)) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };
    const onEnd = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const direction = classifySwipe(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.t);
      start = null;
      if (direction === 'back') {
        // idx מתחיל ב-0 במסך הראשון של האפליקציה: מעבר לו אין לאן לחזור.
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) navigate(-1);
      } else if (direction === 'forward') {
        navigate(1);
      }
    };
    const onCancel = () => {
      start = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [active, navigate]);

  return null;
}
