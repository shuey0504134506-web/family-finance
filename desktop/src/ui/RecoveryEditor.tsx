import { useMemo, useState } from 'react';
import { Field } from '../../../src/components/Field';
import { normalizeAnswer, QUESTION_COUNT, validateCustomQuestion, type DerivedCandidate, type RecoveryQuestion } from '../core/recovery';

export const SUGGESTED_QUESTIONS = [
  'מה האוכל שאתה הכי אוהב?',
  'איך קראו לחיית המחמד הראשונה שלך?',
  'באיזו עיר נולדת?',
  'מה שם בית הספר היסודי שלך?',
  'מה שם הרחוב שגדלת בו?',
  'מה שם החבר הכי טוב מהילדות?',
  'מה שם הת"ת או החדר שבו למדת בילדותך?',
  'מה שם המלמד או המורה הראשונה שאהבת?',
  'מה שם הישיבה או הסמינר שבהם למדת?',
  'באיזה בית כנסת התפללת בילדותך?',
  'איזו פרשה נקראה בשבת של בר המצווה או בת המצווה שלך?',
  'על שם מי נקראת?',
  'מה שם המשפחה של סבתך מצד אמך?',
  'מה היה המאכל האהוב עליך בסעודת שבת בילדות?',
  'מה שם הרב או המחנך שהשפיע עליך הכי הרבה?',
  'באיזו עיר או באיזה אולם התקיימה החתונה שלך?',
];

type Slot = { mode: 'custom'; text: string; answer: string } | { mode: 'derived'; pick: number };

const emptySlot = (i: number): Slot => ({ mode: 'custom', text: SUGGESTED_QUESTIONS[i] ?? '', answer: '' });

/**
 * עורך שלוש שאלות זיהוי לשחזור סיסמה. שאלה אישית: המשתמש כותב שאלה ותשובה.
 * שאלה מהפעולות: נבחרת מתוך הפעולות האחרונות, והתשובה נגזרת מהן אוטומטית (המשתמש יצטרך לזכור אותה).
 */
export function RecoveryEditor({
  derived,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  derived: DerivedCandidate[];
  submitLabel: string;
  busy?: boolean;
  error?: string;
  onSubmit: (questions: RecoveryQuestion[], answers: string[]) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: QUESTION_COUNT }, (_, i) => emptySlot(i)));
  const [problem, setProblem] = useState('');
  const canDerive = derived.length > 0;
  const taken = useMemo(() => new Set(slots.flatMap((s) => (s.mode === 'derived' ? [s.pick] : []))), [slots]);

  const patch = (i: number, next: Slot) => setSlots((cur) => cur.map((s, j) => (j === i ? next : s)));

  function submit() {
    const questions: RecoveryQuestion[] = [];
    const answers: string[] = [];
    for (const s of slots) {
      if (s.mode === 'derived') {
        const c = derived[s.pick]!;
        questions.push(c.question);
        answers.push(c.answer);
      } else {
        const bad = validateCustomQuestion(s.text, s.answer);
        if (bad) return setProblem(bad);
        questions.push({ kind: 'custom', text: s.text.trim() });
        answers.push(s.answer);
      }
    }
    const texts = questions.map((q) => q.text.trim());
    if (new Set(texts).size !== texts.length) return setProblem('אין להשתמש באותה שאלה פעמיים.');
    if (new Set(answers.map(normalizeAnswer)).size < answers.length) return setProblem('התשובות חייבות להיות שונות זו מזו.');
    setProblem('');
    onSubmit(questions, answers);
  }

  return (
    <div className="recovery-editor">
      {slots.map((s, i) => (
        <section key={i} className="card recovery-slot" aria-label={`שאלה ${i + 1}`}>
          <div className="recovery-slot-head">
            <strong>שאלה {i + 1}</strong>
            {canDerive && (
              <div className="seg" role="group" aria-label="סוג השאלה">
                <button type="button" className={`chip-btn${s.mode === 'custom' ? ' chip-active' : ''}`} onClick={() => patch(i, emptySlot(i))}>
                  שאלה שלי
                </button>
                <button
                  type="button"
                  className={`chip-btn${s.mode === 'derived' ? ' chip-active' : ''}`}
                  onClick={() => patch(i, { mode: 'derived', pick: derived.findIndex((_, k) => !taken.has(k)) })}
                >
                  מהפעולות שלי
                </button>
              </div>
            )}
          </div>
          {s.mode === 'custom' ? (
            <>
              <div className="field">
                <label htmlFor={`sqp-${i}`}>בחירה מרשימת שאלות</label>
                <select id={`sqp-${i}`} className="input" value="" onChange={(e) => e.target.value && patch(i, { ...s, text: e.target.value })}>
                  <option value="">בחירת שאלה מוכנה…</option>
                  {SUGGESTED_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <Field label="השאלה" value={s.text} maxLength={120} onChange={(e) => patch(i, { ...s, text: e.target.value })} list={`sq-${i}`} />
              <datalist id={`sq-${i}`}>{SUGGESTED_QUESTIONS.map((q) => <option key={q} value={q} />)}</datalist>
              <Field label="התשובה" value={s.answer} autoComplete="off" onChange={(e) => patch(i, { ...s, answer: e.target.value })} />
            </>
          ) : (
            <div className="field">
              <label>בחירת שאלה מהפעולות האחרונות</label>
              <select className="input" value={s.pick} onChange={(e) => patch(i, { mode: 'derived', pick: Number(e.target.value) })}>
                {derived.map((c, k) => (
                  <option key={k} value={k} disabled={taken.has(k) && k !== s.pick}>{c.question.text}</option>
                ))}
              </select>
              <div className="field-hint">התשובה נלקחת אוטומטית מהנתונים שלך ואינה מוצגת כאן. כדי לשחזר סיסמה תצטרך לזכור אותה.</div>
            </div>
          )}
        </section>
      ))}
      <p className="muted small">בשחזור סיסמה יש לענות נכון על שלוש השאלות. אין דרך אחרת לשחזר סיסמה בחשבון מנותק, ולכן כדאי לבחור תשובות שלא תשכח.</p>
      {(problem || error) && <div className="form-error" role="alert">{problem || error}</div>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'שומר…' : submitLabel}</button>
    </div>
  );
}
