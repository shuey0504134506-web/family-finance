import { mock, type MockItem } from './mock';
import type { WalkthroughStep } from './WalkthroughPlayer';

type Step = WalkthroughStep;
const s = (caption: string, items: MockItem[], arrow?: 'down' | 'up'): Step => ({ caption, screen: mock(items), arrow });

const SPACE = 'ביתנו האהוב';

/** מסך בית מצויר. */
const home = (hl: Partial<{ income: boolean; expense: boolean; menu: boolean; settings: boolean; search: boolean; hom: boolean; biz: boolean }> = {}): MockItem[] => [
  { t: 'header', hlMenu: hl.menu, hlSearch: hl.search, hlSettings: hl.settings },
  { t: 'balance' },
  { t: 'bar', label: 'סך הכנסות', value: '13,333 ₪', pct: 100 },
  { t: 'bar', label: 'סך הוצאות', value: '11,170 ₪', pct: 84, color: '#b8442f' },
  { t: 'btnrow', items: [{ label: 'הוספת הכנסה', kind: 'in', hl: hl.income }, { label: 'הוספת הוצאה', kind: 'out', hl: hl.expense }] },
  { t: 'bar', label: 'תקציב', value: '56%', pct: 56, color: '#1f6f66' },
  { t: 'spacer' },
  { t: 'tabs', items: [{ l: 'העסק שלי', hl: hl.biz }, { l: SPACE, on: true, hl: hl.hom }] },
];

const menu = (hl: string): MockItem[] => [
  { t: 'title', text: `תפריט · ${SPACE}` },
  ...['הכנסות', 'הוצאות', 'תקציב', 'סיכומים והשוואות', 'חובות', 'מעשרות', 'רשימת משימות', 'רשימת קניות', 'עזרה'].map((label) => ({ t: 'row' as const, label, value: '‹', hl: label === hl })),
];

const settings = (hl: string): MockItem[] => [
  { t: 'title', text: 'הגדרות' },
  ...['פרטי חשבון', 'ייעוד האפליקציה', 'ברירות מחדל להוספה', 'שפה', 'ניהול האפליקציה', 'אבטחה', 'מחיקת חשבון'].map((label) => ({ t: 'row' as const, label, value: '▾', hl: label === hl })),
];

const expenseForm = (focus: 'amount' | 'name' | 'category' | 'more' | 'tithe' | 'save', filled: number): MockItem[] => [
  { t: 'title', text: 'הוספת הוצאה' },
  { t: 'field', label: 'סכום (₪)', value: filled >= 1 ? '85' : '', hl: focus === 'amount' },
  { t: 'field', label: 'שם הספק / בית העסק', value: filled >= 2 ? 'שופרסל' : '', hl: focus === 'name' },
  { t: 'chips', label: 'קטגוריה', items: [{ l: 'מזון', on: filled >= 3, hl: focus === 'category' }, { l: 'תחבורה' }, { l: 'בריאות' }] },
  { t: 'row', label: 'פרטים נוספים', value: '▾', hl: focus === 'more' },
  { t: 'toggle', label: 'זהו תשלום מעשר', on: focus === 'tithe' && filled >= 4, hl: focus === 'tithe' },
  { t: 'spacer' },
  { t: 'btn', label: 'שמירה', hl: focus === 'save' },
];

export const ADD_EXPENSE_STEPS: Step[] = [
  s('במסך הבית לוחצים על "הוספת הוצאה".', home({ expense: true })),
  s('מקלידים את הסכום.', expenseForm('amount', 1)),
  s('כותבים את שם בית העסק. אפשר גם להשאיר ריק.', expenseForm('name', 2)),
  s('בוחרים קטגוריה. אם חסרה, אפשר להוסיף קטגוריה חדשה מאותה שורה.', expenseForm('category', 3)),
  s('התאריך (היום) וצורת התשלום מוגדרים מראש. לשינוי לוחצים על "פרטים נוספים".', expenseForm('more', 3)),
  s('לוחצים על "שמירה", וההוצאה מופיעה מיד ברשימה ובסיכומים.', expenseForm('save', 3)),
];

