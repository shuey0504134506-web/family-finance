import { useMemo, useState, type FormEvent } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { scopesForMode, type Category, type Scope, type TransactionType } from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { createCategory, deleteCategory, updateCategory } from '../../services/categoryService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { Icon } from '../../components/Icon';

const MAX_NAME = 60;

/** ניהול קטגוריות: הוספה, שינוי שם והשבתה. קטגוריה לא נמחקת, כדי לא לאבד היסטוריה. */
export function CategoriesScreen() {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const { categories, loading } = useCategories(user.uid);
  const scopes = scopesForMode(profile.accountMode);
  const [scope, setScope] = useState<Scope>(scopes[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const visible = useMemo(
    () => categories.filter((c) => c.scope === scope && c.type === type),
    [categories, scope, type],
  );

  const nameTaken = (name: string, exceptId?: string) =>
    visible.some((c) => c.id !== exceptId && c.name.trim() === name.trim());

  const fail = () => reportFailure('לא הצלחנו לסנכרן את שינוי הקטגוריות. יש לנסות שוב.');

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setError('יש להזין שם לקטגוריה.');
    if (name.length > MAX_NAME) return setError(`השם ארוך מדי (עד ${MAX_NAME} תווים).`);
    if (nameTaken(name)) return setError('כבר קיימת קטגוריה בשם הזה.');
    const sortOrder = Math.max(-1, ...visible.map((c) => c.sortOrder)) + 1;
    createCategory(user.uid, scope, type, name, sortOrder).saved.catch(fail);
    setNewName('');
    setError('');
  };

  const onRename = (category: Category) => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name || name.length > MAX_NAME) return setError('שם לא תקין.');
    if (nameTaken(name, category.id)) return setError('כבר קיימת קטגוריה בשם הזה.');
    updateCategory(user.uid, category, { name }).catch(fail);
    setRenaming(null);
    setError('');
  };

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title="קטגוריות" />
      <main className="content">
        {scopes.length > 1 && (
          <div className="segmented" role="group" aria-label="תחום">
            {scopes.map((s) => (
              <button
                key={s}
                type="button"
                className={s === scope ? 'is-active' : ''}
                aria-pressed={s === scope}
                onClick={() => setScope(s)}
              >
                <Icon name={s} /> {s === 'business' ? 'עסק' : 'משק בית'}
              </button>
            ))}
          </div>
        )}
        <div className="segmented" role="group" aria-label="סוג">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={t === type ? 'is-active' : ''}
              aria-pressed={t === type}
              onClick={() => setType(t)}
            >
              {t === 'expense' ? 'הוצאות' : 'הכנסות'}
            </button>
          ))}
        </div>

        <form className="card" onSubmit={onAdd} noValidate>
          <label htmlFor="new-category">קטגוריה חדשה</label>
          <input
            id="new-category"
            className={`input${error && !renaming ? ' input-error' : ''}`}
            value={newName}
            maxLength={MAX_NAME + 20}
            onChange={(e) => setNewName(e.target.value)}
          />
          {error && !renaming && <div className="field-error">{error}</div>}
          <button type="submit" className="btn btn-primary">
            הוספה
          </button>
        </form>

        {loading ? (
          <div className="card notice-card" role="status">
            טוען…
          </div>
        ) : (
          <ul className="category-list">
            {visible.map((c) => (
              <li key={c.id} className={`card category-row${c.active ? '' : ' is-inactive'}`}>
                {renaming?.id === c.id ? (
                  <>
                    <input
                      className="input"
                      aria-label="שם הקטגוריה"
                      value={renaming.name}
                      autoFocus
                      onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                    />
                    {error && <div className="field-error">{error}</div>}
                    <div className="budget-actions">
                      <button type="button" className="btn btn-primary" onClick={() => onRename(c)}>
                        שמירה
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setRenaming(null);
                          setError('');
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  </>
                ) : deleting === c.id ? (
                  <>
                    <p className="category-delete-text">
                      למחוק את "{c.name}"? פעולות שכבר נרשמו בקטגוריה נשארות עם שמה, והתקציב שלה יימחק.
                    </p>
                    <div className="budget-actions">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          deleteCategory(user.uid, c.id).catch(fail);
                          setDeleting(null);
                        }}
                      >
                        כן, למחוק
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
                        ביטול
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="category-name">
                      {c.name}
                      {!c.active && <span className="muted small"> · מושבתת</span>}
                    </span>
                    <span className="category-actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setRenaming({ id: c.id, name: c.name });
                          setError('');
                        }}
                      >
                        שינוי שם
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => updateCategory(user.uid, c, { active: !c.active }).catch(fail)}
                      >
                        {c.active ? 'השבתה' : 'הפעלה'}
                      </button>
                      <button type="button" className="link-btn link-danger" onClick={() => setDeleting(c.id)}>
                        מחיקה
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          קטגוריה מושבתת לא מוצעת בפעולות חדשות. מחיקה אפשרית רק כאן, ופעולות קיימות נשארות עם שם הקטגוריה שהיה להן. אפשר להוסיף קטגוריה חדשה גם מתוך טופס הכנסה או הוצאה.
        </p>
      </main>
    </div>
  );
}
