import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { businessSpace, validateSpaceName, type Business } from '../../domain/spaces';
import { addBusiness, saveBusiness, saveHouseholdName } from '../../services/businessService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpaces } from '../spaces/SpacesContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * ייעוד האפליקציה: העסקים (שם לכל אחד, והוספת עסק), שם משק הבית, ומה מוצג במכשיר הזה.
 * שמות העסקים ושם הבית משותפים לכל המכשירים. בחירת התצוגה נשמרת בכל מכשיר בנפרד.
 * הסתרת עסק לא מוחקת אף נתון.
 */
export function PurposeSection() {
  const { user } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const { businesses, householdName, prefs, setPrefs, spaces } = useSpaces();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [displayError, setDisplayError] = useState('');

  const fail = () => reportFailure('לא הצלחנו לסנכרן את השינוי. יש לנסות שוב.');

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateSpaceName(newName, 'שם עסק');
    if (problem) return setAddError(problem);
    if (businesses.some((b) => b.name.trim() === newName.trim())) {
      return setAddError('כבר קיים עסק בשם הזה.');
    }
    const sortOrder = Math.max(0, ...businesses.map((b) => b.sortOrder)) + 1;
    addBusiness(user.uid, newName, sortOrder).saved.catch(fail);
    setNewName('');
    setAddError('');
  };

  // לא ניתן להסתיר הכול: תמיד נשאר לפחות מסך אחד.
  const visibleCount = spaces.length;
  const canHide = visibleCount > 1;

  const toggleBusiness = (id: string, show: boolean) => {
    const hidden = new Set(prefs.hiddenBusinessIds);
    if (show) hidden.delete(id);
    else {
      if (!canHide) return setDisplayError('חייב להישאר לפחות מסך אחד מוצג במכשיר.');
      hidden.add(id);
    }
    setDisplayError('');
    setPrefs({ ...prefs, hiddenBusinessIds: [...hidden] });
  };

  const toggleHousehold = (show: boolean) => {
    if (!show && !canHide) return setDisplayError('חייב להישאר לפחות מסך אחד מוצג במכשיר.');
    setDisplayError('');
    setPrefs({ ...prefs, showHousehold: show });
  };

  const isShown = (business: Business) => spaces.some((s) => s.key === businessSpace(business.id).key);

  return (
    <div className="settings-form">
      <h3 className="subhead">העסקים</h3>
      {businesses.length === 0 && <div className="field-hint">עדיין לא הוגדר עסק.</div>}
      {businesses.map((business) => (
        <NameField
          key={business.id}
          label="שם העסק"
          value={business.name}
          fieldLabel="שם עסק"
          onSave={(name) => saveBusiness(user.uid, { ...business, name }).catch(fail)}
        />
      ))}
      <form className="inline-add" onSubmit={onAdd} noValidate>
        <Field
          label="הוספת עסק"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          error={addError || undefined}
          placeholder="שם העסק החדש"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-secondary">
          הוספת עסק
        </button>
      </form>

      <hr className="divider" />
      <h3 className="subhead">משק הבית</h3>
      <NameField
        label="שם משק הבית"
        value={householdName}
        fieldLabel="שם משק הבית"
        onSave={(name) => saveHouseholdName(user.uid, name, Date.now()).catch(fail)}
      />
      <div className="field-hint">השם מופיע בכותרת המסך, למשל "משפחת כהן" או "הבית שלי".</div>

      <hr className="divider" />
      <h3 className="subhead">מה להציג במכשיר הזה</h3>
      <fieldset className="radio-group">
        <legend>הבחירה חלה על מכשיר זה בלבד</legend>
        {businesses.map((business) => (
          <label key={business.id} className="check-row">
            <input
              type="checkbox"
              checked={isShown(business)}
              onChange={(e) => toggleBusiness(business.id, e.target.checked)}
            />
            <span>{business.name}</span>
          </label>
        ))}
        <label className="check-row">
          <input
            type="checkbox"
            checked={spaces.some((s) => s.scope === 'household')}
            onChange={(e) => toggleHousehold(e.target.checked)}
          />
          <span>{householdName}</span>
        </label>
      </fieldset>
      <div className="field-hint">
        עסק שלא מוצג לא נמחק: כל הנתונים שלו נשמרים וזמינים במכשירים אחרים. כברירת מחדל הוא גם לא נכלל בהכנסות משק הבית במכשיר הזה.
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={prefs.includeHiddenInHousehold}
          onChange={(e) => setPrefs({ ...prefs, includeHiddenInHousehold: e.target.checked })}
        />
        <span>להכניס להכנסות משק הבית את כל העסקים, גם אלה שאינם מוצגים כאן</span>
      </label>
      <div className="field-hint">
        מתאים למי שמנהל את העסק במכשיר אחד ואת הבית במכשיר אחר: נטו העסקים יופיע גם בבית, בלי לפתוח את מסך העסק.
      </div>

      {displayError && (
        <div className="form-error" role="alert">
          {displayError}
        </div>
      )}
    </div>
  );
}

/** שדה שם שנשמר אוטומטית ביציאה מהשדה, אם השם תקין ושונה. שם לא תקין חוזר לערך השמור. */
function NameField({
  label,
  value,
  fieldLabel,
  onSave,
}: {
  label: string;
  value: string;
  fieldLabel: string;
  onSave: (name: string) => void;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState('');

  // עדכון משמכשיר אחר (או אחרי שמירה) מתעדכן בשדה.
  useEffect(() => setText(value), [value]);

  const commit = () => {
    const problem = validateSpaceName(text, fieldLabel);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    if (text.trim() !== value.trim()) onSave(text.trim());
  };

  return (
    <Field
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      error={error || undefined}
      autoComplete="off"
    />
  );
}
