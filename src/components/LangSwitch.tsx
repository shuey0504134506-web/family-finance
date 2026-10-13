import { useEffect } from 'react';
import { autoDetectLang, changeLang, getLang, type Lang } from '../i18n/lang';

/**
 * בורר שפה קטן למסכי הכניסה והרישום (לפני שיש חשבון). בטעינה הראשונה במכשיר שאינו בעברית
 * האפליקציה עוברת לאנגלית. החלפת שפה מרעננת את המסך.
 */
export function LangSwitch() {
  useEffect(() => {
    autoDetectLang();
  }, []);
  const current = getLang();
  const options: Array<[Lang, string]> = [
    ['he', 'עברית'],
    ['en', 'English'],
  ];
  return (
    <div className="lang-switch" role="group" aria-label={current === 'en' ? 'Language' : 'שפה'}>
      {options.map(([code, label]) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={current === code ? 'is-active' : ''}
          aria-pressed={current === code}
          onClick={() => changeLang(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
