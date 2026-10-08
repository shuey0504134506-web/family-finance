import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { todayIso } from '../../domain/dates';
import { dueReminders, markShown, parseShownMap, saveShownKey, type Task } from '../../domain/tasks';
import { scopesForMode } from '../../domain/types';
import { saveTask } from '../../services/listService';
import { useReadyAuth } from '../auth/AuthContext';
import { useLock } from '../lock/LockContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useLists } from './ListsContext';

const RESUME_AFTER_MS = 60_000;

function loadShown(uid: string) {
  try {
    return parseShownMap(localStorage.getItem(saveShownKey(uid)));
  } catch {
    return {};
  }
}

function storeShown(uid: string, shown: Record<string, string>) {
  try {
    localStorage.setItem(saveShownKey(uid), JSON.stringify(shown));
  } catch {
    // אחסון חסום: התזכורת היומית עלולה להופיע שוב בכניסה הבאה. לא קריטי.
  }
}

/**
 * מקפיץ חלון תזכורות בכניסה לאפליקציה, עבור העסק ומשק הבית יחד.
 * נבדק: בפתיחה, אחרי פתיחת נעילה, וכשחוזרים לאפליקציה אחרי יותר מדקה בחוץ.
 */
export function RemindersHost() {
  const { user, profile } = useReadyAuth();
  const { locked } = useLock();
  const lists = useLists();
  const navigate = useNavigate();
  const { reportFailure } = useSyncNotice();
  const [trigger, setTrigger] = useState(0);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const wasLocked = useRef(locked);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const handled = useRef(-1);

  useEffect(() => {
    if (wasLocked.current && !locked) setTrigger((t) => t + 1);
    wasLocked.current = locked;
  }, [locked]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AFTER_MS && !lockedRef.current) {
        setTrigger((t) => t + 1);
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (locked || lists.loading || handled.current === trigger) return;
    handled.current = trigger;
    const scopes = scopesForMode(profile.accountMode);
    const relevant = lists.tasks.filter((t) => scopes.includes(t.scope));
    const today = todayIso();
    const shown = loadShown(user.uid);
    const due = dueReminders(relevant, today, shown);
    if (due.length === 0) return;
    storeShown(user.uid, markShown(shown, due, relevant, today));
    setShownIds(due.map((t) => t.id));
  }, [trigger, locked, lists.loading, lists.tasks, profile.accountMode, user.uid]);

  const visible: Task[] = lists.tasks.filter((t) => shownIds.includes(t.id) && !t.done);
  if (visible.length === 0) return null;

  const markDone = (task: Task) =>
    saveTask(user.uid, { ...task, done: true, updatedAt: Date.now() }).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את המשימה. יש לנסות שוב.'),
    );

  const both = scopesForMode(profile.accountMode).length > 1;

  return (
    <Modal title="תזכורות" onClose={() => setShownIds([])}>
      <ul className="reminder-list">
        {visible.map((task) => (
          <li key={task.id} className="reminder-item">
            <span className="reminder-text">
              {both && <span className="chip-label">{task.scope === 'business' ? 'עסק' : 'משק בית'}</span>}
              {task.title}
            </span>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void markDone(task)}>
              בוצע
            </button>
          </li>
        ))}
      </ul>
      <div className="stack">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const scope = visible[0].scope;
            setShownIds([]);
            navigate(`/${scope}/tasks`);
          }}
        >
          פתיחת רשימת המשימות
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setShownIds([])}>
          סגירה
        </button>
      </div>
    </Modal>
  );
}
