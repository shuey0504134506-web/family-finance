import { useEffect, useSyncExternalStore } from 'react';

/**
 * רקע מותאם אישית למסך הבית (במשק הבית ובעסק). נשמר במכשיר בלבד: כל מכשיר, גם של אותו חשבון, בוחר תמונה משלו.
 * התמונה מוקטנת לפני השמירה, והעיצוב מציג אותה בדיוק באותה בהירות של נוף ההרים (שכבת הקרם שמעליה).
 */

const MAX_SIDE = 1600;
const MAX_CHARS = 1_500_000;
const EVENT = 'ff-home-bg-change';
const storageKey = (uid: string) => `ff.homeBg.v1.${uid}`;

export function readHomeBackground(uid: string): string | null {
  try {
    const value = localStorage.getItem(storageKey(uid));
    return value && value.startsWith('data:image/') ? value : null;
  } catch {
    return null;
  }
}

/** שומר או מסיר (null) את הרקע. זורק שגיאה אם האחסון במכשיר מלא או חסום. */
export function saveHomeBackground(uid: string, data: string | null): void {
  if (data === null) localStorage.removeItem(storageKey(uid));
  else localStorage.setItem(storageKey(uid), data);
  window.dispatchEvent(new Event(EVENT));
}

/** מקטין תמונה שנבחרה (עד 1600 פיקסלים בצד הארוך) ומחזיר data URL. זורק שגיאה אם אינה תמונה תקינה. */
export async function fileToBackground(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('type');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.65, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= MAX_CHARS) return data;
    }
    throw new Error('size');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

/** הרקע השמור במכשיר (מתעדכן מיד כשמשנים בהגדרות). */
export function useHomeBackgroundValue(uid: string): string | null {
  return useSyncExternalStore(subscribe, () => readHomeBackground(uid));
}

/** מפעיל את הרקע המותאם כל עוד מסך הבית מוצג (מסכים אחרים נשארים עם נוף ההרים). */
export function useHomeBackground(uid: string): void {
  const data = useHomeBackgroundValue(uid);
  useEffect(() => {
    if (!data) return undefined;
    document.body.style.setProperty('--home-bg', `url("${data}")`);
    document.body.classList.add('home-bg-on');
    return () => {
      document.body.classList.remove('home-bg-on');
      document.body.style.removeProperty('--home-bg');
    };
  }, [data]);
}
