import type { AdminLogEntry, AdminUserRow } from '../../services/adminService';

/** לוגיקה טהורה של מסך הניהול: סינון, מיון, ייצוא ותוויות. */

export type AccountFilter = 'all' | 'dormant' | 'pending' | 'payment' | 'blocked' | 'unused';
export type AccountSort = 'lastSeen' | 'created' | 'actions';

export const FILTER_LABEL: Record<AccountFilter, string> = {
  all: 'הכול',
  dormant: 'לא נכנסו 30 יום',
  unused: 'נרשמו בלי פעולות',
  pending: 'ממתינים',
  payment: 'עם דרישת תשלום',
  blocked: 'חסומים',
};

export const SORT_LABEL: Record<AccountSort, string> = {
  lastSeen: 'כניסה אחרונה',
  created: 'הרשמה',
  actions: 'מספר פעולות',
};

const DAY = 24 * 60 * 60 * 1000;

export function matchesFilter(u: AdminUserRow, filter: AccountFilter, now: number): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'dormant':
      return (u.lastSignInAt ?? u.createdAt) < now - 30 * DAY;
    case 'unused':
      return u.txTotal === 0;
    case 'pending':
      return u.status === 'pending' || u.status === 'none';
    case 'payment':
      return u.payment !== null;
    case 'blocked':
      return u.status === 'blocked' || u.disabled;
  }
}

export function sortAccounts(list: readonly AdminUserRow[], sort: AccountSort): AdminUserRow[] {
  const key = (u: AdminUserRow) => (sort === 'lastSeen' ? (u.lastSignInAt ?? 0) : sort === 'created' ? u.createdAt : u.txTotal);
  return [...list].sort((a, b) => key(b) - key(a));
}

export const PLATFORM_LABEL: Record<string, string> = {
  android: 'אנדרואיד',
  windows: 'תוכנת Windows',
  web: 'אתר',
  unknown: 'לא ידוע (עוד לא נפתח בגרסה חדשה)',
};

export function platformLabel(p: string | undefined): string {
  return PLATFORM_LABEL[p ?? 'unknown'] ?? p ?? '';
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  // הגנה מפני הזרקת נוסחאות באקסל
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

const fmtDate = (ms: number | null): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** CSV עם BOM (נפתח באקסל בעברית נכון): פרטי החשבונות, בלי סכומים ובלי תוכן פעולות. */
export function accountsCsv(users: readonly AdminUserRow[]): string {
  const head = ['אימייל', 'שם פרטי', 'שם משפחה', 'טלפון', 'שם העסק', 'סטטוס', 'נרשם', 'כניסה אחרונה', 'פעולות', 'פלטפורמה', 'גרסה', 'הערה'];
  const rows = users.map((u) => [
    u.email,
    u.details?.firstName ?? '',
    u.details?.lastName ?? '',
    u.details?.phone ?? '',
    u.details?.businessName ?? '',
    u.disabled ? 'חסום' : u.status,
    fmtDate(u.createdAt),
    fmtDate(u.lastSignInAt),
    u.txTotal,
    platformLabel(u.client?.platform),
    u.client?.version ?? '',
    u.note ?? '',
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export const REPLY_TEMPLATES: readonly { label: string; text: string }[] = [
  { label: 'תודה, נטפל', text: 'תודה על הפנייה. קיבלתי ואטפל בזה בהקדם.' },
  { label: 'עודכנה גרסה', text: 'יצאה גרסה חדשה שמטפלת בזה. כדאי לעדכן את האפליקציה (יופיע חלון עדכון) או לרענן את האתר.' },
  { label: 'נסו שוב', text: 'כדאי לצאת מהחשבון, להיכנס שוב ולנסות. אם הבעיה נשארת, כתבו לי מה בדיוק קורה.' },
  { label: 'החשבון אושר', text: 'החשבון שלך אושר. אפשר להיכנס ולהשתמש באפליקציה.' },
];

export const LOG_LABEL: Record<string, string> = {
  'status:approved': 'אישור חשבון',
  'status:pending': 'החזרה להמתנה',
  'status:blocked': 'חסימת חשבון',
  'approve-existing': 'אישור כל החשבונות הקיימים',
  'payment:set': 'דרישת תשלום',
  'payment:remove': 'הסרת דרישת תשלום',
  'delete-account': 'מחיקת חשבון',
  'notice:one': 'הודעה לחשבון',
  'notice:all': 'הודעה לכולם',
  'notice:group': 'הודעה לקבוצה',
};

export function logLine(e: AdminLogEntry): string {
  return [LOG_LABEL[e.action] ?? e.action, e.email, e.detail].filter(Boolean).join(' · ');
}
