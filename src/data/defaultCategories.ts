import { DEFAULT_BUSINESS_ID } from '../domain/spaces';
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

/**
 * מזהה קטגוריית ברירת מחדל. לעסק הראשון נשמר המזהה המקורי (`business-expense-fuel`),
 * ולעסקים נוספים נוסף מזהה העסק, כדי שלכל עסק יהיו קטגוריות משלו.
 */
export function categoryDocId(
  scope: Scope,
  type: TransactionType,
  key: string,
  businessId: string = DEFAULT_BUSINESS_ID,
): string {
  if (scope === 'business' && businessId !== DEFAULT_BUSINESS_ID) {
    return `business-${businessId}-${type}-${key}`;
  }
  return `${scope}-${type}-${key}`;
}

/** קטגוריות ברירת מחדל של עסק אחד. */
export function buildBusinessCategories(now: number, businessId: string = DEFAULT_BUSINESS_ID): Category[] {
  return buildDefaults(now, ['business'], businessId);
}

export function buildDefaultCategories(now: number): Category[] {
  return buildDefaults(now, ['business', 'household'], DEFAULT_BUSINESS_ID);
}

function buildDefaults(now: number, scopes: readonly Scope[], businessId: string): Category[] {
  const result: Category[] = [];
  for (const scope of scopes) {
    for (const type of ['income', 'expense'] as const) {
      DEFINITIONS[scope][type].forEach(([key, name], index) => {
        result.push({
          id: categoryDocId(scope, type, key, businessId),
          scope,
          ...(scope === 'business' && businessId !== DEFAULT_BUSINESS_ID ? { businessId } : {}),
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
