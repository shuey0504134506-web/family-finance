// Deterministic, offline financial analysis. No credentials or network access.
const cents = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e12 ? Math.round(n * 100) : 0;
const fmt = (n) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(n / 100);

export function analyze(summary, question) {
  const rows = Array.isArray(summary?.monthlyTotals) ? summary.monthlyTotals.filter(r => r && /^\d{4}-\d{2}$/.test(r.month)) : [];
  const q = String(question ?? '');
  if (!/הכנ|הוצ|חיס|מאזן|תקצ|חוד|שנ|כס|השוו|סיכו|יתרה|income|expense|saving|balance|budget|month|year/i.test(q)) return 'המנוע המקומי תומך בסיכום הכנסות, הוצאות, יתרה, השוואת חודשים ויעד חיסכון.';
  const year = /שנתי|השנה|annual|yearly|this year/i.test(q);
  const month = q.match(/\b\d{4}-\d{2}\b/)?.[0] ?? summary?.selectedMonth;
  const selected = year ? rows.filter(r => r.month.slice(0, 4) === month?.slice(0, 4)) : rows.filter(r => r.month === month);
  if (!selected.length) return 'אין נתונים לתקופה המבוקשת.';
  const income = selected.reduce((s, r) => s + cents(r.income), 0);
  const expenses = selected.reduce((s, r) => s + cents(r.expenses), 0);
  const balance = income - expenses;
  const lines = [`${year ? month.slice(0, 4) : month} — סיכום מקומי`, `הכנסות: ${fmt(income)}`, `הוצאות: ${fmt(expenses)}`, `יתרה: ${fmt(balance)}`];
  if (!year && typeof summary.monthlySavingsGoal === 'number') {
    const goal = cents(summary.monthlySavingsGoal);
    lines.push(`יעד חיסכון: ${fmt(goal)}; ${balance >= goal ? 'היעד הושג' : `חסרים ${fmt(goal - balance)}`}`);
  }
  if (!year) {
    const [y, m] = month.split('-').map(Number);
    const prior = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
    const previous = rows.find(r => r.month === prior);
    if (previous) lines.push(`שינוי בהוצאות לעומת ${prior}: ${fmt(expenses - cents(previous.expenses))}`);
  }
  return lines.join('\n');
}

// API-key format is not proof that billing is disabled. Until a provider can
// attest enforceable zero spend, all remote generation must stay blocked.
export function remoteGenerationAllowed() { return false; }
