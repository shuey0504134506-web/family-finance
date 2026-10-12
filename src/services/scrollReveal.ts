import { motionAllowed } from '../hooks/useCountUp';
import { animationsPaused, onAnimationGateChange } from './animationGate';

/**
 * פסי מצב וגרפים מונפשים רק כשהם נכנסים למסך (לפי גלילה). מה שעדיין לא נראה נשאר מכווץ וממתין.
 * מוסיף class "reveal" לפס/גרף, ו-"in-view" כשהוא נראה. ה-CSS עושה את התנועה.
 * כשהמכשיר מבקש להפחית תנועה (או בלי IntersectionObserver) לא נוגעים בכלום והכול מוצג מיד.
 */
const SELECTOR = '.row-bar, .budget-bar, .share-bar, .chart-svg';

export function startScrollReveal(): void {
  if (typeof document === 'undefined' || typeof IntersectionObserver === 'undefined' || !motionAllowed()) return;
  // אלמנטים שנראו בזמן שהאפליקציה נעולה ממתינים עד לפתיחת הנעילה
  const waiting = new Set<Element>();
  const reveal = (el: Element) => {
    el.classList.add('in-view');
    io.unobserve(el);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (animationsPaused()) waiting.add(e.target);
        else reveal(e.target);
      }
    },
    { threshold: 0.2 },
  );
  onAnimationGateChange(() => {
    if (animationsPaused()) return;
    waiting.forEach(reveal);
    waiting.clear();
  });
  const seen = new WeakSet<Element>();
  const track = (el: Element) => {
    if (seen.has(el)) return;
    seen.add(el);
    el.classList.add('reveal');
    io.observe(el);
  };
  const scan = (root: Element | Document) => {
    if (root instanceof Element && root.matches(SELECTOR)) track(root);
    root.querySelectorAll(SELECTOR).forEach(track);
  };
  scan(document);
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && scan(n));
  }).observe(document.body, { childList: true, subtree: true });
}
