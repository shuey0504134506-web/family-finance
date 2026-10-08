import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { todayIso } from '../../domain/dates';
import { dueReminders, markShown, parseShownMap, saveShownKey, type Task } from '../../domain/tasks';
import { spaceOfItem } from '../../domain/spaces';
import { saveTask } from '../../services/listService';
import { useReadyAuth } from '../auth/AuthContext';
import { useLock } from '../lock/LockContext';
import { useSpaces } from '../spaces/SpacesContext';
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
  const { user } = useReadyAuth();
  const { spaces, nameOf } = useSpaces();
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
    const relevant = lists.tasks.filter((t) => spaceOfItem(t, spaces));
    const today = todayIso();
    const shown = loadShown(user.uid);
    const due = dueReminders(relevant, today, shown);
    if (due.length === 0) return;
    storeShown(user.uid, markShown(shown, due, relevant, today));
    setShownIds(due.map((t) => t.id));
  }, [trigger, locked, lists.loading, lists.tasks, spaces, user.uid]);

  const visible: Task[] = lists.tasks.filter((t) => shownIds.includes(t.id) && !t.done);
  if (visible.length === 0) return null;

  const markDone = (task: Task) =>
    saveTask(user.uid, { ...task, done: true, updatedAt: Date.now() }).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את המשימה. יש לנסות שוב.'),
    );

  const several = spaces.length > 1;

  return (
    <Modal title="תזכורות" onClose={() => setShownIds([])}>
      <ul className="reminder-list">
        {visible.map((task) => (
          <li key={task.id} className="reminder-item">
            <span className="reminder-text">
              {several && <span className="chip-label">{nameOf(spaceOfItem(task, spaces) ?? spaces[0])}</span>}
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
            const target = spaceOfItem(visible[0], spaces) ?? spaces[0];
            setShownIds([]);
            navigate(`/${target.key}/tasks`);
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
