import { formatShekels } from '../domain/money';

/**
 * סכום כספי. נעטף ב-bdi כדי שהמספר, סימן המינוס וסימן השקל לא יתהפכו
 * בתוך טקסט עברי (RTL).
 */
export function Amount({ agorot, className }: { agorot: number; className?: string }) {
  return <bdi className={`num${className ? ` ${className}` : ''}`}>{formatShekels(agorot)}</bdi>;
}
