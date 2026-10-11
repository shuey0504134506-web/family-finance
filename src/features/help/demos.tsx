import type { WalkthroughStep } from './WalkthroughPlayer';

/** מסך בית מצויר (מקוצר). */
const home = (hl: boolean) => (
  <div className="mk">
    <div className="mk-bar" />
    <div className="mk-center">
      <small>החודש אנחנו בפלוס</small>
      <b className="mk-big">2,162.86 ₪</b>
    </div>
    <div className="mk-line">
      <span>סך הכנסות</span>
      <b>13,333 ₪</b>
    </div>
    <div className="mk-line">
      <span>סך הוצאות</span>
      <b>11,170 ₪</b>
    </div>
    <div className="mk-row">
      <span className="mk-btn mk-btn-in">הוספת הכנסה</span>
      <span className={`mk-btn mk-btn-out${hl ? ' mk-hl' : ''}`}>הוספת הוצאה</span>
    </div>
  </div>
);

/** טופס הוספת הוצאה מצויר. `focus` קובע איזה חלק מודגש. */
const form = (focus: 'amount' | 'name' | 'category' | 'more' | 'save', filled: number) => (
  <div className="mk">
    <div className="mk-title">הוספת הוצאה</div>
    <div className={`mk-field${focus === 'amount' ? ' mk-hl' : ''}`}>
      <small>סכום (₪)</small>
      <b>{filled >= 1 ? '85' : ''}</b>
    </div>
    <div className={`mk-field${focus === 'name' ? ' mk-hl' : ''}`}>
      <small>שם הספק / בית העסק</small>
      <b>{filled >= 2 ? 'שופרסל' : ''}</b>
    </div>
    <small className="mk-label">קטגוריה</small>
    <div className="mk-chips">
      <span className={`mk-chip${filled >= 3 ? ' mk-chip-on' : ''}${focus === 'category' ? ' mk-hl' : ''}`}>מזון</span>
      <span className="mk-chip">תחבורה</span>
      <span className="mk-chip">בריאות</span>
    </div>
    <div className={`mk-more${focus === 'more' ? ' mk-hl' : ''}`}>פרטים נוספים ▾</div>
    <div className={`mk-save${focus === 'save' ? ' mk-hl' : ''}`}>שמירה</div>
  </div>
);

export const ADD_EXPENSE_STEPS: WalkthroughStep[] = [
  { caption: 'במסך הבית לוחצים על "הוספת הוצאה".', screen: home(true), tap: { top: 58, left: 28 } },
  { caption: 'מקלידים את הסכום.', screen: form('amount', 1), tap: { top: 19, left: 55 } },
  { caption: 'כותבים את שם בית העסק. אפשר גם להשאיר ריק.', screen: form('name', 2), tap: { top: 34, left: 55 } },
  { caption: 'בוחרים קטגוריה. אם חסרה, אפשר להוסיף קטגוריה חדשה מאותה שורה.', screen: form('category', 3), tap: { top: 55, left: 85 } },
  {
    caption: 'התאריך (היום) וצורת התשלום מוגדרים מראש. לשינוי לוחצים על "פרטים נוספים".',
    screen: form('more', 3),
    tap: { top: 64, left: 50 },
  },
  { caption: 'לוחצים על "שמירה", וההוצאה מופיעה מיד ברשימה ובסיכומים.', screen: form('save', 3), tap: { top: 89, left: 50 } },
];
