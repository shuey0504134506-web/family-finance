import { createUserRecords } from '../../src/services/profileService';
import { saveTransaction } from '../../src/services/transactionService';
import { saveBudget } from '../../src/services/budgetService';
import type { PaymentMethod, Scope, Transaction, TransactionType } from '../../src/domain/types';

/** נתוני הדוגמה לצילום ההדגמות. תאריכים יחסיים להיום, כדי שהמסכים תמיד יציגו את החודש הנוכחי. */
const en = (() => { try { return localStorage.getItem('ff.lang.v1') === 'en'; } catch { return false; } })();
const uid = 'demo';
const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();

function ym(offset: number): { y: number; m: number } {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

let seq = 0;
function tx(
  scope: Scope, type: TransactionType, offset: number, day: number, shekels: number, who: string, key: string, catName: string,
  method: PaymentMethod, extra: Partial<Transaction> = {},
): Promise<void> {
  const { y, m } = ym(offset);
  const date = `${y}-${pad(m)}-${pad(day)}`;
  seq += 1;
  const t: Transaction = {
    id: `demo-${seq}`, type, amountAgorot: shekels * 100, date, yearMonth: `${y}-${pad(m)}`, year: y, month: m,
    counterparty: who, categoryId: `${scope}-${type}-${key}`, categoryName: catName, paymentMethod: method, note: '',
    titheStatus: type === 'income' ? 'liable' : 'exempt', isTithePayment: false, createdAt: 1_700_000_000_000 + seq, updatedAt: 1_700_000_000_000 + seq,
    ...extra,
  };
  return saveTransaction(uid, scope, t);
}

async function seed() {
  const hh = en ? 'Our Home' : 'ביתנו האהוב';
  await createUserRecords(uid, {
    firstName: en ? 'Dana' : 'דנה', lastName: en ? 'Cohen' : 'כהן', email: 'dana@example.com',
    businessName: en ? 'My Business' : 'העסק שלי', accountMode: 'both', householdName: hh,
  });
  const jobs: Array<Promise<void>> = [];
  const d = Math.min(now.getDate(), 28);
  // משק הבית, החודש
  jobs.push(tx('household', 'income', 0, 1, 12000, en ? 'Salary' : 'משכורת', 'salary', 'משכורת', 'transfer'));
  jobs.push(tx('household', 'income', 0, 2, 1333, en ? 'Grandma' : 'סבתא', 'gifts', 'מתנות', 'cash'));
  const h = (day: number, sh: number, who: string, key: string, cat: string, method: PaymentMethod, extra: Partial<Transaction> = {}) =>
    jobs.push(tx('household', 'expense', 0, Math.min(day, d), sh, who, key, cat, method, extra));
  h(1, 5000, en ? 'Rent' : 'שכר דירה', 'housing', 'דיור', 'transfer');
  h(3, 85, en ? 'Supermarket' : 'שופרסל', 'food', 'מזון', 'cash');
  h(5, 412, en ? 'Rami Levy' : 'רמי לוי', 'food', 'מזון', 'credit');
  h(6, 480, en ? 'Electric company' : 'חברת חשמל', 'bills', 'חשבונות', 'credit');
  h(7, 240, en ? 'Gas station' : 'פז', 'vehicle', 'רכב', 'credit');
  h(8, 900, en ? 'School' : 'בית ספר', 'education', 'חינוך', 'direct');
  h(9, 150, en ? 'Clinic' : 'מרפאה', 'health', 'בריאות', 'credit');
  h(2, 1600, en ? 'Property tax' : 'ארנונה', 'bills', 'חשבונות', 'direct');
  h(4, 1903, en ? 'Daycare' : 'גן ילדים', 'children', 'ילדים', 'direct');
  h(10, 400, en ? 'Charity fund' : 'גמ״ח חסד', 'other', 'אחר', 'cash', { isTithePayment: true });
  // חודשים קודמים
  for (const off of [-1, -2, -3, -4, -5]) {
    jobs.push(tx('household', 'income', off, 1, 12000 + off * 150, en ? 'Salary' : 'משכורת', 'salary', 'משכורת', 'transfer'));
    jobs.push(tx('household', 'expense', off, 3, 9400 - off * 450, en ? 'Rent' : 'שכר דירה', 'housing', 'דיור', 'transfer'));
    jobs.push(tx('household', 'expense', off, 6, 1800 + off * 60, en ? 'Supermarket' : 'שופרסל', 'food', 'מזון', 'credit'));
  }
  jobs.push(tx('household', 'expense', -1, 12, 400, en ? 'Charity fund' : 'גמ״ח חסד', 'other', 'אחר', 'cash', { isTithePayment: true }));
  jobs.push(tx('household', 'expense', -2, 12, 2000, en ? 'Charity fund' : 'גמ״ח חסד', 'other', 'אחר', 'cash', { isTithePayment: true }));
  jobs.push(tx('household', 'expense', -3, 12, 1200, en ? 'Yeshiva' : 'ישיבת הרב', 'other', 'אחר', 'cash', { isTithePayment: true }));
  jobs.push(tx('household', 'expense', -3, 14, 300, '', 'other', 'אחר', 'cash', { isTithePayment: true }));
  // העסק, החודש
  jobs.push(tx('business', 'income', 0, 2, 7000, en ? 'Client A' : 'לקוח א', 'services', 'שירותים', 'transfer'));
  jobs.push(tx('business', 'income', 0, 5, 5000, en ? 'Client B' : 'לקוח ב', 'sales', 'מכירות', 'check'));
  jobs.push(tx('business', 'expense', 0, 3, 2400, en ? 'Studio rent' : 'שכירות סטודיו', 'rent', 'שכירות', 'transfer'));
  jobs.push(tx('business', 'expense', 0, 6, 1200, en ? 'Supplier' : 'ספק חומרים', 'suppliers', 'ספקים', 'credit'));
  await Promise.all(jobs);
  const budgets: Array<[string, number]> = [['household-expense-food', 4000], ['household-expense-housing', 6000], ['household-expense-bills', 3000], ['household-expense-children', 2500]];
  await Promise.all(budgets.map(([id, sh]) => saveBudget(uid, 'household', id, sh * 100)));
}

seed().then(() => import('../../src/main'));
