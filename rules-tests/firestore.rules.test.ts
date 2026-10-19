import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * בדיקות ל-firestore.rules. דורשות את האמולטור של Firestore:
 *   npm run test:rules
 * (הפקודה מפעילה את האמולטור, מריצה את הבדיקות ומכבה אותו. נדרש Java.)
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-family-finance',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // כל הבדיקות הרגילות מניחות חשבונות שאושרו על ידי המנהל
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(ctx.firestore(), `approvals/${uid}`), { status: 'approved', createdAt: 1 });
    }
  });
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

function transaction(overrides: Record<string, unknown> = {}, id = 'tx1') {
  return {
    id,
    type: 'expense',
    amountAgorot: 12550,
    date: '2026-10-07',
    yearMonth: '2026-10',
    year: 2026,
    month: 10,
    counterparty: 'סופר',
    categoryId: 'household-expense-food',
    categoryName: 'מזון',
    paymentMethod: 'credit',
    note: '',
    titheStatus: 'liable',
    isTithePayment: false,
    createdAt: 1_790_000_000_000,
    updatedAt: 1_790_000_000_000,
    ...overrides,
  };
}

const userProfile = {
  firstName: 'דנה',
  lastName: 'כהן',
  email: 'dana@example.com',
  businessName: 'סטודיו',
  accountMode: 'both',
  createdAt: 1,
  updatedAt: 1,
};

describe('בידוד בין משתמשים', () => {
  it('משתמש יכול לכתוב ולקרוא את הפרופיל של עצמו', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), userProfile));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  });

  it('משתמש אחר לא יכול לקרוא את הפרופיל', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), userProfile);
    });
    await assertFails(getDoc(doc(bob(), 'users/alice')));
  });

  it('משתמש לא מחובר לא יכול לקרוא או לכתוב', async () => {
    await assertFails(getDoc(doc(anonymous(), 'users/alice')));
    await assertFails(setDoc(doc(anonymous(), 'users/alice'), userProfile));
  });

  it('משתמש אחר לא יכול לקרוא או לכתוב פעולות של alice', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/businessTransactions/tx1'), transaction());
    });
    await assertFails(getDoc(doc(bob(), 'users/alice/businessTransactions/tx1')));
    await assertFails(setDoc(doc(bob(), 'users/alice/businessTransactions/tx2'), transaction({}, 'tx2')));
    await assertFails(deleteDoc(doc(bob(), 'users/alice/businessTransactions/tx1')));
  });

  it('אי אפשר לעקוף דרך collection group', async () => {
    await assertFails(getDocs(collectionGroup(bob(), 'businessTransactions')));
    await assertFails(getDocs(collectionGroup(bob(), 'householdTransactions')));
  });

  it('נתיבים אחרים חסומים לגמרי', async () => {
    await assertFails(setDoc(doc(alice(), 'somethingElse/x'), { a: 1 }));
    await assertFails(getDoc(doc(alice(), 'somethingElse/x')));
  });
});

describe('אימות פעולות כספיות', () => {
  const path = 'users/alice/householdTransactions/tx1';

  it('פעולה תקינה מתקבלת, בעסק ובמשק בית', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), transaction()));
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice/businessTransactions/tx2'), transaction({ type: 'income' }, 'tx2')),
    );
  });

  it('סכום לא חיובי נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ amountAgorot: 0 })));
    await assertFails(setDoc(doc(alice(), path), transaction({ amountAgorot: -100 })));
  });

  it('סכום שאינו שלם נדחה (אגורות חייבות להיות מספר שלם)', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ amountAgorot: 100.5 })));
  });

  it('סכום מעל התקרה נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ amountAgorot: 100_000_000_001 })));
  });

  it('תאריך לא תקין נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ date: '2026-13-01', yearMonth: '2026-13' })));
    await assertFails(setDoc(doc(alice(), path), transaction({ date: '07/10/2026' })));
  });

  it('yearMonth שלא תואם לתאריך נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ yearMonth: '2026-09' })));
  });

  it('סוג או אמצעי תשלום לא מוכרים נדחים', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ type: 'transfer' })));
    await assertFails(setDoc(doc(alice(), path), transaction({ paymentMethod: 'bitcoin' })));
  });

  it('שדה לא מוכר או שדה חסר נדחים', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({ extra: 'x' })));
    const { note: _omitted, ...withoutNote } = transaction();
    void _omitted;
    await assertFails(setDoc(doc(alice(), path), withoutNote));
  });

  it('id שלא תואם למזהה המסמך נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), transaction({}, 'other-id')));
  });

  it('אי אפשר לשנות createdAt בעדכון, אבל אפשר לשנות הערה', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), transaction()));
    await assertFails(updateDoc(doc(alice(), path), { createdAt: 5 }));
    await assertSucceeds(updateDoc(doc(alice(), path), { note: 'עודכן', updatedAt: 1_790_000_000_001 }));
  });

  it('אפשר למחוק פעולה של עצמך', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), transaction()));
    await assertSucceeds(deleteDoc(doc(alice(), path)));
  });
});

