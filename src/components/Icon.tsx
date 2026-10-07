import type { ReactNode } from 'react';

/**
 * אייקונים בקו אחיד (סגנון Lucide, בקו 2px) בצבע שחור, במקום אימוג'י.
 * הצבע קבוע בשחור בכוונה, כדי שכל הסימנים באפליקציה ייראו אחידים.
 */
export type IconName =
  | 'business'
  | 'household'
  | 'income'
  | 'expense'
  | 'tithe'
  | 'budget'
  | 'chart'
  | 'plus'
  | 'mail'
  | 'check'
  | 'sparkle'
  | 'sync'
  | 'calendar'
  | 'search'
  | 'currency';

const PATHS: Record<IconName, ReactNode> = {
  business: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </>
  ),
  household: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  income: (
    <>
      <path d="M12 4v13" />
      <path d="M6 12l6 6 6-6" />
      <path d="M5 21h14" />
    </>
  ),
  expense: (
    <>
      <path d="M12 20V7" />
      <path d="M6 12l6-6 6 6" />
      <path d="M5 3h14" />
    </>
  ),
  tithe: (
    <>
      <path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z" />
    </>
  ),
  budget: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chart: (
    <>
      <path d="M6 20v-9" />
      <path d="M12 20V4" />
      <path d="M18 20v-6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 17l.6 1.6L21 19l-1.4.4L19 21l-.6-1.6L17 19l1.4-.4z" />
    </>
  ),
  sync: (
    <>
      <path d="M20 8a8 8 0 0 0-14-2L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 16a8 8 0 0 0 14 2l2-2" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  currency: (
    <>
      <path d="M6 20V6a3 3 0 0 1 3-3h1a4 4 0 0 1 4 4v7" />
      <path d="M18 4v11a3 3 0 0 1-3 3h-1a4 4 0 0 1-4-4V7" />
    </>
  ),
};

export function Icon({ name, size = '1.15em' }: { name: IconName; size?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
