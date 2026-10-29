import {
  getDocFromCache,
  getDocsFromCache,
  onSnapshot as firestoreOnSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

const EMPTY_CACHE_DELAY_MS = 800;

/**
 * onSnapshot שמציג מיד את מה ששמור במכשיר.
 *
 * בלי זה Firestore לא מציג שום דבר עד שהשרת עונה, או עד שהוא מחליט שאין חיבור, וזה יכול לקחת
 * עד 10 שניות (רשת שמדווחת "מחוברת" בלי אינטרנט בפועל, או תור גדול של פעולות שממתינות לסנכרון).
 * כאן קוראים קודם מהמטמון המקומי (מיידי), ואם יש שם נתונים מציגים אותם. ברגע שההאזנה החיה
 * מחזירה תשובה היא מחליפה אותם, ומכאן ממשיכים כרגיל. מטמון ריק מדווח אחרי רגע קצר, אם השרת לא ענה.
 */
export const onSnapshot = ((ref: DocumentReference | Query, ...rest: unknown[]) => {
  const nextIndex = rest.findIndex((arg) => typeof arg === 'function');
  const next = rest[nextIndex] as (snapshot: unknown) => void;
  let live = false;
  let stopped = false;
  const deliver = (snapshot: unknown) => {
    if (live || stopped) return;
    const s = snapshot as { exists?: () => boolean; empty?: boolean };
    if (typeof s.exists === 'function') {
      if (s.exists()) next(snapshot);
      return;
    }
    if (!s.empty) {
      next(snapshot);
      return;
    }
    // מטמון ריק: ייתכן שפשוט עוד לא הורד כלום (כניסה ראשונה במכשיר). נותנים לשרת רגע לענות לפני שמציגים "ריק",
    // אבל לא מחכים לנצח: בלי חיבור המסך נפתח ריק אחרי פחות משנייה, ולא אחרי 10 שניות.
    window.setTimeout(() => deliver2(snapshot), EMPTY_CACHE_DELAY_MS);
  };
  const deliver2 = (snapshot: unknown) => {
    if (!live && !stopped) next(snapshot);
  };
  const cached: Promise<unknown> = (ref as { type: string }).type === 'document'
    ? getDocFromCache(ref as DocumentReference)
    : getDocsFromCache(ref as Query);
  cached.then(deliver, () => undefined);
  const args = [...rest];
  args[nextIndex] = (snapshot: unknown) => {
    live = true;
    next(snapshot);
  };
  const stop = (firestoreOnSnapshot as (...a: unknown[]) => () => void)(ref, ...args);
  return () => {
    stopped = true;
    stop();
  };
}) as typeof firestoreOnSnapshot;
