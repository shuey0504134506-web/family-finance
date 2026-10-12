/**
 * שער להנפשות: כשהאפליקציה נעולה העץ מוצג מאחורי מסך הנעילה (מוסתר), ואסור שההנפשות והצלילים יתחילו שם.
 * ההנפשות מתחילות רק אחרי שהשער נפתח, כלומר אחרי הקשת הקוד.
 */
let paused = false;
const listeners = new Set<() => void>();

export function setAnimationsPaused(value: boolean): void {
  if (paused === value) return;
  paused = value;
  listeners.forEach((fn) => fn());
}

export function animationsPaused(): boolean {
  return paused;
}

export function onAnimationGateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
