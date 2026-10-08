import { isCurrencyCode } from './currency';
import { BACKUP_FORMAT, BACKUP_VERSION } from './export';

/** מסמך מוכן לכתיבה, עם מזהה המסמך. */
export interface RestoreDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface RestorePlan {
  businesses: RestoreDoc[];
  categories: RestoreDoc[];
  budgets: RestoreDoc[];
  tasks: RestoreDoc[];
  shoppingItems: RestoreDoc[];
  businessTransactions: RestoreDoc[];
  householdTransactions: RestoreDoc[];
  /** הגדרות המעשרות מהקובץ (אופציונלי). */
  settings: Record<string, unknown> | null;
  /** מסמכים שלא עברו בדיקה ויידלגו. */
  invalid: number;
}

export type ParseResult = { ok: true; plan: RestorePlan } | { ok: false; error: string };

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isNonEmpty = (v: unknown, max: number): v is string => isStr(v, max) && v.length > 0;
const MAX_AGOROT = 100_000_000_000;

/**
 * משאיר רק את המפתחות שחוקי האבטחה מתירים. מחזיר null אם חסר מפתח חובה.
 * מזהה עסק (businessId) הוא אופציונלי: אם קיים הוא חייב להיות תקין, ואם חסר הוא נשאר חסר
 * (פריט ישן שייך לעסק הראשון).
 */
function pick(source: Obj, keys: readonly string[], withBusinessId = true): Obj | null {
  const out: Obj = {};
  for (const key of keys) {
    if (!(key in source) || source[key] === undefined) return null;
    out[key] = source[key];
  }
  if (withBusinessId && 'businessId' in source && source.businessId !== undefined) {
    if (!isNonEmpty(source.businessId, 100)) return null;
    out.businessId = source.businessId;
  }
  return out;
}

const TX_KEYS = ['id', 'type', 'amountAgorot', 'date', 'yearMonth', 'year', 'month', 'counterparty', 'categoryId', 'categoryName', 'paymentMethod', 'note', 'titheStatus', 'isTithePayment', 'createdAt', 'updatedAt'] as const;
const CAT_KEYS = ['id', 'scope', 'type', 'name', 'active', 'isDefault', 'sortOrder', 'createdAt', 'updatedAt'] as const;
const BUDGET_KEYS = ['id', 'scope', 'categoryId', 'amountAgorot', 'createdAt', 'updatedAt'] as const;
const TASK_KEYS = ['id', 'scope', 'title', 'done', 'remind', 'remindDate', 'createdAt', 'updatedAt'] as const;
const ITEM_KEYS = ['id', 'scope', 'name', 'bought', 'createdAt', 'updatedAt'] as const;
const SETTINGS_KEYS = ['titheBps', 'countBusinessTithePayments', 'businessTransferMode', 'updatedAt'] as const;

// הבדיקות כאן משקפות את firestore.rules. מה שנדחה שם, נדחה גם כאן, כדי שלא ייכשל באמצע השחזור.
function cleanTransaction(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, TX_KEYS);
  if (!d) return null;
  const ok =
    isNonEmpty(d.id, 100) &&
    (d.type === 'income' || d.type === 'expense') &&
    isInt(d.amountAgorot) && d.amountAgorot > 0 && d.amountAgorot <= MAX_AGOROT &&
    typeof d.date === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d.date) &&
    d.yearMonth === d.date.slice(0, 7) &&
    isInt(d.year) && isInt(d.month) && d.month >= 1 && d.month <= 12 &&
    isStr(d.counterparty, 120) && isNonEmpty(d.categoryId, 100) && isStr(d.categoryName, 60) &&
    ['cash', 'credit', 'direct', 'check', 'transfer'].includes(d.paymentMethod as string) &&
    isStr(d.note, 1000) &&
    (d.titheStatus === 'liable' || d.titheStatus === 'exempt') &&
    typeof d.isTithePayment === 'boolean' &&
    isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanBusiness(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, ['id', 'name', 'sortOrder', 'createdAt', 'updatedAt'], false);
  if (!d) return null;
  const ok = isNonEmpty(d.id, 100) && isNonEmpty(d.name, 60) && isInt(d.sortOrder) && isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanCategory(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, CAT_KEYS);
  if (!d) return null;
  const ok =
    isNonEmpty(d.id, 100) &&
    (d.scope === 'business' || d.scope === 'household') &&
    (d.type === 'income' || d.type === 'expense') &&
    isNonEmpty(d.name, 60) &&
    typeof d.active === 'boolean' && typeof d.isDefault === 'boolean' &&
    isInt(d.sortOrder) && isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanBudget(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, BUDGET_KEYS);
  if (!d) return null;
  const ok =
    isNonEmpty(d.id, 100) &&
    d.categoryId === d.id &&
    (d.scope === 'business' || d.scope === 'household') &&
    isInt(d.amountAgorot) && d.amountAgorot > 0 && d.amountAgorot <= MAX_AGOROT &&
    isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanTask(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, TASK_KEYS);
  if (!d) return null;
  const dateOk = typeof d.remindDate === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d.remindDate);
  const ok =
    isNonEmpty(d.id, 100) &&
    (d.scope === 'business' || d.scope === 'household') &&
    isNonEmpty(d.title, 200) &&
    typeof d.done === 'boolean' &&
    ['none', 'every-open', 'daily', 'date'].includes(d.remind as string) &&
    (d.remind === 'date' ? dateOk : d.remindDate === '') &&
    isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanItem(raw: unknown): RestoreDoc | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, ITEM_KEYS);
  if (!d) return null;
  const ok =
    isNonEmpty(d.id, 100) &&
    (d.scope === 'business' || d.scope === 'household') &&
    isNonEmpty(d.name, 120) &&
    typeof d.bought === 'boolean' &&
    isInt(d.createdAt) && isInt(d.updatedAt);
  return ok ? { id: d.id as string, data: d } : null;
}

