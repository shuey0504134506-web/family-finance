import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

export type UsageLevel = 'high' | 'medium' | 'low' | 'idle';

export interface AdminUserRow {
  uid: string;
  email: string;
  createdAt: number;
  lastSignInAt: number | null;
  disabled: boolean;
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
