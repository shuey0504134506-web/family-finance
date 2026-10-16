import type { WalkthroughStep } from '../../../src/features/help/WalkthroughPlayer';
import scenes from './helpScenes.json';

const st = (caption: string, scene: string): WalkthroughStep => ({ caption, scene });

/** הדגמות מצולמות מתוכנת המחשב, עם כיתובים שמתאימים למסכי התוכנה. */
export const DESKTOP_DEMOS: Record<string, WalkthroughStep[]> = {
  'add-expense': [
    st('במסך הסקירה לוחצים על "הוספת הוצאה".', 'home-add-expense'),
    st('מקלידים את הסכום.', 'exp-amount'),
    st('כותבים את שם בית העסק. אפשר גם להשאיר ריק.', 'exp-name'),
    st('בוחרים קטגוריה. אם חסרה, אפשר להוסיף קטגוריה חדשה מאותה שורה.', 'exp-category'),
    st('התאריך (היום) וצורת התשלום מוגדרים מראש. לשינוי לוחצים על "פרטים נוספים".', 'exp-more'),
    st('לוחצים על "שמירה", וההוצאה מופיעה מיד ברשימה ובסיכומים.', 'exp-save'),
  ],
  'add-income': [
    st('במסך הסקירה לוחצים על "הוספת הכנסה".', 'home-add-income'),
    st('מקלידים את הסכום ואת שם הלקוח או מקור ההכנסה.', 'inc-amount'),
    st('בוחרים איך קיבלת את הכסף: מזומן, העברה או צ׳ק. אפשר להוסיף צורה משלך בכפתור "אמצעי חדש".', 'inc-method'),
    st('לוחצים על "שמירה". ההכנסה נכנסת לסיכום החודש.', 'inc-save'),
  ],
  'edit-delete': [
    st('בתפריט הצד נכנסים ל"הוצאות" (או ל"הכנסות") ורואים את הפעולות של החודש.', 'menu-expenses'),
    st('העיפרון פותח את הפעולה לעריכה: משנים מה שצריך ושומרים.', 'list-edit'),
    st('הפח מוחק את הפעולה. לפני המחיקה יופיע אישור, כדי שלא תמחק בטעות.', 'list-delete'),
  ],
  categories: [
    st('נכנסים להוספת הוצאה (או הכנסה).', 'home-add-expense'),
    st('ליד כל קטגוריה יש ✕. לוחצים עליו.', 'cat-x'),
    st('נפתח חלון: שינוי שם או מחיקה. בקטגוריות של חובות אפשר להסיר.', 'cat-dialog'),
  ],
  'add-business': [
    st('נכנסים להגדרות דרך "הגדרות" בתפריט הצד.', 'home-gear'),
    st('פותחים את "ייעוד האפליקציה".', 'settings-mode'),
    st('כותבים את שם העסק החדש.', 'mode-add-name'),
    st('לוחצים על "הוספת עסק". העסק מופיע בכפתורי המרחבים שבראש התפריט הצד.', 'mode-add-btn'),
  ],
  budget: [
    st('בתפריט הצד נכנסים ל"תקציב".', 'menu-budget'),
    st('לוחצים על "הגדרת תקציב".', 'budget-set'),
    st('מקלידים סכום. "לכל החודשים" קובע תקציב קבוע, ו"לחודש זה בלבד" קובע תקציב מיוחד לחודש.', 'budget-amount'),
    st('לוחצים על "שמירה". במסך הסקירה יופיע פס שמראה כמה מהתקציב כבר נוצל.', 'budget-save'),
  ],
  'tithe-paid': [
    st('בהוספת הוצאה למעשר ממלאים סכום ובית עסק (למשל הגמ״ח או העמותה).', 'tithe-name'),
    st('מסמנים "זהו תשלום מעשר".', 'tithe-check'),
    st('שומרים. המעשרות מתעדכנות לבד, ובית העסק מצטרף לרשימת "למי ניתנו מעשרות".', 'tithe-save'),
  ],
  'tithe-recipients': [st('בתפריט הצד נכנסים ל"מעשרות", ושם מופיעה הרשימה "למי ניתנו מעשרות".', 'menu-tithes')],
  'debt-add': [
    st('בתפריט הצד נכנסים ל"חובות".', 'menu-debts'),
    st('לוחצים על "הוספת חוב" וממלאים למי, כמה ומה סוג החוב.', 'debt-add'),
  ],
  backup: [st('בהגדרות, ב"ניהול האפליקציה", לוחצים על "הורדת גיבוי מלא". הקובץ נשמר בתיקיית ההורדות של המחשב.', 'manage-backup')],
  lock: [
    st('בהגדרות פותחים את "אבטחה".', 'settings-security'),
    st('בוחרים קוד PIN (או תבנית) ומתי הנעילה פועלת.', 'lock-pin'),
  ],
  search: [
    st('בסמל החיפוש שבכותרת, או ב"חיפוש" בתפריט הצד.', 'home-search'),
    st('מקלידים שם בית עסק, קטגוריה, הערה או סכום.', 'search-type'),
  ],
  summary: [
    st('בתפריט הצד נכנסים ל"סיכומים והשוואות".', 'menu-summary'),
    st('בוחרים חודשי או שנתי, וממנו משווים בין חודשים.', 'summary-tabs'),
  ],
  'import-bank': [
    st('בתפריט הצד נכנסים ל"ייבוא נתונים".', 'menu-import'),
    st('בוחרים קובץ בנק (אקסל או CSV) מהמחשב, ובמסך הבא בודקים עמודות וקטגוריות.', 'import-pick'),
  ],
  'dk-recovery': [st('במסך "שחזור סיסמה" בתפריט הצד קובעים ומעדכנים את שלוש שאלות השחזור.', 'side-recovery')],
};

export const DESKTOP_SCENES = scenes as Record<string, { img: string; x: number; y: number; w: number; h: number }>;

const urls = import.meta.glob('../assets/help/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const imageUrl = (img: string): string => urls[`../assets/help/${img}`] ?? '';
export const SCREEN = { width: 1280, height: 800 };
