import { useEffect } from 'react';
import { autoDetectLang, changeLang, getLang } from '../i18n/lang';

/**
 * שורת הכותרת של כל מסכי הכניסה (דף הנחיתה, כניסה, הרשמה, נעילה ועוד):
 * מצד ההתחלה הסימבל עם "ניהול כספים", ובצד הסוף כפתור החלפת שפה אחד.
 * הסימבל והשם מופיעים רק כאן, ולכן המסכים עצמם לא מציגים לוגו משלהם.
 */
export function AuthBar({ heading = false }: { heading?: boolean }) {
  const lang = getLang();
  useEffect(() => {
    autoDetectLang();
  }, []);
  const Name = heading ? 'h1' : 'span';
  return (
    <header className="landing-bar">
      <div className="landing-brand">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={40} height={40} draggable={false} />
        <Name className="landing-brand-name">ניהול כספים</Name>
      </div>
      <button
        type="button"
        className="landing-lang"
        lang={lang === 'he' ? 'en' : 'he'}
        aria-label={lang === 'he' ? 'English' : 'עברית'}
        onClick={() => changeLang(lang === 'he' ? 'en' : 'he')}
      >
        {lang === 'he' ? 'English' : 'עברית'}
      </button>
    </header>
  );
}