describe('הגדרות וקטגוריות', () => {
  const settings = {
    titheBps: 1000,
    countBusinessTithePayments: true,
    businessTransferMode: 'positive-only',
    updatedAt: 1,
  };

  it('הגדרות תקינות מתקבלות', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/settings/main'), settings));
  });

  it('מטבע מוכר מתקבל, מטבע לא מוכר נדחה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, currency: 'USD' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, currency: 'XXX' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, currency: 5 }));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, annualMode: 'from-start' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, annualMode: 'x' }));
  });

  it('אחוז מעשר מחוץ לטווח נדחה', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, titheBps: 20000 }));
    await assertFails(setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, titheBps: -1 }));
  });

  it('מצב העברה לא מוכר נדחה', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/alice/settings/main'), { ...settings, businessTransferMode: 'all' }),
    );
  });

  const category = {
    id: 'c1',
    scope: 'business',
    type: 'expense',
    name: 'ציוד',
    active: true,
    isDefault: false,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  it('קטגוריה תקינה מתקבלת ושם ריק נדחה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/categories/c1'), category));
    await assertFails(setDoc(doc(alice(), 'users/alice/categories/c1'), { ...category, name: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/categories/c1'), { ...category, scope: 'other' }));
  });
});

describe('תקציבים', () => {
  const budget = {
    id: 'household-expense-food',
    scope: 'household',
    categoryId: 'household-expense-food',
    amountAgorot: 150000,
    createdAt: 1,
    updatedAt: 1,
  };
  const path = 'users/alice/budgets/household-expense-food';

  it('תקציב תקין מתקבל', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), budget));
  });

  it('סכום אפס, שלילי, לא שלם או גדול מדי נדחה', async () => {
    for (const amountAgorot of [0, -5, 10.5, 200000000000]) {
      await assertFails(setDoc(doc(alice(), path), { ...budget, amountAgorot }));
    }
  });

  it('מזהה שלא תואם לקטגוריה, או תחום לא מוכר, נדחה', async () => {
    await assertFails(setDoc(doc(alice(), path), { ...budget, categoryId: 'other' }));
    await assertFails(setDoc(doc(alice(), path), { ...budget, scope: 'x' }));
  });

  it('תקציב לחודש או לשנה: period ומזהה categoryId@period', async () => {
    const month = { ...budget, id: 'household-expense-food@2026-10', period: '2026-10' };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026-10'), month));
    const year = { ...budget, id: 'household-expense-food@2026', period: '2026' };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026'), year));
    const fromStart = { ...budget, id: 'household-expense-food@2026-03y', period: '2026-03y' };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026-03y'), fromStart));
    // תקופה לא תקינה, או מזהה שלא תואם לתקופה
    await assertFails(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026-13'), { ...month, id: 'household-expense-food@2026-13', period: '2026-13' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026-11'), month));
    await assertFails(setDoc(doc(alice(), path), { ...budget, period: '2026-10' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/budgets/household-expense-food@2026-10'), { ...month, period: 5 }));
  });

  it('אי אפשר לשנות createdAt, אבל אפשר לשנות סכום', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), budget));
    await assertFails(setDoc(doc(alice(), path), { ...budget, createdAt: 99 }));
    await assertSucceeds(setDoc(doc(alice(), path), { ...budget, amountAgorot: 200000, updatedAt: 2 }));
  });

  it('משתמש אחר לא קורא ולא כותב תקציב', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), budget));
    await assertFails(getDoc(doc(bob(), path)));
    await assertFails(setDoc(doc(bob(), path), budget));
  });
});

