import { useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Field } from '../../components/Field';
import { ScreenHeader } from '../../components/ScreenHeader';
import { buildShoppingItem, sortItems, validateItemName, type ShoppingItem } from '../../domain/tasks';
import { scopesForMode, type Scope } from '../../domain/types';
import { deleteBoughtItems, deleteShoppingItem, saveShoppingItem } from '../../services/listService';
import { newId } from '../../services/ids';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useLists } from './ListsContext';
import { ScopeSwitch } from './ScopeSwitch';

/** רשימת קניות לעסק או למשק בית. "נקנה" מסמן ומעביר לתחתית הרשימה. */
export function ShoppingScreen() {
  const params = useParams();
  const { user, profile } = useReadyAuth();
  const scope = params.scope as Scope;
  if ((scope !== 'business' && scope !== 'household') || !scopesForMode(profile.accountMode).includes(scope)) {
    return <Navigate to="/" replace />;
  }
  return <ShoppingBody scope={scope} uid={user.uid} />;
}

function ShoppingBody({ scope, uid }: { scope: Scope; uid: string }) {
  const { items, loading, error } = useLists();
  const { reportFailure } = useSyncNotice();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const mine = sortItems(items.filter((i) => i.scope === scope));
  const toBuy = mine.filter((i) => !i.bought);
  const bought = mine.filter((i) => i.bought);

  const persist = (item: ShoppingItem) =>
    saveShoppingItem(uid, item).catch(() => reportFailure('לא הצלחנו לסנכרן את רשימת הקניות. יש לנסות שוב.'));

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateItemName(name);
    setNameError(problem ?? '');
    if (problem) return;
    void persist(buildShoppingItem(name, { id: newId(), scope, now: Date.now() }));
    setName('');
  };

  const toggle = (item: ShoppingItem) => void persist({ ...item, bought: !item.bought, updatedAt: Date.now() });

  return (
    <div className="app-shell">
      <ScreenHeader title="רשימת קניות" />
      <main className="content" aria-busy={loading}>
        <ScopeSwitch scope={scope} page="shopping" />

        <form className="card settings-form" onSubmit={onAdd} noValidate>
          <Field label="פריט חדש" value={name} onChange={(e) => setName(e.target.value)} error={nameError || undefined} autoComplete="off" />
          <button type="submit" className="btn btn-primary">
            הוספה לרשימה
          </button>
        </form>

        {error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את הרשימה. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">טוען…</div>
        ) : toBuy.length === 0 ? (
          <div className="card notice-card" role="status">אין פריטים לקנות.</div>
        ) : (
          <ul className="task-list" aria-label="לקנות">
            {toBuy.map((item) => (
              <li key={item.id} className="task-row">
                <span className="task-main task-title">{item.name}</span>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => toggle(item)}>
                  נקנה
                </button>
              </li>
            ))}
          </ul>
        )}

        {bought.length > 0 && (
          <>
            <h2 className="section-title">נקנו ({bought.length})</h2>
            <ul className="task-list" aria-label="נקנו">
              {bought.map((item) => (
                <li key={item.id} className="task-row is-done">
                  <span className="task-main task-title">{item.name}</span>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => toggle(item)}>
                    החזרה
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`מחיקת ${item.name}`}
                    onClick={() => deleteShoppingItem(uid, item.id).catch(() => reportFailure('לא הצלחנו לסנכרן את המחיקה.'))}
                  >
                    מחיקה
                  </button>
                </li>
              ))}
            </ul>
            {confirmClear ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteBoughtItems(uid, bought.map((i) => i.id)).catch(() => reportFailure('לא הצלחנו לסנכרן את הניקוי.'));
                  setConfirmClear(false);
                }}
              >
                לחיצה נוספת: מחיקת כל הפריטים שנקנו
              </button>
            ) : (
              <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmClear(true)}>
                ניקוי הפריטים שנקנו
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
