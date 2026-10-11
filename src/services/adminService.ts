import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, limit, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { app, db } from '../firebase/config';

export type ApprovalStatus = 'approved' | 'pending' | 'blocked' | 'none';

export interface PaymentRequest {
  /** מועד הנעילה (אלפיות שנייה) */
  dueAt: number;
  amountText: string;
  url: string;
  message: string;
}

export interface AdminNoticeInfo {
  id: string;
  title: string;
  text: string;
  createdAt: number;
}

export type UsageLevel = 'high' | 'medium' | 'low' | 'idle';

export interface AdminUserRow {
  uid: string;
  email: string;
  createdAt: number;
  lastSignInAt: number | null;
  disabled: boolean;
  status: ApprovalStatus;
  payment: PaymentRequest | null;
  notice: AdminNoticeInfo | null;
  /** פתיחות האפליקציה ב-7 הימים האחרונים */
  opens7d: number;
  txTotal: number;
  tx7d: number;
  usage: UsageLevel;
}

export interface AdminOverview {
  generatedAt: number;
  truncated: boolean;
  /** 14 הימים האחרונים: כמה חשבונות פתחו את האפליקציה וכמה פתיחות היו */
  daily: { date: string; activeAccounts: number; opens: number }[];
  totals: {
    accounts: number;
    disabled: number;
    pending: number;
    paymentRequired: number;
    undecided: number;
    active24h: number;
    active7d: number;
    active30d: number;
    newLast7d: number;
  };
  users: AdminUserRow[];
}

/** סקירת כל החשבונות. הבדיקה שהקורא הוא המנהל נעשית בשרת. */
export async function loadAdminOverview(): Promise<AdminOverview> {
  const call = httpsCallable<void, AdminOverview>(getFunctions(app, 'europe-west1'), 'adminOverview');
  return (await call()).data;
}

const functions = () => getFunctions(app, 'europe-west1');

/** אישור, חסימה או החזרה להמתנה. */
export async function setAccountStatus(uid: string, status: 'approved' | 'pending' | 'blocked'): Promise<void> {
  await httpsCallable(functions(), 'adminSetStatus')({ uid, status });
}

/** חד-פעמי: אישור כל החשבונות הקיימים שעדיין בלי החלטה. מחזיר כמה אושרו. */
export async function approveExistingAccounts(): Promise<number> {
  const result = await httpsCallable<void, { approved: number }>(functions(), 'adminApproveExisting')();
  return result.data.approved;
}

/** הגדרת דרישת תשלום לחשבון. payment = null מסיר אותה. */
export async function setPaymentRequest(uid: string, payment: PaymentRequest | null): Promise<void> {
  await httpsCallable(functions(), 'adminSetPayment')(payment ? { uid, ...payment } : { uid, dueAt: null });
}

/** מספר החשבונות הממתינים לאישור (לתג בהגדרות). */
export async function loadPendingCount(): Promise<{ pending: number; unanswered: number }> {
  const result = await httpsCallable<void, { pending: number; unanswered: number }>(functions(), 'adminPendingCount')();
  return result.data;
}

export interface AdminMessage {
  id: string;
  uid: string;
  email: string;
  text: string;
  createdAt: number;
  reply: string;
  repliedAt: number | null;
}

/**
 * הודעות המשתמשים בזמן אמת (200 האחרונות). הקריאה מותרת בכללי Firestore לחשבון המנהל בלבד.
 * email נשמר בהודעה בעת השליחה (והכללים מוודאים שהוא האימייל של השולח).
 */
export function subscribeAdminMessages(onData: (list: AdminMessage[]) => void, onError: () => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(200)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const m = d.data();
          return {
            id: d.id,
            uid: typeof m.uid === 'string' ? m.uid : '',
            email: typeof m.email === 'string' ? m.email : '',
            text: typeof m.text === 'string' ? m.text : '',
            createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
            reply: typeof m.reply === 'string' ? m.reply : '',
            repliedAt: typeof m.repliedAt === 'number' ? m.repliedAt : null,
          };
        }),
      ),
    () => onError(),
  );
}

/** מענה להודעה. התשובה גם קופצת אצל המשתמש. */
export async function replyToMessage(id: string, text: string): Promise<void> {
  await httpsCallable(functions(), 'adminReplyMessage')({ id, text });
}

export async function deleteMessage(id: string): Promise<void> {
  await httpsCallable(functions(), 'adminDeleteMessage')({ id });
}

/** מחיקה סופית של חשבון וכל הנתונים שלו. */
export async function deleteAccountByAdmin(uid: string): Promise<void> {
  await httpsCallable(functions(), 'adminDeleteAccount')({ uid });
}

/** שליחת הודעה שקופצת אצל המשתמש. uid='all' = לכל החשבונות המאושרים. text ריק = הסרה מחשבון אחד. */
export async function sendNotice(uid: string | 'all', title: string, text: string): Promise<number> {
  const result = await httpsCallable<unknown, { sent: number }>(functions(), 'adminSendNotice')({ uid, title, text });
  return result.data.sent;
}