describe('משימות ורשימת קניות', () => {
  const task = {
    id: 't1',
    scope: 'business',
    title: 'להתקשר ללקוח',
    done: false,
    remind: 'date',
    remindDate: '2026-10-10',
    createdAt: 1,
    updatedAt: 1,
  };
  const item = { id: 'i1', scope: 'household', name: 'חלב', bought: false, createdAt: 1, updatedAt: 1 };

  it('משימה תקינה מתקבלת, ולא תקינה נדחית', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), task));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t2'), { ...task, id: 't2', remind: 'daily', remindDate: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t3'), { ...task, id: 't3', title: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t4'), { ...task, id: 't4', scope: 'x' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t5'), { ...task, id: 't5', remind: 'weekly' }));
    // תזכורת מתאריך חייבת תאריך, ותזכורת אחרת חייבת להישאר בלי תאריך
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t6'), { ...task, id: 't6', remindDate: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t7'), { ...task, id: 't7', remind: 'daily' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t8'), { ...task, id: 't8', extra: 1 }));
  });

  it('אפשר לסמן בוצע, אבל לא לשנות createdAt', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), task));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), { ...task, done: true, updatedAt: 2 }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t1'), { ...task, createdAt: 99 }));
  });

  it('פריט קניות תקין מתקבל, ולא תקין נדחה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/shoppingItems/i1'), item));
    await assertFails(setDoc(doc(alice(), 'users/alice/shoppingItems/i2'), { ...item, id: 'i2', name: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/shoppingItems/i3'), { ...item, id: 'i3', bought: 'yes' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/shoppingItems/i4'), { ...item, id: 'wrong' }));
  });

  it('משתמש אחר לא קורא ולא כותב', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), task));
    await assertFails(getDoc(doc(bob(), 'users/alice/tasks/t1')));
    await assertFails(setDoc(doc(bob(), 'users/alice/shoppingItems/i1'), item));
  });
});

describe('כמה עסקים', () => {
  const now = 1_790_000_000_000;
  const business = { id: 'b2', name: 'עסק שני', sortOrder: 1, createdAt: now, updatedAt: now };

  it('עסק תקין מתקבל, ולא תקין נדחה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businesses/b2'), business));
    await assertFails(setDoc(doc(alice(), 'users/alice/businesses/b3'), { ...business, id: 'b3', name: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/businesses/b4'), { ...business, id: 'wrong' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/businesses/b5'), { ...business, id: 'b5', extra: 1 }));
    await assertFails(setDoc(doc(alice(), 'users/alice/businesses/b6'), { ...business, id: 'b6', sortOrder: 'x' }));
  });

  it('אפשר לשנות שם עסק, אבל לא createdAt', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businesses/b2'), business));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businesses/b2'), { ...business, name: 'שם חדש', updatedAt: now + 1 }));
    await assertFails(setDoc(doc(alice(), 'users/alice/businesses/b2'), { ...business, createdAt: 5 }));
  });

  it('משתמש אחר לא קורא ולא כותב עסקים', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businesses/b2'), business));
    await assertFails(getDoc(doc(bob(), 'users/alice/businesses/b2')));
    await assertFails(setDoc(doc(bob(), 'users/alice/businesses/b9'), { ...business, id: 'b9' }));
  });

  it('מזהה עסק אופציונלי בפעולה, בקטגוריה, בתקציב, במשימה ובפריט קניות', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businessTransactions/tx1'), transaction({ businessId: 'b2' })));
    await assertFails(setDoc(doc(alice(), 'users/alice/businessTransactions/tx2'), transaction({ businessId: '' }, 'tx2')));
    await assertFails(setDoc(doc(alice(), 'users/alice/businessTransactions/tx3'), transaction({ businessId: 5 }, 'tx3')));

    const category = {
      id: 'business-b2-expense-fuel', scope: 'business', type: 'expense', name: 'דלק', active: true,
      isDefault: true, sortOrder: 0, createdAt: now, updatedAt: now,
    };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/categories/business-b2-expense-fuel'), { ...category, businessId: 'b2' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/categories/c2'), { ...category, id: 'c2', businessId: '' }));

    const budget = { id: 'overall-business-b2', scope: 'business', categoryId: 'overall-business-b2', amountAgorot: 1000, createdAt: now, updatedAt: now };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/budgets/overall-business-b2'), { ...budget, businessId: 'b2' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/budgets/x1'), { ...budget, id: 'x1', categoryId: 'x1', businessId: 7 }));

    const task = { id: 't1', scope: 'business', title: 'לשלם', done: false, remind: 'none', remindDate: '', createdAt: now, updatedAt: now };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), { ...task, businessId: 'b2' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t2'), { ...task, id: 't2', businessId: '' }));

    const item = { id: 'i1', scope: 'business', name: 'נייר', bought: false, createdAt: now, updatedAt: now };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/shoppingItems/i1'), { ...item, businessId: 'b2' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/shoppingItems/i2'), { ...item, id: 'i2', businessId: '' }));
  });

  it('פעולה בלי מזהה עסק (נתון ישן) עדיין מתקבלת', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/businessTransactions/old'), transaction({}, 'old')));
  });
});

