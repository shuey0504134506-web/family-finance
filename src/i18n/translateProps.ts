import { translateText } from './translate';
import { isEnglish } from './lang';

// מאפיינים שאינם טקסט לתצוגה: לא מתרגמים אותם.
const SKIP = new Set(['className', 'id', 'key', 'ref', 'type', 'value', 'defaultValue', 'href', 'to', 'name', 'htmlFor', 'style', 'role', 'inputMode', 'autoComplete', 'dir', 'lang']);

function translateChild(child: unknown): unknown {
  return typeof child === 'string' ? translateText(child) : child;
}

/** מתרגמת ילדים ומאפיינים טקסטואליים של אלמנט, כשהשפה אנגלית. */
export function translateProps(_type: unknown, props: Record<string, unknown>): Record<string, unknown> {
  if (!isEnglish() || !props) return props;
  let out: Record<string, unknown> | null = null;
  for (const key of Object.keys(props)) {
    if (SKIP.has(key)) continue;
    const value = props[key];
    let next: unknown = value;
    if (typeof value === 'string') next = translateText(value);
    else if (key === 'children' && Array.isArray(value)) {
      next = value.map(translateChild);
      if (next && (next as unknown[]).every((v, i) => v === value[i])) next = value;
    }
    if (next !== value) {
      out ??= { ...props };
      out[key] = next;
    }
  }
  return out ?? props;
}
