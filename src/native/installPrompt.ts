/**
 * התקנת הווב-אפ בלחיצה אחת. הדפדפן שולח את beforeinstallprompt פעם אחת בטעינה,
 * לכן שומרים אותו מוקדם (מ-main.tsx) ודף הנחיתה משתמש בו כשהמשתמש לוחץ.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function onInstallPromptChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** מציג את חלון ההתקנה של הדפדפן מיד. מחזיר false אם הדפדפן לא מאפשר (אז מציגים הוראות). */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  await ev.prompt();
  const choice = await ev.userChoice;
  return choice.outcome === 'accepted';
}

/** האם האתר פתוח כאפליקציה מותקנת (ווב-אפ) או בתוך אפליקציית האנדרואיד. */
export function isInstalledApp(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      nav.standalone === true
    );
  } catch {
    return false;
  }
}