describe('אישור חשבונות', () => {
  const as = (uid: string) => env.authenticatedContext(uid).firestore();
  const seed = (uid: string, status: string) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `approvals/${uid}`), { status, createdAt: 1 });
    });

  it('משתמש חדש יכול ליצור בקשה ממתינה לעצמו בלבד', async () => {
    await assertSucceeds(setDoc(doc(as('carol'), 'approvals/carol'), { status: 'pending', createdAt: 5 }));
    await assertFails(setDoc(doc(as('dave'), 'approvals/carol2'), { status: 'pending', createdAt: 5 }));
  });

  it('אי אפשר ליצור בקשה כבר מאושרת, או לשנות אותה', async () => {
    await assertFails(setDoc(doc(as('carol'), 'approvals/carol'), { status: 'approved', createdAt: 5 }));
    await assertFails(updateDoc(doc(alice(), 'approvals/alice'), { status: 'approved' }));
    await assertFails(deleteDoc(doc(alice(), 'approvals/alice')));
  });

  it('משתמש קורא רק את הרשומה של עצמו', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'approvals/alice')));
    await assertFails(getDoc(doc(bob(), 'approvals/alice')));
  });

  it('בלי רשומת אישור אין גישה לנתונים', async () => {
    await assertFails(setDoc(doc(as('carol'), 'users/carol'), userProfile));
    await assertFails(getDoc(doc(as('carol'), 'users/carol')));
  });

  const setRequired = (required: boolean) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config/approval'), { required, updatedAt: 1 });
    });

  it('ממתין כשדרישת האישור מופעלת: יכול לכתוב את רשומות ההרשמה ולקרוא את הפרופיל, אבל לא נתונים', async () => {
    await setRequired(true);
    await seed('carol', 'pending');
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol'), userProfile));
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol')));
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1'), transaction()));
    await assertFails(getDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1')));
    await assertFails(getDocs(collectionGroup(as('carol'), 'householdTransactions')));
  });

  it('דרישת האישור כבויה כברירת מחדל: חשבון חדש (ממתין) נכנס ועובד כרגיל', async () => {
    await seed('carol', 'pending');
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol'), userProfile));
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1'), transaction()));
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1')));
  });

  it('דרישת האישור כבויה במפורש: אותו דבר; חסום נשאר חסום; בלי רשומה נשאר סגור', async () => {
    await setRequired(false);
    await seed('carol', 'pending');
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol')));
    await seed('dave', 'blocked');
    await assertFails(getDoc(doc(as('dave'), 'users/dave')));
    await assertFails(getDoc(doc(as('erin'), 'users/erin')));
  });

  it('אפשר להפעיל את הדרישה בכל עת: ממתינים נעצרים, מאושרים ממשיכים', async () => {
    await seed('carol', 'pending');
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1'), transaction()));
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1')));
    await setRequired(true);
    await assertFails(getDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1')));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/householdTransactions/tx1'), transaction()));
  });

  it('הגדרת הדרישה: כל מחובר קורא, רק המנהל כותב', async () => {
    const admin = () => env.authenticatedContext('boss', { email: 'shuey0504134506@gmail.com' }).firestore();
    await assertSucceeds(setDoc(doc(admin(), 'config/approval'), { required: true, updatedAt: 5 }));
    await assertSucceeds(getDoc(doc(as('carol'), 'config/approval')));
    await assertFails(getDoc(doc(anonymous(), 'config/approval')));
    await assertFails(setDoc(doc(as('carol'), 'config/approval'), { required: false, updatedAt: 6 }));
    await assertFails(setDoc(doc(admin(), 'config/approval'), { required: 'כן', updatedAt: 6 }));
    await assertFails(setDoc(doc(admin(), 'config/approval'), { required: true, updatedAt: 6, extra: 1 }));
    await assertFails(setDoc(doc(admin(), 'config/other'), { required: true, updatedAt: 6 }));
  });

  it('חסום: אין קריאה ואין כתיבה', async () => {
    await seed('carol', 'blocked');
    await assertFails(setDoc(doc(as('carol'), 'users/carol'), userProfile));
    await assertFails(getDoc(doc(as('carol'), 'users/carol')));
  });

  it('מאושר: גישה מלאה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/householdTransactions/tx1'), transaction()));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/householdTransactions/tx1')));
  });

  it('דרישת תשלום שהמועד שלה עדיין לא הגיע: גישה רגילה', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'approvals/carol'), {
        status: 'approved',
        createdAt: 1,
        payment: { dueAt: Date.now() + 86_400_000, amountText: '50', url: '', message: '' },
      });
    });
    await assertSucceeds(setDoc(doc(as('carol'), 'users/carol'), userProfile));
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol')));
  });

  it('דרישת תשלום שהמועד שלה עבר: נעול, אבל אפשר לקרוא את רשומת האישור עצמה', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'approvals/carol'), {
        status: 'approved',
        createdAt: 1,
        payment: { dueAt: Date.now() - 1000, amountText: '50', url: '', message: '' },
      });
      await setDoc(doc(ctx.firestore(), 'users/carol/householdTransactions/tx1'), transaction());
    });
    await assertFails(getDoc(doc(as('carol'), 'users/carol')));
    await assertFails(getDoc(doc(as('carol'), 'users/carol/householdTransactions/tx1')));
    await assertFails(setDoc(doc(as('carol'), 'users/carol/householdTransactions/tx2'), transaction({}, 'tx2')));
    await assertSucceeds(getDoc(doc(as('carol'), 'approvals/carol')));
  });

  it('ספירת שימוש: מאושר כותב לעצמו, אי אפשר לקרוא, וחסום לא כותב', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'usage/alice'), { days: { '2026-10-12': 1 }, updatedAt: 5 }));
    await assertFails(getDoc(doc(alice(), 'usage/alice')));
    await assertFails(setDoc(doc(alice(), 'usage/bob'), { days: {}, updatedAt: 5 }));
    await assertFails(setDoc(doc(alice(), 'usage/alice'), { days: {}, updatedAt: 5, extra: 1 }));
    await seed('carol', 'blocked');
    await assertFails(setDoc(doc(as('carol'), 'usage/carol'), { days: {}, updatedAt: 5 }));
  });

  it('הודעות למנהל: מאושר או ממתין שולחים בשמם בלבד, וקוראים רק את שלהם', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'messages/m1'), { uid: 'alice', text: 'שלום', createdAt: 5 }));
    await assertFails(setDoc(doc(alice(), 'messages/m2'), { uid: 'bob', text: 'שלום', createdAt: 5 }));
    await assertFails(setDoc(doc(alice(), 'messages/m3'), { uid: 'alice', text: '', createdAt: 5 }));
    await assertFails(setDoc(doc(alice(), 'messages/m4'), { uid: 'alice', text: 'x', createdAt: 5, reply: 'מזויף' }));
    await assertSucceeds(getDoc(doc(alice(), 'messages/m1')));
    await assertFails(getDoc(doc(bob(), 'messages/m1')));
    await assertFails(updateDoc(doc(alice(), 'messages/m1'), { text: 'שינוי' }));
    await seed('carol', 'pending');
    await assertSucceeds(setDoc(doc(as('carol'), 'messages/m5'), { uid: 'carol', text: 'שלום', createdAt: 5 }));
    await seed('dave', 'blocked');
    await assertFails(setDoc(doc(as('dave'), 'messages/m6'), { uid: 'dave', text: 'שלום', createdAt: 5 }));
  });

  it('הודעות: אימייל בהודעה חייב להתאים לשולח, והמנהל קורא הכול', async () => {
    const admin = () =>
      env.authenticatedContext('boss', { email: 'shuey0504134506@gmail.com' }).firestore();
    const carol = () => env.authenticatedContext('carol', { email: 'carol@example.com' }).firestore();
    await seed('carol', 'approved');
    await assertSucceeds(
      setDoc(doc(carol(), 'messages/a1'), { uid: 'carol', email: 'carol@example.com', text: 'שלום', createdAt: 5 }),
    );
    await assertFails(
      setDoc(doc(carol(), 'messages/a2'), { uid: 'carol', email: 'other@example.com', text: 'שלום', createdAt: 5 }),
    );
    await assertSucceeds(getDoc(doc(admin(), 'messages/a1')));
    await assertSucceeds(getDocs(collection(admin(), 'messages')));
    await assertFails(getDoc(doc(bob(), 'messages/a1')));
  });
});

