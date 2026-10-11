import type { WalkthroughStep } from './WalkthroughPlayer';

/**
 * שלבי ההדגמות. כל שלב מפנה לצילום של המסך האמיתי של האפליקציה (scenes.json), שנוצר
 * בכלי tools/helpcap. החץ מצביע על האלמנט האמיתי שנמדד בצילום.
 */
const st = (caption: string, scene: string): WalkthroughStep => ({ caption, scene });

export const ADD_EXPENSE_STEPS: WalkthroughStep[] = [
  st('במסך הבית לוחצים על "הוספת הוצאה".', 'home-add-expense'),
  st('מקלידים את הסכום.', 'exp-amount'),
  st('כותבים את שם בית העסק. אפשר גם להשאיר ריק.', 'exp-name'),
  st('בוחרים קטגוריה. אם חסרה, אפשר להוסיף קטגוריה חדשה מאותה שורה.', 'exp-category'),
  st('התאריך (היום) וצורת התשלום מוגדרים מראש. לשינוי לוחצים על "פרטים נוספים".', 'exp-more'),
  st('לוחצים על "שמירה", וההוצאה מופיעה מיד ברשימה ובסיכומים.', 'exp-save'),
];

export const ADD_INCOME_STEPS: WalkthroughStep[] = [
  st('במסך הבית לוחצים על "הוספת הכנסה".', 'home-add-income'),
  st('מקלידים את הסכום ואת שם הלקוח או מקור ההכנסה.', 'inc-amount'),
  st('בוחרים איך קיבלת את הכסף: מזומן, העברה או צ׳ק. אפשר להוסיף צורות משלך בהגדרות.', 'inc-method'),
  st('לוחצים על "שמירה". ההכנסה נכנסת לסיכום החודש.', 'inc-save'),
];

export const EDIT_DELETE_STEPS: WalkthroughStep[] = [
  st('בתפריט נכנסים ל"הוצאות" (או ל"הכנסות") ורואים את הפעולות של החודש.', 'menu-expenses'),
  st('העיפרון פותח את הפעולה לעריכה: משנים מה שצריך ושומרים.', 'list-edit'),
  st('הפח מוחק את הפעולה. לפני המחיקה יופיע אישור, כדי שלא תמחק בטעות.', 'list-delete'),
];

export const CATEGORIES_STEPS: WalkthroughStep[] = [
  st('נכנסים להוספת הוצאה (או הכנסה).', 'home-add-expense'),
  st('ליד כל קטגוריה יש ✕. לוחצים עליו.', 'cat-x'),
  st('נפתח חלון: שינוי שם, השבתה או מחיקה. אותו דבר גם בקטגוריות של חובות.', 'cat-dialog'),
];

export const ADD_BUSINESS_STEPS: WalkthroughStep[] = [
  st('נכנסים להגדרות דרך הגלגל בפינה.', 'home-gear'),
  st('פותחים את "ייעוד האפליקציה".', 'settings-mode'),
  st('כותבים את שם העסק החדש.', 'mode-add-name'),
  st('לוחצים על "הוספת עסק". העסק מופיע בכפתורים שבתחתית המסך.', 'mode-add-btn'),
];

export const SWITCH_SPACE_STEPS: WalkthroughStep[] = [
  st('בתחתית מסך הבית יש כפתור לכל עסק ולמשק הבית. לוחצים על העסק.', 'switch-biz'),
  st('המסך מתחלף לעסק: הכנסות, הוצאות ותקציב שלו בלבד. לחזרה למשק הבית לוחצים על הכפתור שלו, וגם גרירה הצידה במסך הבית עוברת ביניהם.', 'switch-hh'),
];

export const BUDGET_STEPS: WalkthroughStep[] = [
  st('בתפריט נכנסים ל"תקציב".', 'menu-budget'),
  st('בוחרים חודשי או שנתי, ולוחצים על "הגדרת תקציב".', 'budget-set'),
  st('מקלידים סכום. "לכל החודשים" קובע תקציב קבוע, ו"לחודש זה בלבד" קובע תקציב מיוחד לחודש.', 'budget-amount'),
  st('לוחצים על "שמירה". במסך הבית יופיע פס שמראה כמה מהתקציב כבר נוצל.', 'budget-save'),
];

export const TITHE_PAID_STEPS: WalkthroughStep[] = [
  st('בהוספת הוצאה למעשר ממלאים סכום ובית עסק (למשל הגמ״ח או העמותה).', 'tithe-name'),
  st('מסמנים "זהו תשלום מעשר".', 'tithe-check'),
  st('שומרים. המעשרות מתעדכנות לבד, ובית העסק מצטרף לרשימת "למי ניתנו מעשרות".', 'tithe-save'),
];

export const TITHE_RECIPIENTS_STEPS: WalkthroughStep[] = [
  st('בתפריט (במשק הבית) לוחצים על "מעשרות".', 'menu-tithes'),
  st('למטה רואים את הרשימה "למי ניתנו מעשרות": כל בית עסק עם הסכום הכולל, מספר התשלומים והתאריך האחרון.', 'tithe-recipients'),
];

