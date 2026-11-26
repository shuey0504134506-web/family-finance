import { useRef, useState } from 'react';
import { suppressLock } from '../../services/lockSuppress';
import { BACKGROUND_CHOICES, backgroundImage, fileToBackground, saveHomeBackground, useHomeBackgroundValue } from '../../services/homeBackground';
import { useReadyAuth } from '../auth/AuthContext';

/** רקע מסך הבית (משק הבית והעסק): תמונה אישית שנשמרת במכשיר הזה בלבד ומחליפה את נוף ההרים. */
export function HomeBackgroundControl() {
  const { user } = useReadyAuth();
  const data = useHomeBackgroundValue(user.uid);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      saveHomeBackground(user.uid, await fileToBackground(file));
    } catch {
      setError('לא הצלחנו להשתמש בקובץ הזה. יש לבחור תמונה (JPG, PNG או WebP).');
    }
  };

  return (
    <div className="stack">
      <p className="muted small">
        אפשר לבחור רקע לכל מסכי האפליקציה, כולל מסך הנעילה, או להעלות תמונה משלך. התמונה נשמרת במכשיר הזה בלבד
        (בכל מכשיר אפשר לבחור תמונה אחרת), והיא מקבלת אוטומטית את אותה בהירות של הנוף, כדי שהמסך יישאר קריא.
      </p>
      <div className="field logo-control">
        <span className="field-label">תמונת רקע</span>
        <div className="background-choices" role="group" aria-label="בחירת רקע">{BACKGROUND_CHOICES.map(b => <button key={b.id} type="button" className="background-choice" aria-pressed={b.id === 'default' ? !data : data === `preset:${b.id}`} onClick={()=>{try{saveHomeBackground(user.uid,b.id==='default'?null:`preset:${b.id}`);setError('');}catch{setError('לא הצלחנו לשמור את הרקע.');}}}><img src={b.src} alt=""/><span>{b.name}</span></button>)}</div>
        <div className="logo-row">
          <img className="logo-preview" src={backgroundImage(data)} alt="" width={56} height={56} />
          <button type="button" className="btn btn-secondary" onClick={() => { suppressLock(); input.current?.click(); }}>
            {data ? 'החלפת תמונה' : 'הוספת תמונה'}
          </button>
          {data && (
            <button type="button" className="btn btn-secondary" onClick={() => {try{saveHomeBackground(user.uid,null);setError('');}catch{setError('לא הצלחנו לשמור את הרקע.');}}}>
              חזרה לנוף ההרים
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
    </div>
  );
}
