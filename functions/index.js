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

async function approvalStatuses(uids) {
  const db = admin.firestore();
  const out = new Map();
  for (let i = 0; i < uids.length; i += 300) {
    const refs = uids.slice(i, i + 300).map((uid) => db.collection('approvals').doc(uid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, k) => out.set(uids[i + k], snap.exists ? snap.data().status : 'none'));
  }
  return out;
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
    status: 'none',
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
  const statuses = await approvalStatuses(rows.map((r) => r.uid));
  for (const r of rows) r.status = statuses.get(r.uid) ?? 'none';
  rows.sort((a, b) => (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0));

  const activeWithin = (ms) => rows.filter((r) => r.lastSignInAt && now - r.lastSignInAt < ms).length;
  return {
    generatedAt: now,
    truncated: users.length >= MAX_USERS,
    totals: {
      accounts: rows.length,
      disabled: rows.filter((r) => r.disabled).length,
      pending: rows.filter((r) => r.status === 'pending').length,
      undecided: rows.filter((r) => r.status === 'none').length,
      active24h: activeWithin(DAY),
      active7d: activeWithin(7 * DAY),
      active30d: activeWithin(30 * DAY),
      newLast7d: rows.filter((r) => now - r.createdAt < 7 * DAY).length,
    },
    users: rows,
  };
});

const STATUSES = ['approved', 'pending', 'blocked'];

/**
 * אישור, חסימה או החזרה להמתנה של חשבון. הכתיבה לרשומת האישור נעשית בשרת בלבד
 * (כללי Firestore אוסרים על המשתמש לשנות אותה). חסימה גם משביתה את הכניסה ומנתקת מכשירים מחוברים.
 */
exports.adminSetStatus = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { uid, status } = request.data ?? {};
  if (typeof uid !== 'string' || !uid || !STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  }
  const target = await admin.auth().getUser(uid).catch(() => null);
  if (!target) throw new HttpsError('not-found', 'החשבון לא נמצא.');
  if (uid === request.auth.uid || ADMIN_EMAILS.includes(String(target.email ?? '').toLowerCase())) {
    throw new HttpsError('failed-precondition', 'אי אפשר לשנות את חשבון המנהל.');
  }
  await admin.firestore().collection('approvals').doc(uid).set(
    { status, createdAt: Date.now(), decidedAt: Date.now() },
    { merge: true },
  );
  await admin.auth().updateUser(uid, { disabled: status === 'blocked' });
  if (status === 'blocked') await admin.auth().revokeRefreshTokens(uid);
  return { ok: true };
});

/**
 * חד-פעמי, לפני הפעלת דרישת האישור: מאשר את כל החשבונות שעדיין בלי החלטה (קיימים מלפני הכלל),
 * ואת אלה שממתינים. חשבונות חסומים לא משתנים.
 */
exports.adminApproveExisting = onCall({ region: REGION, timeoutSeconds: 300 }, async (request) => {
  requireAdmin(request);
  const users = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  const statuses = await approvalStatuses(users.map((u) => u.uid));
  const db = admin.firestore();
  let approved = 0;
  const todo = users.filter((u) => {
    const st = statuses.get(u.uid);
    return st === 'none' || st === 'pending';
  });
  for (let i = 0; i < todo.length; i += 400) {
    const batch = db.batch();
    for (const u of todo.slice(i, i + 400)) {
      batch.set(db.collection('approvals').doc(u.uid), { status: 'approved', createdAt: Date.now(), decidedAt: Date.now() }, { merge: true });
      approved += 1;
    }
    await batch.commit();
  }
  return { approved };
});