export const ADD_INCOME_STEPS: Step[] = [
  s('במסך הבית לוחצים על "הוספת הכנסה".', home({ income: true })),
  s('מקלידים את הסכום ואת שם הלקוח או מקור ההכנסה.', [
    { t: 'title', text: 'הוספת הכנסה' },
    { t: 'field', label: 'סכום (₪)', value: '4,200', hl: true },
    { t: 'field', label: 'מקור ההכנסה / שם הלקוח', value: 'משכורת' },
    { t: 'chips', label: 'קטגוריה', items: [{ l: 'משכורת', on: true }, { l: 'מתנה' }] },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה' },
  ]),
  s('בוחרים איך קיבלת את הכסף: מזומן, העברה או צ׳ק. אפשר להוסיף צורות משלך בהגדרות.', [
    { t: 'title', text: 'הוספת הכנסה' },
    { t: 'field', label: 'סכום (₪)', value: '4,200' },
    { t: 'chips', label: 'צורת הכנסה', items: [{ l: 'מזומן' }, { l: 'העברה', on: true, hl: true }, { l: 'צ׳ק' }] },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה' },
  ]),
  s('לוחצים על "שמירה". ההכנסה נכנסת לסיכום החודש.', [
    { t: 'title', text: 'הוספת הכנסה' },
    { t: 'field', label: 'סכום (₪)', value: '4,200' },
    { t: 'chips', label: 'צורת הכנסה', items: [{ l: 'מזומן' }, { l: 'העברה', on: true }, { l: 'צ׳ק' }] },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה', hl: true },
  ]),
];

const txList = (hl: 'edit' | 'delete' | 'none'): MockItem[] => [
  { t: 'title', text: `הוצאות · ${SPACE}` },
  { t: 'tx', title: 'שופרסל', sub: 'מזון · מזומן', amount: '85 ₪', hlEdit: hl === 'edit', hlDelete: hl === 'delete' },
  { t: 'tx', title: 'פז', sub: 'תחבורה · אשראי', amount: '240 ₪' },
];

export const EDIT_DELETE_STEPS: Step[] = [
  s('בתפריט נכנסים ל"הוצאות" (או ל"הכנסות") ורואים את הפעולות של החודש.', menu('הוצאות')),
  s('העיפרון פותח את הפעולה לעריכה: משנים מה שצריך ושומרים.', txList('edit')),
  s('הפח מוחק את הפעולה. לפני המחיקה יופיע אישור, כדי שלא תמחק בטעות.', txList('delete')),
];

export const CATEGORIES_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל בפינה.', home({ settings: true })),
  s('פותחים את "ניהול האפליקציה".', settings('ניהול האפליקציה')),
  s('לוחצים על "ניהול קטגוריות". שם מוסיפים קטגוריה, משנים שם ומוחקים.', [
    { t: 'title', text: 'ניהול האפליקציה' },
    { t: 'note', text: 'מעשרות וחישובים' },
    { t: 'field', label: 'אחוז מעשר (%)', value: '10' },
    { t: 'btn', label: 'ניהול קטגוריות', kind: 'ghost', hl: true },
    { t: 'btn', label: 'הורדת גיבוי מלא (JSON)', kind: 'ghost' },
  ]),
];

export const ADD_BUSINESS_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל בפינה.', home({ settings: true })),
  s('פותחים את "ייעוד האפליקציה".', settings('ייעוד האפליקציה')),
  s('כותבים את שם העסק החדש.', [
    { t: 'title', text: 'ייעוד האפליקציה' },
    { t: 'note', text: 'העסקים' },
    { t: 'field', label: 'הוספת עסק', value: 'סטודיו דנה', hl: true },
    { t: 'btn', label: 'הוספת עסק', kind: 'ghost' },
  ]),
  s('לוחצים על "הוספת עסק". העסק מופיע בכפתורים שבתחתית המסך.', [
    { t: 'title', text: 'ייעוד האפליקציה' },
    { t: 'note', text: 'העסקים' },
    { t: 'field', label: 'הוספת עסק', value: 'סטודיו דנה' },
    { t: 'btn', label: 'הוספת עסק', kind: 'ghost', hl: true },
  ]),
];

export const SWITCH_SPACE_STEPS: Step[] = [
  s('בתחתית מסך הבית יש כפתור לכל עסק ולמשק הבית. לוחצים על העסק.', home({ biz: true })),
  s('המסך מתחלף לעסק: הכנסות, הוצאות ותקציב שלו בלבד. גם גרירה הצידה במסך הבית עוברת ביניהם.', [
    { t: 'header' },
    { t: 'balance', text: 'החודש אנחנו בפלוס', amount: '8,400 ₪' },
    { t: 'bar', label: 'סך הכנסות', value: '12,000 ₪', pct: 100 },
    { t: 'bar', label: 'סך הוצאות', value: '3,600 ₪', pct: 30, color: '#b8442f' },
    { t: 'spacer' },
    { t: 'tabs', items: [{ l: 'העסק שלי', on: true }, { l: SPACE, hl: true }] },
  ]),
];