function cleanSettings(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  const d = pick(raw, SETTINGS_KEYS);
  if (!d) return null;
  // מטבע הוא שדה אופציונלי: גיבויים ישנים לא כוללים אותו.
  if (raw.currency !== undefined) {
    if (!isCurrencyCode(raw.currency)) return null;
    d.currency = raw.currency;
  }
  const ok =
    isInt(d.titheBps) && d.titheBps >= 0 && d.titheBps <= 10000 &&
    typeof d.countBusinessTithePayments === 'boolean' &&
    (d.businessTransferMode === 'positive-only' || d.businessTransferMode === 'allow-negative') &&
    isInt(d.updatedAt);
  return ok ? d : null;
}

function cleanList(raw: unknown, clean: (v: unknown) => RestoreDoc | null): { docs: RestoreDoc[]; invalid: number } {
  if (raw === undefined) return { docs: [], invalid: 0 };
  if (!Array.isArray(raw)) return { docs: [], invalid: 1 };
  const seen = new Set<string>();
  const docs: RestoreDoc[] = [];
  let invalid = 0;
  for (const item of raw) {
    const doc = clean(item);
    if (!doc || seen.has(doc.id)) invalid += 1;
    else {
      seen.add(doc.id);
      docs.push(doc);
    }
  }
  return { docs, invalid };
}

/** קורא קובץ גיבוי (הטקסט שלו) ובונה תוכנית שחזור. אינו כותב דבר. */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'הקובץ אינו קובץ גיבוי תקין.' };
  }
  if (!isObj(parsed) || parsed.format !== BACKUP_FORMAT || !isObj(parsed.data)) {
    return { ok: false, error: 'זה אינו קובץ גיבוי של האפליקציה.' };
  }
  if (!isInt(parsed.version) || parsed.version < 1 || parsed.version > BACKUP_VERSION) {
    return { ok: false, error: 'גרסת הגיבוי אינה נתמכת. יש לעדכן את האפליקציה.' };
  }
  const data = parsed.data;
  const businesses = cleanList(data.businesses, cleanBusiness);
  const categories = cleanList(data.categories, cleanCategory);
  const budgets = cleanList(data.budgets, cleanBudget);
  const tasks = cleanList(data.tasks, cleanTask);
  const shopping = cleanList(data.shoppingItems, cleanItem);
  const business = cleanList(data.businessTransactions, cleanTransaction);
  const household = cleanList(data.householdTransactions, cleanTransaction);

  const settingsList = Array.isArray(data.settings) ? data.settings : [];
  const settingsDoc = settingsList.find((s) => isObj(s) && s.id === 'main');
  const settings = settingsDoc === undefined ? null : cleanSettings(settingsDoc);

  const plan: RestorePlan = {
    businesses: businesses.docs,
    categories: categories.docs,
    budgets: budgets.docs,
    tasks: tasks.docs,
    shoppingItems: shopping.docs,
    businessTransactions: business.docs,
    householdTransactions: household.docs,
    settings,
    invalid:
      businesses.invalid + categories.invalid + budgets.invalid + tasks.invalid + shopping.invalid + business.invalid + household.invalid +
      (settingsDoc !== undefined && settings === null ? 1 : 0),
  };
  const total =
    plan.businesses.length + plan.categories.length + plan.budgets.length + plan.tasks.length + plan.shoppingItems.length +
    plan.businessTransactions.length + plan.householdTransactions.length;
  if (total === 0 && !plan.settings) return { ok: false, error: 'בקובץ אין נתונים לשחזור.' };
  return { ok: true, plan };
}
