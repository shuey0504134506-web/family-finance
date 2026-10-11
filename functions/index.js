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
    snaps.forEach((snap, k) => {
      const d = snap.exists ? snap.data() : {};
      out.set(uids[i + k], { status: d.status ?? 'none', payment: d.payment ?? null, notice: d.notice ?? null });
    });
  }
  return out;
}

const TZ = 'Asia/Jerusalem';
const dayKey = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));

/** ימי השימוש של כל חשבון: usage/{uid}.days = {'YYYY-MM-DD': מספר פתיחות}. */
async function usageDays(uids) {
  const db = admin.firestore();
  const out = new Map();
  for (let i = 0; i < uids.length; i += 300) {
    const refs = uids.slice(i, i + 300).map((uid) => db.collection('usage').doc(uid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, k) => out.set(uids[i + k], snap.exists ? snap.data().days ?? {} : {}));
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
    payment: null,
    notice: null,
    opens7d: 0,
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
  for (const r of rows) {
    const a = statuses.get(r.uid);
    r.status = a?.status ?? 'none';
    r.payment = a?.payment ?? null;
    r.notice = a?.notice ?? null;
  }
  const usage = await usageDays(rows.map((r) => r.uid));
  const days = Array.from({ length: 14 }, (_, i) => dayKey(now - (13 - i) * DAY));
  const daily = days.map((date) => ({ date, activeAccounts: 0, opens: 0 }));
  for (const r of rows) {
    const d = usage.get(r.uid) ?? {};
    days.forEach((date, i) => {
      const n = Number(d[date]) || 0;
      if (n > 0) {
        daily[i].activeAccounts += 1;
        daily[i].opens += n;
      }
      if (i >= 7) r.opens7d += n;
    });
  }
  rows.sort((a, b) => (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0));

  const activeWithin = (ms) => rows.filter((r) => r.lastSignInAt && now - r.lastSignInAt < ms).length;
  return {
    generatedAt: now,
    truncated: users.length >= MAX_USERS,
    daily,
    totals: {
      accounts: rows.length,
      disabled: rows.filter((r) => r.disabled).length,
      paymentRequired: rows.filter((r) => r.payment).length,
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
    const st = statuses.get(u.uid)?.status;
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

/**
 * דרישת תשלום לחשבון: מועד (נעילה אוטומטית אחריו), סכום, קישור ומלל חופשי.
 * הכללים בשרת חוסמים את הגישה לנתונים אחרי המועד. dueAt = null מסיר את הדרישה.
 */
exports.adminSetPayment = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { uid, dueAt, amountText, url, message } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  const target = await admin.auth().getUser(uid).catch(() => null);
  if (!target) throw new HttpsError('not-found', 'החשבון לא נמצא.');
  if (uid === request.auth.uid || ADMIN_EMAILS.includes(String(target.email ?? '').toLowerCase())) {
    throw new HttpsError('failed-precondition', 'אי אפשר להגדיר תשלום לחשבון המנהל.');
  }
  const ref = admin.firestore().collection('approvals').doc(uid);
  if (dueAt === null) {
    await ref.set({ payment: admin.firestore.FieldValue.delete() }, { merge: true });
    return { ok: true };
  }
  if (typeof dueAt !== 'number' || !Number.isFinite(dueAt) || dueAt <= 0) {
    throw new HttpsError('invalid-argument', 'מועד לא תקין.');
  }
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const link = text(url, 500);
  if (link) {
    let ok = false;
    try {
      ok = new URL(link).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) throw new HttpsError('invalid-argument', 'קישור התשלום חייב להתחיל ב-https://');
  }
  const payment = { dueAt: Math.round(dueAt), amountText: text(amountText, 60), url: link, message: text(message, 1000) };
  await ref.set({ payment }, { merge: true });
  return { ok: true };
});

/** מספר החשבונות שממתינים לאישור (קריאה זולה, להצגת תג ליד הכפתור בהגדרות). */
exports.adminPendingCount = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const db = admin.firestore();
  const [pending, messages, answered] = await Promise.all([
    count(db.collection('approvals').where('status', '==', 'pending')),
    count(db.collection('messages')),
    count(db.collection('messages').where('repliedAt', '>', 0)),
  ]);
  return { pending, unanswered: Math.max(0, messages - answered) };
});

/**
 * מחיקת חשבון סופית: כל הנתונים, רשומות האישור והשימוש, וההתחברות. אין שחזור.
 */
