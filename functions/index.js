'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * מסך המנהל: פונקציות שרת בלבד. כל פונקציה בודקת בשרת שהקורא הוא המנהל.
 * הנתונים המוחזרים כלליים בלבד (מספרים ותאריכים): בלי סכומים, שמות עסקים או תוכן פעולות.
 */
const REGION = 'europe-west1';
const ADMIN_EMAILS = ['shuey0504134506@gmail.com'];
const MAX_USERS = 1000;
const DAY = 24 * 60 * 60 * 1000;

function requireAdmin(request) {
  const email = String(request.auth?.token?.email ?? '').toLowerCase();
  if (!request.auth || !ADMIN_EMAILS.includes(email)) {
    throw new HttpsError('permission-denied', 'אין הרשאה.');
  }
}

async function count(query) {
  const snap = await query.count().get();
  return snap.data().count;
}

function usageLevel(tx7d, lastActive, now) {
  if (tx7d >= 20) return 'high';
  if (tx7d >= 5) return 'medium';
  if (tx7d >= 1) return 'low';
  return lastActive && now - lastActive < 7 * DAY ? 'low' : 'idle';
}

async function statsFor(user, now) {
  const base = admin.firestore().collection('users').doc(user.uid);
  const since = now - 7 * DAY;
  const [b, h, b7, h7] = await Promise.all([
    count(base.collection('businessTransactions')),
    count(base.collection('householdTransactions')),
    count(base.collection('businessTransactions').where('createdAt', '>=', since)),
    count(base.collection('householdTransactions').where('createdAt', '>=', since)),
  ]);
  const lastActive = user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : 0;
  const tx7d = b7 + h7;
  return {
    uid: user.uid,
    email: user.email ?? '',
    createdAt: Date.parse(user.metadata.creationTime) || 0,
    lastSignInAt: lastActive || null,
    disabled: Boolean(user.disabled),
    txTotal: b + h,
    tx7d,
    usage: usageLevel(tx7d, lastActive, now),
  };
}

exports.adminOverview = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  requireAdmin(request);
  const now = Date.now();
  const users = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken && users.length < MAX_USERS);

  const rows = [];
  for (let i = 0; i < users.length; i += 10) {
    const part = await Promise.all(users.slice(i, i + 10).map((u) => statsFor(u, now)));
    rows.push(...part);
  }
  rows.sort((a, b) => (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0));

  const activeWithin = (ms) => rows.filter((r) => r.lastSignInAt && now - r.lastSignInAt < ms).length;
  return {
    generatedAt: now,
    truncated: users.length >= MAX_USERS,
    totals: {
      accounts: rows.length,
      disabled: rows.filter((r) => r.disabled).length,
      active24h: activeWithin(DAY),
      active7d: activeWithin(7 * DAY),
      active30d: activeWithin(30 * DAY),
      newLast7d: rows.filter((r) => now - r.createdAt < 7 * DAY).length,
    },
    users: rows,
  };
});
