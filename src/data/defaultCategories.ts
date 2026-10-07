import type { Category, Scope, TransactionType } from '../domain/types';

/**
 * קטגוריות ברירת מחדל. מזהים קבועים (לא אקראיים) כדי שהכנסת הקטגוריות
 * פעם נוספת לא תיצור כפילויות. עסק ומשק בית מופרדים לגמרי.
 */
const DEFINITIONS: Record<Scope, Record<TransactionType, Array<[string, string]>>> = {
  business: {
    income: [
      ['services', 'שירותים'],
      ['sales', 'מכירות'],
      ['other', 'אחר'],
    ],
    expense: [
      ['equipment', 'ציוד'],
      ['suppliers', 'ספקים'],
      ['advertising', 'פרסום'],
      ['rent', 'שכירות'],
      ['electricity', 'חשמל'],
      ['communication', 'תקשורת'],
      ['fuel', 'דלק'],
      ['vehicle', 'רכב'],
      ['software', 'תוכנות'],
      ['employees', 'עובדים'],
      ['professional', 'שירותים מקצועיים'],
      ['taxes', 'מיסים'],
      ['other', 'אחר'],
    ],
  },
  household: {
    income: [
      ['salary', 'משכורת'],
      ['allowances', 'קצבאות'],
      ['gifts', 'מתנות'],
      ['other', 'אחר'],
    ],
    expense: [
      ['food', 'מזון'],
      ['housing', 'דיור'],
      ['bills', 'חשבונות'],
      ['vehicle', 'רכב'],
      ['children', 'ילדים'],
      ['entertainment', 'בילויים'],
      ['health', 'בריאות'],
      ['clothing', 'ביגוד'],
      ['education', 'חינוך'],
      ['other', 'אחר'],
    ],
  },
};

export function categoryDocId(scope: Scope, type: TransactionType, key: string): string {
  return `${scope}-${type}-${key}`;
}

export function buildDefaultCategories(now: number): Category[] {
  const result: Category[] = [];
  for (const scope of ['business', 'household'] as const) {
    for (const type of ['income', 'expense'] as const) {
      DEFINITIONS[scope][type].forEach(([key, name], index) => {
        result.push({
          id: categoryDocId(scope, type, key),
          scope,
          type,
          name,
          active: true,
          isDefault: true,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        });
      });
    }
  }
  return result;
}
