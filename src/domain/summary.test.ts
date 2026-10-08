import { describe, expect, it } from 'vitest';
import {
  businessNet,
  businessTransferToHousehold,
  householdTotals,
  totalsByCategory,
  totalsOf,
  transferFromBusinesses,
} from './summary';

const income = (amountAgorot: number) => ({ type: 'income' as const, amountAgorot });
const expense = (amountAgorot: number) => ({ type: 'expense' as const, amountAgorot });

describe('totalsOf', () => {
  it('מסכם הכנסות, הוצאות ויתרה', () => {
    const totals = totalsOf([income(1_000_000), income(500_000), expense(700_000)]);
    expect(totals).toEqual({
      incomeAgorot: 1_500_000,
      expenseAgorot: 700_000,
      balanceAgorot: 800_000,
    });
  });

  it('מחזיר אפסים לרשימה ריקה', () => {
    expect(totalsOf([])).toEqual({ incomeAgorot: 0, expenseAgorot: 0, balanceAgorot: 0 });
  });

  it('מציג מינוס כשההוצאות גדולות מההכנסות', () => {
    expect(totalsOf([income(100), expense(1450)]).balanceAgorot).toBe(-1350);
  });
});

describe('נטו עסק והעברה למשק הבית (דוגמה מהמסמך)', () => {
  // הכנסות עסק 30,000 ₪, הוצאות עסק 12,000 ₪ -> נטו 18,000 ₪
  const business = totalsOf([income(3_000_000), expense(1_200_000)]);

  it('נטו העסק הוא 18,000', () => {
    expect(businessNet(business)).toBe(1_800_000);
  });

  it('למשק הבית עוברים 18,000 ולא 30,000 (אין ספירה כפולה)', () => {
    const transfer = businessTransferToHousehold(businessNet(business));
    expect(transfer).toBe(1_800_000);

    const household = householdTotals([], transfer);
    expect(household.incomeAgorot).toBe(1_800_000);
    expect(household.incomeAgorot).not.toBe(business.incomeAgorot);
    expect(household.fromBusinessAgorot).toBe(1_800_000);
    expect(household.ownIncomeAgorot).toBe(0);
  });

  it('הכנסה מהעסק מתווספת להכנסות משק הבית ולא מחליפה אותן', () => {
    const household = householdTotals([income(200_000), expense(900_000)], 1_800_000);
    expect(household.ownIncomeAgorot).toBe(200_000);
    expect(household.incomeAgorot).toBe(2_000_000);
    expect(household.expenseAgorot).toBe(900_000);
    expect(household.balanceAgorot).toBe(1_100_000);
  });

  it('חודש הפסדי בעסק יוצר הפסד במשק הבית (ברירת המחדל)', () => {
    // עסק: הכנסות 1,000, הוצאות 4,000 -> הפסד של 3,000
    const loss = totalsOf([income(100_000), expense(400_000)]);
    expect(businessNet(loss)).toBe(-300_000);

    const transfer = businessTransferToHousehold(businessNet(loss));
    expect(transfer).toBe(-300_000);

    // במשק הבית: הכנסה עצמית 5,000, הוצאות 1,000, והפסד העסק מקטין את ההכנסה
    const household = householdTotals([income(500_000), expense(100_000)], transfer);
    expect(household.fromBusinessAgorot).toBe(-300_000);
    expect(household.incomeAgorot).toBe(200_000);
    expect(household.balanceAgorot).toBe(100_000);
  });

  it('אפשר לעבור להגדרה שבה הפסד עסקי לא עובר למשק הבית', () => {
    const loss = totalsOf([income(100_000), expense(400_000)]);
    expect(businessTransferToHousehold(businessNet(loss), 'positive-only')).toBe(0);
    expect(businessTransferToHousehold(1_800_000, 'positive-only')).toBe(1_800_000);
  });

  it('הפסד עסקי גדול מההכנסה במשק הבית מביא את משק הבית למינוס', () => {
    const household = householdTotals([income(100_000)], -300_000);
    expect(household.incomeAgorot).toBe(-200_000);
    expect(household.balanceAgorot).toBe(-200_000);
  });
});

describe('totalsByCategory', () => {
  it('מסכם לפי קטגוריה ולפי סוג בלבד', () => {
    const result = totalsByCategory(
      [
        { type: 'expense', amountAgorot: 100, categoryId: 'food' },
        { type: 'expense', amountAgorot: 250, categoryId: 'food' },
        { type: 'expense', amountAgorot: 70, categoryId: 'car' },
        { type: 'income', amountAgorot: 9999, categoryId: 'food' },
      ],
      'expense',
    );
    expect(result.get('food')).toBe(350);
    expect(result.get('car')).toBe(70);
    expect(result.size).toBe(2);
  });
});

describe('transferFromBusinesses', () => {
  const tx = (businessId: string | undefined, type: 'income' | 'expense', amountAgorot: number) => ({ businessId, type, amountAgorot });

  it('מחבר את נטו כל העסקים', () => {
    expect(transferFromBusinesses([tx('main', 'income', 1000), tx('b2', 'income', 500), tx('b2', 'expense', 200)])).toBe(1300);
  });

  it('פעולה בלי מזהה עסק שייכת לעסק הראשון', () => {
    expect(transferFromBusinesses([tx(undefined, 'income', 1000), tx('main', 'expense', 400)])).toBe(600);
  });

  it('הפסד בעסק אחד עובר כשלילי כשמותר', () => {
    const list = [tx('main', 'income', 1000), tx('b2', 'expense', 300)];
    expect(transferFromBusinesses(list, 'allow-negative')).toBe(700);
  });

  it('במצב "רק רווח" הפסד של עסק אחד לא מקזז רווח של עסק אחר', () => {
    const list = [tx('main', 'income', 1000), tx('b2', 'expense', 300)];
    expect(transferFromBusinesses(list, 'positive-only')).toBe(1000);
  });

  it('ללא פעולות: אפס', () => {
    expect(transferFromBusinesses([])).toBe(0);
  });
});