describe('הוראות קבע', () => {
  const order = (overrides: Record<string, unknown> = {}, id = 'o1') => ({
    id,
    scope: 'household',
    type: 'expense',
    name: 'חברת חשמל',
    amountAgorot: 50000,
    categoryId: 'household-expense-bills',
    categoryName: 'חשבונות',
    paymentMethod: 'direct',
    note: '',
    titheStatus: 'liable',
    isTithePayment: false,
    dayOfMonth: 10,
    nextDue: '2026-11-10',
    active: true,
    createdAt: 1_790_000_000_000,
    updatedAt: 1_790_000_000_000,
    ...overrides,
  });

  it('בעל החשבון יוצר, קורא ומעדכן את שלו', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order()));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/standingOrders/o1')));
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order({ amountAgorot: 60000, updatedAt: 1_790_000_000_001 })));
  });

  it('משתמש אחר ולא מחובר חסומים', async () => {
    await assertFails(setDoc(doc(bob(), 'users/alice/standingOrders/o1'), order()));
    await assertFails(getDoc(doc(anonymous(), 'users/alice/standingOrders/o1')));
  });

  it('דוחה נתונים לא תקינים', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order({ dayOfMonth: 32 })));
    await assertFails(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order({ amountAgorot: 0 })));
    await assertFails(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order({ nextDue: '10/11/2026' })));
    await assertFails(setDoc(doc(alice(), 'users/alice/standingOrders/o1'), order({ extra: 1 })));
    await assertFails(setDoc(doc(alice(), 'users/alice/standingOrders/o2'), order()));
  });

  it('פעולה יכולה לשאת מזהה הוראה, ורק מחרוזת תקינה', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/householdTransactions/tx1'), transaction({ standingOrderId: 'o1' })));
    await assertFails(setDoc(doc(alice(), 'users/alice/householdTransactions/tx2'), transaction({ standingOrderId: '' }, 'tx2')));
    await assertFails(setDoc(doc(alice(), 'users/alice/householdTransactions/tx3'), transaction({ standingOrderId: 5 }, 'tx3')));
  });
});
