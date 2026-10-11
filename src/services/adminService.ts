import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

export type ApprovalStatus = 'approved' | 'pending' | 'blocked' | 'none';

export type UsageLevel = 'high' | 'medium' | 'low' | 'idle';

export interface AdminUserRow {
  uid: string;
  email: string;
  createdAt: number;
  lastSignInAt: number | null;
  disabled: boolean;
  status: ApprovalStatus;
  txTotal: number;
  tx7d: number;
  usage: UsageLevel;
}

export interface AdminOverview {
  generatedAt: number;
  truncated: boolean;
  totals: {
    accounts: number;
    disabled: number;
    pending: number;
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
