import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * צליל ורטט עדין בזמן ספירת הסכומים (הנפשת הכניסה למסכים).
 * ההעדפה נשמרת במכשיר הזה בלבד, וברירת המחדל היא פעיל. כשהמכשיר לא מאפשר (דפדפן שחוסם צליל
 * לפני מגע ראשון, מכשיר בלי רטט) פשוט לא קורה כלום, והמסך עובד כרגיל.
 */
const KEY = 'ff.feedback.v1';
export interface FeedbackPrefs {
  sound: boolean;
  haptics: boolean;
}

export function getFeedbackPrefs(): FeedbackPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<FeedbackPrefs>;
    return { sound: p.sound !== false, haptics: p.haptics !== false };
  } catch {
    return { sound: true, haptics: true };
  }
}

export function setFeedbackPrefs(prefs: FeedbackPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // אחסון חסום: ההעדפה תחול עד לסגירת האפליקציה
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx.state === 'running' ? ctx : null;
  } catch {
    return null;
  }
}

// דפדפנים מתירים צליל רק אחרי מגע: מעירים את הצליל במגע הראשון
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
    window.addEventListener(type, () => void audio(), { once: true, passive: true });
  }
}

function blip(freq: number, ms: number, gain: number, type: OscillatorType = 'sine'): void {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

function haptic(style: ImpactStyle): void {
  Haptics.impact({ style }).catch(() => undefined);
}

let lastSound = 0;
let lastHaptic = 0;
let doneTimer: ReturnType<typeof setTimeout> | undefined;

/** "תק" קצר לכל צעד בספירה. progress בין 0 ל-1: הגובה עולה לאורך הספירה. כמה ספירות במקביל נותנות רצף אחד. */
export function countTick(progress: number): void {
  const now = performance.now();
  const prefs = getFeedbackPrefs();
  if (prefs.sound && now - lastSound >= 85) {
    lastSound = now;
    blip(480 + Math.min(1, Math.max(0, progress)) * 560, 22, 0.035, 'triangle');
  }
  if (prefs.haptics && now - lastHaptic >= 120) {
    lastHaptic = now;
    haptic(ImpactStyle.Light);
  }
}

/** סיום הספירה: צליל "דינג" רך ורטט אחד, פעם אחת גם אם כמה ספירות הסתיימו יחד. */
export function countDone(): void {
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => {
    const prefs = getFeedbackPrefs();
    if (prefs.sound) {
      blip(880, 160, 0.05);
      setTimeout(() => blip(1320, 220, 0.04), 70);
    }
    if (prefs.haptics) haptic(ImpactStyle.Medium);
  }, 120);
}
