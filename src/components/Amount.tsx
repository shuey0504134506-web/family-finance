import type { CurrencyCode } from '../domain/currency';
import { formatShekels } from '../domain/money';

/**
 * סכום כספי. נעטף ב-bdi כדי שהמספר, סימן המינוס וסימן השקל לא יתהפכו
 * בתוך טקסט עברי (RTL).
 */
export function Amount({ agorot, className, currency }: { agorot: number; className?: string; currency?: CurrencyCode }) {
  return <bdi className={`num${className ? ` ${className}` : ''}`}>{formatShekels(agorot, { currency })}</bdi>;
}
