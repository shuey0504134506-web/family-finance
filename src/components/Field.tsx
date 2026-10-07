import { useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
}

/** שדה טופס עם תווית, הודעת שגיאה ורמז. גודל גופן 16px כדי שדפדפן לא יתקרב אוטומטית. */
export function Field({ label, error, hint, ...inputProps }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`input${error ? ' input-error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...inputProps}
      />
      {(error || hint) && (
        <div id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </div>
      )}
    </div>
  );
}
