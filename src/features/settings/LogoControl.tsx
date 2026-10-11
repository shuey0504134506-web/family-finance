import { useRef, useState } from 'react';
import { fileToLogo } from '../../services/logoImage';

/** בחירת לוגו לעסק: תצוגה מקדימה, הוספה או החלפה, והסרה. */
export function LogoControl({ data, onChange }: { data: string | null; onChange: (data: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      onChange(await fileToLogo(file));
    } catch {
      setError('לא הצלחנו להשתמש בקובץ הזה. יש לבחור תמונה (JPG, PNG או WebP).');
    }
  };

  return (
    <div className="field logo-control">
      <span className="field-label">לוגו העסק (לא חובה)</span>
      <div className="logo-row">
        {data ? <img className="logo-preview" src={data} alt="" width={56} height={56} /> : <span className="logo-preview logo-empty" aria-hidden="true" />}
        <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
          {data ? 'החלפת לוגו' : 'הוספת לוגו'}
        </button>
        {data && (
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
            הסרת לוגו
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
