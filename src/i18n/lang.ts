/** שפת הממשק. נשמרת במכשיר בלבד (כמו הגדרות תצוגה), ומוחלת על המסמך. */
export type Lang = 'he' | 'en';

const STORAGE_KEY = 'ff.lang.v1';
const LANG_RELOAD_KEY = 'ff.langReload.v1';

/** האם הדף נטען עכשיו בגלל החלפת שפה (בתוך 15 שניות). נקרא פעם אחת בטעינת הדף. */
export const reloadedForLangChange: boolean = (() => {
  try {
    const at = Number(sessionStorage.getItem(LANG_RELOAD_KEY));
    sessionStorage.removeItem(LANG_RELOAD_KEY);
    return at > 0 && Date.now() - at < 15000;
  } catch {
    return false;
  }
})();

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

let current: Lang = readStored();

export function getLang(): Lang {
  return current;
}

export function isEnglish(): boolean {
  return current === 'en';
}

/** מחילה שפה על המסמך: lang, כיוון הטקסט וכותרת. */
export function applyDocumentLang(lang: Lang = current): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
}

/** מחליפה שפה, שומרת במכשיר ומרעננת כדי שכל המסכים ייבנו מחדש בשפה החדשה. */
export function changeLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ללא אחסון: השפה תחול עד הרענון הבא בלבד.
  }
  applyDocumentLang(lang);
  // הרענון בגלל החלפת שפה אינו יציאה מהאפליקציה: לא נועלים אותה מחדש.
  try {
    sessionStorage.setItem(LANG_RELOAD_KEY, String(Date.now()));
  } catch {
    // ללא אחסון: ייתכן שתידרש פתיחת נעילה.
  }
  if (typeof window !== 'undefined') window.location.reload();
}

/** לבדיקות בלבד. */
export function setLangForTest(lang: Lang): void {
  current = lang;
}
