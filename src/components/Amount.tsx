import type { CurrencyCode } from '../domain/currency';
import { formatShekels } from '../domain/money';
import { useCountUp, useInView } from '../hooks/useCountUp';

/**
 * סכום כספי. נעטף ב-bdi כדי שהמספר, סימן המינוס וסימן השקל לא יתהפכו
 * בתוך טקסט עברי (RTL).
 */
export function Amount({
  agorot,
  className,
  currency,
  animate,
}: {
  agorot: number;
  className?: string;
  currency?: CurrencyCode;
  /** true = הסכום "נספר" עד לערך בהצגה (מסכים עם גרפים). הערך הסופי תמיד מדויק. */
  animate?: boolean;
}) {
  const cls = `num${className ? ` ${className}` : ""}`;
  if (animate)
    return (
      <AnimatedAmount agorot={agorot} className={cls} currency={currency} />
    );
  return <bdi className={cls}>{formatShekels(agorot, { currency })}</bdi>;
}

function AnimatedAmount({
  agorot,
  className,
  currency,
}: {
  agorot: number;
  className: string;
  currency?: CurrencyCode;
}) {
  const [ref, visible] = useInView<HTMLElement>();
  const shown = useCountUp(agorot, visible);
  return (
    <bdi ref={ref} className={className}>
      {formatShekels(shown, { currency })}
    </bdi>
  );
}