export const BUDGET_STEPS: Step[] = [
  s('בתפריט נכנסים ל"תקציב".', menu('תקציב')),
  s('בוחרים חודשי או שנתי, ולוחצים על "הגדרת תקציב".', [
    { t: 'title', text: `תקציב · ${SPACE}` },
    { t: 'tabs', items: [{ l: 'חודשי', on: true }, { l: 'שנתי' }] },
    { t: 'bar', label: 'מזון', value: 'לא הוגדר', pct: 0 },
    { t: 'btn', label: 'הגדרת תקציב', kind: 'ghost', hl: true },
  ]),
  s('מקלידים סכום. "לכל החודשים" קובע תקציב קבוע, ו"לחודש זה בלבד" קובע תקציב מיוחד לחודש.', [
    { t: 'title', text: `תקציב · ${SPACE}` },
    { t: 'tabs', items: [{ l: 'לכל החודשים', on: true, hl: true }, { l: 'לחודש זה בלבד' }] },
    { t: 'field', label: 'תקציב חודשי (₪)', value: '2,500' },
    { t: 'btn', label: 'שמירה' },
  ]),
  s('לוחצים על "שמירה". במסך הבית יופיע פס שמראה כמה מהתקציב כבר נוצל.', [
    { t: 'title', text: `תקציב · ${SPACE}` },
    { t: 'field', label: 'תקציב חודשי (₪)', value: '2,500' },
    { t: 'btn', label: 'שמירה', hl: true },
  ]),
];

export const TITHE_PAID_STEPS: Step[] = [
  s('בהוספת הוצאה למעשר ממלאים סכום ובית עסק (למשל הגמ״ח או העמותה).', expenseForm('name', 2)),
  s('מסמנים "זהו תשלום מעשר".', expenseForm('tithe', 4)),
  s('שומרים. המעשרות מתעדכנות לבד, ובית העסק מצטרף לרשימת "למי ניתנו מעשרות".', expenseForm('save', 4)),
];

export const TITHE_RECIPIENTS_STEPS: Step[] = [
  s('בתפריט (במשק הבית) לוחצים על "מעשרות".', menu('מעשרות')),
  s('למטה רואים את הרשימה "למי ניתנו מעשרות": כל בית עסק עם הסכום הכולל, מספר התשלומים והתאריך האחרון.', [
    { t: 'title', text: `מעשרות · ${SPACE}` },
    { t: 'balance', text: 'נותר לתת', amount: '1,333 ₪' },
    { t: 'note', text: 'למי ניתנו מעשרות' },
    { t: 'row', label: 'גמ״ח חסד', value: '2,400 ₪', hl: true },
    { t: 'row', label: 'ישיבת הרב', value: '1,200 ₪' },
    { t: 'row', label: 'ללא שם', value: '300 ₪' },
  ]),
];

export const CURRENCY_STEPS: Step[] = [
  s('בטופס ההוספה לוחצים על "פרטים נוספים".', expenseForm('more', 3)),
  s('בוחרים מטבע. הפעולה נשמרת במטבע שבחרת, ואינה נספרת בתקציב ובמעשרות.', [
    { t: 'title', text: 'הוספת הוצאה' },
    { t: 'field', label: 'תאריך', value: 'היום' },
    { t: 'chips', label: 'מטבע', items: [{ l: '₪', on: false }, { l: '$', on: true, hl: true }, { l: '€' }, { l: '£' }] },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה' },
  ]),
  s('בסיכום יופיע שורה נפרדת לכל מטבע, ואפשר להמיר לשקלים לפי השער של היום.', [
    { t: 'balance', text: 'בסיכום', amount: '₪ + $' },
    { t: 'row', label: 'סך הוצאות ₪', value: '11,170' },
    { t: 'row', label: 'סך הוצאות $', value: '120', hl: true },
  ]),
];

