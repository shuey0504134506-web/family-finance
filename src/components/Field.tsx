import { useId, useState, type InputHTMLAttributes } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  revealPassword?: boolean;
}

/** שדה טופס עם תווית, הודעת שגיאה ורמז. גודל גופן 16px כדי שדפדפן לא יתקרב אוטומטית. */
export function Field({ label, error, hint, revealPassword = false, ...inputProps }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const [revealed, setRevealed] = useState(false);
  const reveal = revealPassword && inputProps.type === 'password';
  const input = <input id={id} className={`input${error ? ' input-error' : ''}`} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? messageId : undefined} {...inputProps} type={reveal && revealed ? 'text' : inputProps.type} />;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {reveal ? <div className="password-reveal">
      {input}
      {reveal && <button type="button" className="password-eye" aria-label={revealed ? 'הסתרת סיסמה' : 'הצגת סיסמה'} aria-pressed={revealed} onClick={() => setRevealed(v => !v)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>{revealed && <path d="m3 3 18 18"/>}</svg></button>}
      </div> : input}
      {(error || hint) && (
        <div id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </div>
      )}
    </div>
  );
}
