import { currencySymbol, getCurrency } from './currency';

/**
 * כסף באפליקציה = מספר שלם של אגורות. אין חישובי floating point על סכומים.
 * 100.50 ₪ נשמר כ-10050.
 */
export type Agorot = number;

export const AGOROT_PER_SHEKEL = 100;
/** תקרה סבירה לפעולה בודדת: מיליארד ש"ח. נאכף גם ב-Security Rules. */
export const MAX_TRANSACTION_AGOROT = 100_000_000_000;

export function assertAgorot(value: number, label = 'amount'): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer number of agorot, got ${value}`);
  }
}

export function sumAgorot(values: readonly Agorot[]): Agorot {
  let total = 0;
  for (const value of values) {
    assertAgorot(value);
    total += value;
    assertAgorot(total, 'sum');
  }
  return total;
}

/**
 * ממיר טקסט שהמשתמש הקליד (למשל "1,250.50" או "100 ₪") לאגורות.
 * מחזיר null אם הטקסט אינו סכום תקין. לא מנחש במקרים עמומים:
 * "1.500" נדחה, כי לא ברור אם זו נקודה עשרונית או מפרידת אלפים.
 */
export function parseShekelsToAgorot(input: string): Agorot | null {
  let text = input
    .replace(/[\s\u00A0\u200E\u200F]/g, '')
    .replace(/[₪$€£]/g, '')
    .replace(/ש"ח|ש״ח|שח|USD|EUR|GBP|ILS|NIS/gi, '');
  if (text === '') return null;

  let sign = 1;
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  if (text.includes('.') && text.includes(',')) {
    text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, '');
    } else if (/^\d+,\d{1,2}$/.test(text)) {
      text = text.replace(',', '.');
    } else {
      return null;
    }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const [whole, fraction = ''] = text.split('.');
  const agorot = Number(whole) * AGOROT_PER_SHEKEL + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(agorot)) return null;
  return agorot === 0 ? 0 : sign * agorot;
}

export interface FormatOptions {
  /** auto = אגורות רק כשיש; always = תמיד שתי ספרות */
  fraction?: 'auto' | 'always';
}

/** "18000" אגורות -> "180". מספר בלבד, עם מפרידי אלפים. */
export function formatAgorotNumber(agorot: Agorot, options: FormatOptions = {}): string {
  assertAgorot(agorot);
  const { fraction = 'auto' } = options;
  const sign = agorot < 0 ? '-' : '';
  const abs = Math.abs(agorot);
  const whole = Math.trunc(abs / AGOROT_PER_SHEKEL);
  const cents = abs % AGOROT_PER_SHEKEL;
  const wholeText = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fractionText =
    cents === 0 && fraction === 'auto' ? '' : `.${String(cents).padStart(2, '0')}`;
  return `${sign}${wholeText}${fractionText}`;
}

/**
 * סכום עם סימן המטבע שנבחר בהגדרות. שקל מופיע אחרי המספר ("180 ₪"),
 * שאר המטבעות לפני המספר ("$180"), והמינוס תמיד ראשון.
 */
export function formatShekels(agorot: Agorot, options: FormatOptions = {}): string {
  const number = formatAgorotNumber(agorot, options);
  if (getCurrency() === 'ILS') return `${number}\u00A0${currencySymbol()}`;
  return number.startsWith('-')
    ? `-${currencySymbol()}${number.slice(1)}`
    : `${currencySymbol()}${number}`;
}

/**
 * מחשב round(amount * numerator / denominator) בחשבון שלם (BigInt),
 * עיגול חצי כלפי מעלה (הרחק מאפס). בטוח גם לסכומים גדולים.
 */
export function mulDivRound(amount: number, numerator: number, denominator: number): number {
  assertAgorot(amount);
  assertAgorot(numerator, 'numerator');
  assertAgorot(denominator, 'denominator');
  if (denominator === 0) throw new Error('denominator must not be zero');

  const product = BigInt(amount) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const negative = product < 0n !== divisor < 0n && product !== 0n;
  const absProduct = product < 0n ? -product : product;
  const absDivisor = divisor < 0n ? -divisor : divisor;
  const quotient = (absProduct * 2n + absDivisor) / (absDivisor * 2n);
  const result = Number(negative ? -quotient : quotient);
  assertAgorot(result, 'result');
  return result === 0 ? 0 : result;
}

/** אחוז מסכום, בנקודות בסיס: applyBasisPoints(18000_00, 1000) = 10% = 1800_00. */
export function applyBasisPoints(amount: Agorot, bps: number): Agorot {
  return mulDivRound(amount, bps, 10_000);
}
