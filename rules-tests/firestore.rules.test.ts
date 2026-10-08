import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
