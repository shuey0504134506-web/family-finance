import type { WalkthroughStep } from './WalkthroughPlayer';
import { ADD_EXPENSE_STEPS } from './demos';

export interface HelpItem {
  id: string;
  /** שאלה (בשאלות נפוצות) או כותרת הטיפ */
  title: string;
  /** תשובה, או טקסט הטיפ */
  body: string;
  /** הדגמה מונפשת, כשיש */
  steps?: WalkthroughStep[];
  /** קישור למסך שבו עושים את זה */
  link?: { to: string; label: string };
}

/** שאלות נפוצות. הרשימה תתרחב ל-20 לפחות. */
export const FAQ: HelpItem[] = [
  {
    id: 'add-expense',
    title: 'איך מוסיפים הוצאה?',
    body: 'שלושה שדות בלבד חובה: סכום, בית עסק וקטגוריה. כל השאר מוגדר מראש ואפשר לשנות ב"פרטים נוספים".',
    steps: ADD_EXPENSE_STEPS,
  },
  {
    id: 'defaults',
    title: 'איך קובעים ברירת מחדל למטבע ולצורת תשלום?',
    body: 'בהגדרות יש חלק של ברירות מחדל לטופס ההוספה, בנפרד להכנסה ולהוצאה, ובנפרד למשק הבית ולעסק.',
    link: { to: '/settings', label: 'להגדרות' },
  },
  {
    id: 'loan',
    title: 'איך רושמים הלוואה בלי לספור אותה כהכנסה?',
    body: 'ב"חובות" בתפריט. החוב ותשלומיו לא נספרים בהכנסות, בהוצאות ובתקציב.',
  },
  {
    id: 'backup',
    title: 'איך מגבים את הנתונים?',
    body: 'בהגדרות, בחלק של הנתונים, אפשר להוריד גיבוי מלא או לייצא לקובץ אקסל.',
    link: { to: '/settings', label: 'להגדרות' },
  },
];

/** טיפים. הרשימה תתרחב ל-20 לפחות. */
export const TIPS: HelpItem[] = [
  {
    id: 'tip-defaults',
    title: 'הוספה מהירה',
    body: 'אחרי שקובעים ברירות מחדל, מספיק למלא סכום, בית עסק וקטגוריה.',
  },
  {
    id: 'tip-tithe',
    title: 'סימון מעשר',
    body: 'בהוספת הוצאה אפשר לסמן "זהו תשלום מעשר", והמעשרות מתעדכנות לבד.',
  },
  {
    id: 'tip-backup',
    title: 'גיבוי לפני שינוי גדול',
    body: 'לפני מחיקת עסק או קטגוריה כדאי להוריד גיבוי.',
  },
];