export const DEBT_STEPS: Step[] = [
  s('בתפריט נכנסים ל"חובות".', menu('חובות')),
  s('לוחצים על "הוספת חוב", ובוחרים אם אתה החייב ("אני חייב") או שחייבים לך ("חייבים לי").', [
    { t: 'title', text: `חובות · ${SPACE}` },
    { t: 'btn', label: 'הוספת חוב', hl: true },
    { t: 'tabs', items: [{ l: 'פתוחים', on: true }, { l: 'שולמו' }] },
  ]),
  s('ממלאים שם, סכום, קטגוריה וצורת תשלום. אפשר להוסיף גם תאריך יעד לפירעון.', [
    { t: 'title', text: 'חוב חדש' },
    { t: 'tabs', items: [{ l: 'אני חייב', on: true, hl: true }, { l: 'חייבים לי' }] },
    { t: 'field', label: 'למי אני חייב', value: 'בנק הפועלים' },
    { t: 'field', label: 'סכום (₪)', value: '20,000' },
    { t: 'chips', label: 'קטגוריה', items: [{ l: 'הלוואה בנקאית', on: true }, { l: 'אחר' }] },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה' },
  ]),
  s('לוחצים על "שמירה". החוב מופיע בסיכום "אני חייב", ולא נספר בהכנסות או בהוצאות.', [
    { t: 'title', text: 'חוב חדש' },
    { t: 'field', label: 'למי אני חייב', value: 'בנק הפועלים' },
    { t: 'field', label: 'סכום (₪)', value: '20,000' },
    { t: 'spacer' },
    { t: 'btn', label: 'שמירה', hl: true },
  ]),
];

export const DEBT_PAYMENT_STEPS: Step[] = [
  s('בחוב שנוצר לוחצים על "רישום תשלום".', [
    { t: 'title', text: `חובות · ${SPACE}` },
    { t: 'tx', title: 'בנק הפועלים', sub: 'יתרה 20,000 ₪', amount: 'אני חייב' },
    { t: 'btnrow', items: [{ label: 'רישום תשלום', kind: 'primary', hl: true }, { label: 'עריכה', kind: 'ghost' }] },
  ]),
  s('כותבים כמה שילמת ובאיזה תאריך. אי אפשר לשלם יותר מהיתרה.', [
    { t: 'title', text: 'רישום תשלום' },
    { t: 'field', label: 'סכום התשלום (₪)', value: '1,500', hl: true },
    { t: 'field', label: 'תאריך', value: 'היום' },
    { t: 'btn', label: 'שמירת תשלום' },
  ]),
  s('אחרי השמירה היתרה יורדת, והתשלום נשמר בהיסטוריה. כשהיתרה מגיעה לאפס החוב עובר ל"שולמו".', [
    { t: 'title', text: `חובות · ${SPACE}` },
    { t: 'tx', title: 'בנק הפועלים', sub: 'יתרה 18,500 ₪', amount: 'אני חייב' },
    { t: 'row', label: '01/10 · שולם', value: '1,500 ₪', hl: true },
  ]),
];

export const BACKUP_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל.', home({ settings: true })),
  s('פותחים את "ניהול האפליקציה".', settings('ניהול האפליקציה')),
  s('בחלק "גיבוי ושחזור" לוחצים על "הורדת גיבוי מלא". בטלפון ייפתח חלון שיתוף: בוחרים לשמור בקבצים או ב-Drive.', [
    { t: 'title', text: 'גיבוי ושחזור' },
    { t: 'btn', label: 'הורדת גיבוי מלא (JSON)', kind: 'ghost', hl: true },
    { t: 'btn', label: 'הורדת הפעולות לאקסל (CSV)', kind: 'ghost' },
    { t: 'toggle', label: 'גיבוי אוטומטי פעם בשבוע', on: false },
  ]),
];

export const LOCK_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל.', home({ settings: true })),
  s('פותחים את "אבטחה".', settings('אבטחה')),
  s('בוחרים איך נכנסים לאפליקציה: סיסמת החשבון, קוד PIN או תבנית.', [
    { t: 'title', text: 'נעילת האפליקציה' },
    { t: 'toggle', label: 'סיסמת החשבון (ברירת מחדל)', on: false },
    { t: 'toggle', label: 'קוד PIN', on: true, hl: true },
    { t: 'toggle', label: 'תבנית', on: false },
  ]),
  s('מקלידים קוד של 4 עד 8 ספרות פעמיים, ושומרים. מתחת אפשר לבחור מתי הנעילה פועלת.', [
    { t: 'title', text: 'נעילת האפליקציה' },
    { t: 'field', label: 'קוד PIN חדש (4 עד 8 ספרות)', value: '••••', hl: true },
    { t: 'field', label: 'קוד PIN, שוב', value: '••••' },
    { t: 'btn', label: 'שמירה' },
  ]),
];

export const LANGUAGE_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל.', home({ settings: true })),
  s('פותחים את "שפה".', settings('שפה')),
  s('בוחרים עברית או English. האפליקציה נטענת מחדש בלי צורך להתחבר שוב.', [
    { t: 'title', text: 'שפה' },
    { t: 'field', label: 'שפה', value: 'English ▾', hl: true },
  ]),
];