exports.adminDeleteAccount = onCall({ region: REGION, timeoutSeconds: 300 }, async (request) => {
  requireAdmin(request);
  const { uid } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  const target = await admin.auth().getUser(uid).catch(() => null);
  if (!target) throw new HttpsError('not-found', 'החשבון לא נמצא.');
  if (uid === request.auth.uid || ADMIN_EMAILS.includes(String(target.email ?? '').toLowerCase())) {
    throw new HttpsError('failed-precondition', 'אי אפשר למחוק את חשבון המנהל.');
  }
  const db = admin.firestore();
  await db.recursiveDelete(db.collection('users').doc(uid));
  const msgs = await db.collection('messages').where('uid', '==', uid).get();
  await Promise.all([
    db.collection('approvals').doc(uid).delete(),
    db.collection('usage').doc(uid).delete(),
    ...msgs.docs.map((d) => d.ref.delete()),
  ]);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

/**
 * הודעה שקופצת אצל המשתמש ברגע שהוא פותח את האפליקציה (או מיד, אם היא פתוחה).
 * uid = 'all' שולח לכל החשבונות המאושרים. text ריק = הסרת ההודעה מחשבון אחד.
 */
exports.adminSendNotice = onCall({ region: REGION, timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  const { uid, title, text } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const body = clean(text, 1000);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  if (uid !== 'all') {
    const target = await admin.auth().getUser(uid).catch(() => null);
    if (!target) throw new HttpsError('not-found', 'החשבון לא נמצא.');
    const ref = db.collection('approvals').doc(uid);
    if (!body) {
      await ref.set({ notice: FieldValue.delete() }, { merge: true });
      return { sent: 0 };
    }
    await ref.set({ notice: { id: String(Date.now()), title: clean(title, 80), text: body, createdAt: Date.now() } }, { merge: true });
    return { sent: 1 };
  }

  if (!body) throw new HttpsError('invalid-argument', 'יש לכתוב הודעה.');
  const adminUids = new Set();
  for (const email of ADMIN_EMAILS) {
    const u = await admin.auth().getUserByEmail(email).catch(() => null);
    if (u) adminUids.add(u.uid);
  }
  const snap = await db.collection('approvals').where('status', '==', 'approved').get();
  const notice = { id: String(Date.now()), title: clean(title, 80), text: body, createdAt: Date.now() };
  const docs = snap.docs.filter((d) => !adminUids.has(d.id));
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.set(d.ref, { notice }, { merge: true }));
    await batch.commit();
  }
  return { sent: docs.length };
});

async function emailsFor(uids) {
  const out = new Map();
  for (let i = 0; i < uids.length; i += 100) {
    const res = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    res.users.forEach((u) => out.set(u.uid, u.email ?? ''));
  }
  return out;
}

/** הודעות ממשתמשים (200 האחרונות), עם האימייל של השולח. */
exports.adminListMessages = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const snap = await admin.firestore().collection('messages').orderBy('createdAt', 'desc').limit(200).get();
  const emails = await emailsFor([...new Set(snap.docs.map((d) => d.data().uid))]);
  return {
    messages: snap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id,
        uid: m.uid,
        email: emails.get(m.uid) ?? '',
        text: m.text ?? '',
        createdAt: m.createdAt ?? 0,
        reply: m.reply ?? '',
        repliedAt: m.repliedAt ?? null,
      };
    }),
  };
});

/** מענה להודעה: נשמר בהודעה, ובנוסף קופץ אצל המשתמש כשהוא פותח את האפליקציה. */
exports.adminReplyMessage = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { id, text } = request.data ?? {};
  const reply = typeof text === 'string' ? text.trim().slice(0, 1000) : '';
  if (typeof id !== 'string' || !id || !reply) throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  const db = admin.firestore();
  const ref = db.collection('messages').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'ההודעה לא נמצאה.');
  const now = Date.now();
  await ref.update({ reply, repliedAt: now });
  await db.collection('approvals').doc(snap.data().uid).set(
    { notice: { id: `reply-${id}-${now}`, title: 'תשובה מהמנהל', text: reply, createdAt: now } },
    { merge: true },
  );
  return { ok: true };
});

exports.adminDeleteMessage = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { id } = request.data ?? {};
  if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'בקשה לא תקינה.');
  await admin.firestore().collection('messages').doc(id).delete();
  return { ok: true };
});