export const CURRENCY_STEPS: WalkthroughStep[] = [
  st('בטופס ההוספה לוחצים על "פרטים נוספים".', 'cur-more'),
  st('בוחרים מטבע. הפעולה נשמרת במטבע שבחרת, ואינה נספרת בתקציב ובמעשרות.', 'cur-pick'),
  st('בסיכום יופיע שורה נפרדת לכל מטבע, ואפשר להמיר לשקלים לפי השער של היום.', 'cur-summary'),
];

export const DEBT_STEPS: WalkthroughStep[] = [
  st('בתפריט נכנסים ל"חובות".', 'menu-debts'),
  st('לוחצים על "הוספת חוב".', 'debt-add'),
  st('בוחרים אם אתה החייב ("אני חייב") או שחייבים לך ("חייבים לי").', 'debt-direction'),
  st('ממלאים שם, סכום, קטגוריה וצורת תשלום. אפשר להוסיף גם תאריך יעד לפירעון.', 'debt-fields'),
  st('לוחצים על "שמירה". החוב מופיע בסיכום "אני חייב", ולא נספר בהכנסות או בהוצאות.', 'debt-save'),
];

export const DEBT_PAYMENT_STEPS: WalkthroughStep[] = [
  st('בחוב שנוצר לוחצים על "רישום תשלום".', 'debt-saved'),
  st('כותבים כמה שילמת ובאיזה תאריך. אי אפשר לשלם יותר מהיתרה.', 'debt-pay-fill'),
  st('אחרי השמירה היתרה יורדת, והתשלום נשמר בהיסטוריה. כשהיתרה מגיעה לאפס החוב עובר ל"שולמו".', 'debt-pay-saved'),
];

export const BACKUP_STEPS: WalkthroughStep[] = [
  st('נכנסים להגדרות דרך הגלגל.', 'home-gear'),
  st('פותחים את "ניהול האפליקציה".', 'settings-manage'),
  st('בחלק "גיבוי ושחזור" לוחצים על "הורדת גיבוי מלא". בטלפון ייפתח חלון שיתוף: בוחרים לשמור בקבצים או ב-Drive.', 'manage-backup'),
];

export const LOCK_STEPS: WalkthroughStep[] = [
  st('נכנסים להגדרות דרך הגלגל.', 'home-gear'),
  st('פותחים את "אבטחה".', 'settings-security'),
  st('בוחרים איך נכנסים לאפליקציה: סיסמת החשבון, קוד PIN או תבנית.', 'lock-pin'),
  st('מקלידים קוד של 4 עד 8 ספרות פעמיים, ושומרים. מתחת אפשר לבחור מתי הנעילה פועלת.', 'lock-pin-set'),
];

export const LANGUAGE_STEPS: WalkthroughStep[] = [
  st('נכנסים להגדרות דרך הגלגל.', 'home-gear'),
  st('פותחים את "שפה".', 'settings-lang'),
  st('בוחרים עברית או English. האפליקציה נטענת מחדש בלי צורך להתחבר שוב.', 'lang-select'),
];

export const SEARCH_STEPS: WalkthroughStep[] = [
  st('בפינה העליונה לוחצים על סמל החיפוש.', 'home-search'),
  st('מקלידים שם בית עסק, קטגוריה, הערה או סכום, והתוצאות מופיעות מיד.', 'search-type'),
];

export const SUMMARY_STEPS: WalkthroughStep[] = [
  st('בתפריט נכנסים ל"סיכומים והשוואות".', 'menu-summary'),
  st('בוחרים חודשי או שנתי. רואים הוצאות והכנסות לפי קטגוריה.', 'summary-tabs'),
  st('למטה יש גרף השוואה בין חודשים או שנים. בוחרים כמה חודשים להציג, ולוחצים על עמודה כדי לראות את הסכום.', 'summary-compare'),
];

export const DEFAULTS_STEPS: WalkthroughStep[] = [
  st('נכנסים להגדרות דרך הגלגל.', 'home-gear'),
  st('פותחים את "ברירות מחדל להוספה".', 'settings-defaults'),
  st('לכל מקרה בנפרד (הכנסה או הוצאה, במשק הבית או בעסק) בוחרים צורת תשלום ומטבע שיופיעו מוכנים בטופס.', 'defaults-pay'),
];

export const CUSTOM_METHOD_STEPS: WalkthroughStep[] = [
  st('בהגדרות פותחים את "ברירות מחדל להוספה".', 'settings-defaults'),
  st('בחלק "אמצעי תשלום משלי" בוחרים הכנסה או הוצאה, כותבים שם (למשל "ביט") ולוחצים הוספה.', 'defaults-custom-name'),
  st('האמצעי החדש מופיע מעכשיו בטופס ההוספה, בין צורות התשלום.', 'custom-in-form'),
];

export const HIDE_BUSINESS_STEPS: WalkthroughStep[] = [
  st('בהגדרות פותחים את "ייעוד האפליקציה".', 'settings-mode'),
  st('בחלק "מה להציג במכשיר הזה" מסמנים או מבטלים עסק. עסק שלא מוצג לא נמחק, והנתונים שלו נשמרים.', 'mode-visible'),
];