export const SEARCH_STEPS: Step[] = [
  s('בפינה העליונה לוחצים על סמל החיפוש.', home({ search: true }), 'up'),
  s('מקלידים שם בית עסק, קטגוריה, הערה או סכום, והתוצאות מופיעות מיד.', [
    { t: 'title', text: 'חיפוש' },
    { t: 'field', label: 'חיפוש', value: 'שופרסל', hl: true },
    { t: 'tx', title: 'שופרסל', sub: 'מזון · 03/10', amount: '85 ₪' },
    { t: 'tx', title: 'שופרסל', sub: 'מזון · 18/09', amount: '132 ₪' },
  ]),
];

export const SUMMARY_STEPS: Step[] = [
  s('בתפריט נכנסים ל"סיכומים והשוואות".', menu('סיכומים והשוואות')),
  s('בוחרים חודשי או שנתי. רואים הוצאות והכנסות לפי קטגוריה.', [
    { t: 'title', text: 'סיכומים והשוואות' },
    { t: 'tabs', items: [{ l: 'חודשי', on: true, hl: true }, { l: 'שנתי' }] },
    { t: 'bar', label: 'מזון', value: '3,200 ₪', pct: 70, color: '#b8442f' },
    { t: 'bar', label: 'תחבורה', value: '1,100 ₪', pct: 24, color: '#b8442f' },
  ]),
  s('למטה יש גרף השוואה בין חודשים או שנים. בוחרים כמה חודשים להציג, ולוחצים על עמודה כדי לראות את הסכום.', [
    { t: 'title', text: 'השוואה בין חודשים' },
    { t: 'field', label: 'מספר חודשים', value: '6 חודשים אחרונים ▾', hl: true },
    { t: 'tabs', items: [{ l: 'הוצאות', on: true }, { l: 'הכנסות' }] },
    { t: 'bar', label: 'ספטמבר', value: '11,170 ₪', pct: 80, color: '#0f2a47' },
    { t: 'bar', label: 'אוגוסט', value: '9,400 ₪', pct: 68, color: '#0f2a47' },
  ]),
];

export const DEFAULTS_STEPS: Step[] = [
  s('נכנסים להגדרות דרך הגלגל.', home({ settings: true })),
  s('פותחים את "ברירות מחדל להוספה".', settings('ברירות מחדל להוספה')),
  s('לכל מקרה בנפרד (הכנסה או הוצאה, במשק הבית או בעסק) בוחרים צורת תשלום ומטבע שיופיעו מוכנים בטופס.', [
    { t: 'title', text: 'ברירות מחדל להוספה' },
    { t: 'note', text: 'הוצאה · משק הבית' },
    { t: 'field', label: 'צורת תשלום', value: 'אשראי ▾', hl: true },
    { t: 'field', label: 'מטבע', value: '₪ ▾' },
  ]),
];

export const CUSTOM_METHOD_STEPS: Step[] = [
  s('בהגדרות פותחים את "ברירות מחדל להוספה".', settings('ברירות מחדל להוספה')),
  s('בחלק "אמצעי תשלום משלי" בוחרים הכנסה או הוצאה, כותבים שם (למשל "ביט") ולוחצים הוספה.', [
    { t: 'title', text: 'אמצעי תשלום משלי' },
    { t: 'tabs', items: [{ l: 'הוצאה', on: true }, { l: 'הכנסה' }] },
    { t: 'field', label: 'שם האמצעי החדש', value: 'ביט', hl: true },
    { t: 'btn', label: 'הוספה', kind: 'ghost' },
  ]),
  s('האמצעי החדש מופיע מעכשיו בטופס ההוספה, בין צורות התשלום.', [
    { t: 'title', text: 'הוספת הוצאה' },
    { t: 'chips', label: 'צורת תשלום', items: [{ l: 'מזומן' }, { l: 'אשראי' }, { l: 'ביט', on: true, hl: true }] },
  ]),
];

export const HIDE_BUSINESS_STEPS: Step[] = [
  s('בהגדרות פותחים את "ייעוד האפליקציה".', settings('ייעוד האפליקציה')),
  s('בחלק "מה להציג במכשיר הזה" מסמנים או מבטלים עסק. עסק שלא מוצג לא נמחק, והנתונים שלו נשמרים.', [
    { t: 'title', text: 'מה להציג במכשיר הזה' },
    { t: 'toggle', label: 'סטודיו דנה', on: false, hl: true },
    { t: 'toggle', label: SPACE, on: true },
  ]),
];
