// Deterministic, offline financial analysis. No credentials or network access.
const cents = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e12 ? Math.round(n * 100) : 0;
const fmt = (n) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(n / 100);

export function analyze(summary, question, history = []) {
  const rows = Array.isArray(summary?.monthlyTotals) ? summary.monthlyTotals.filter(r => r && /^\d{4}-\d{2}$/.test(r.month)) : [];
  const raw = String(question ?? '');
  const previous = Array.isArray(history) ? [...history].reverse().find(m => m?.role === 'user' && typeof m.text === 'string')?.text : '';
  const followup = /^(למה|מדוע|איך|ומה|ואיך|why|how)[?\s]*$/i.test(raw.trim());
  const q = followup && previous ? previous : raw;
  const targetMonth = q.match(/\b\d{4}-\d{2}\b/)?.[0] ?? summary?.selectedMonth;
  if (/קטגור|על מה|איפה.*כסף|category/i.test(q)) {
    const totals = new Map();
    for (const line of String(summary?.monthlyCategoryTotals ?? '').split('\n')) {
      const [month, type, category, amount] = line.split('|');
      if (month !== targetMonth || type !== 'E' || !category || !Number.isFinite(Number(amount))) continue;
      totals.set(category, (totals.get(category) ?? 0) + cents(Number(amount)));
    }
    if (!totals.size) return 'אין פירוט הוצאות לפי קטגוריה לחודש המבוקש.';
    return [`${targetMonth} — הוצאות לפי קטגוריה`, ...[...totals].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,amount])=>`${name}: ${fmt(amount)}`), ...(summary?.coverage?.categoryTotalsIncluded < summary?.coverage?.categoryTotalsTotal ? ['ייתכן שהפירוט חלקי.'] : [])].join('\n');
  }
  if (/חוב|חובות|הלווא|debt/i.test(q)) {
    const debts = Array.isArray(summary?.debts) ? summary.debts : [];
    if (!debts.length) return 'אין חובות רשומים בסיכום.';
    return ['יתרות חובות לפי הרשומות:', ...debts.slice(0,30).map(d=>`${d.direction ?? ''} ${d.name ?? ''}: ${fmt(Math.max(0,cents(d.amount)-cents(d.paid)))}`)].join('\n');
  }
  if (/תשלום|אשראי|מזומן|payment|cash|credit/i.test(q)) {
    const all = [summary?.selectedMonthTransactions, summary?.previousMonthTransactions].filter(x => typeof x === 'string').join('\n');
    const month = q.match(/\b\d{4}-\d{2}\b/)?.[0] ?? summary?.selectedMonth;
    const groups = new Map();
    for (const line of all.split('\n')) {
      const [date, type, amount, , , method] = line.split('|');
      if (!date?.startsWith(month) || type !== 'E' || !method || !Number.isFinite(Number(amount))) continue;
      const group = groups.get(method) ?? { count: 0, amount: 0 };
      group.count++; group.amount += cents(Number(amount)); groups.set(method, group);
    }
    if (!groups.size) return 'אין לי פירוט מספיק של אמצעי התשלום בחודש המבוקש.';
    const sorted = [...groups].sort((a,b) => b[1].count-a[1].count || b[1].amount-a[1].amount);
    return [`${month}: אמצעי התשלום הנפוץ ביותר לפי מספר הוצאות הוא ${sorted[0][0]}.`, ...sorted.map(([name,g])=>`${name}: ${g.count} פעולות, ${fmt(g.amount)}`), 'החישוב מבוסס על פעולות ההוצאה בחודש בלבד.'].join('\n');
  }
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
