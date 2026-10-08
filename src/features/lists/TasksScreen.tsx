import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { todayIso } from '../../domain/dates';
import {
  REMIND_LABELS,
  buildTask,
  sortTasks,
  validateTaskDraft,
  type RemindMode,
  type Task,
  type TaskDraft,
} from '../../domain/tasks';
import { inSpace, type Space } from '../../domain/spaces';
import { deleteTask, saveTask } from '../../services/listService';
import { newId } from '../../services/ids';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSyncNotice } from '../sync/SyncNotice';
import { useLists } from './ListsContext';
import { ScopeSwitch } from './ScopeSwitch';

const EMPTY_DRAFT: TaskDraft = { title: '', remind: 'none', remindDate: '' };

function describeReminder(task: Task): string {
  if (task.remind === 'none') return '';
  if (task.remind === 'date') return `תזכורת מ-${task.remindDate.split('-').reverse().join('/')}`;
  return `תזכורת: ${REMIND_LABELS[task.remind]}`;
}

/** רשימת משימות לעסק או למשק בית, עם תזכורות. "בוצע" מסמן ומעביר לרשימת הבוצעו. */
export function TasksScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  return <TasksBody space={space} uid={user.uid} />;
}

function TasksBody({ space, uid }: { space: Space; uid: string }) {
  const { tasks, loading, error } = useLists();
  const { reportFailure } = useSyncNotice();
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ReturnType<typeof validateTaskDraft>>({});
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  const mine = sortTasks(tasks.filter((t) => inSpace(t, space)));
  const open = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done);

  const persist = (task: Task) =>
    saveTask(uid, task).catch(() => reportFailure('לא הצלחנו לסנכרן את המשימה. יש לנסות שוב.'));

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    const found = validateTaskDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void persist(buildTask(draft, { id: newId(), scope: space.scope, businessId: space.businessId, now: Date.now() }));
    setDraft(EMPTY_DRAFT);
  };

  const toggle = (task: Task) => void persist({ ...task, done: !task.done, updatedAt: Date.now() });

  return (
    <div className="app-shell">
      <ScreenHeader title="רשימת משימות" />
      <main className="content" aria-busy={loading}>
        <ScopeSwitch space={space} page="tasks" />

        <form className="card settings-form" onSubmit={onAdd} noValidate>
          <Field
            label="משימה חדשה"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            error={errors.title}
            autoComplete="off"
          />
          <ReminderFields draft={draft} errors={errors} onChange={setDraft} />
          <button type="submit" className="btn btn-primary">
            הוספת משימה
          </button>
        </form>

        {error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את המשימות. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">טוען…</div>
        ) : open.length === 0 ? (
          <div className="card notice-card" role="status">אין משימות פתוחות.</div>
        ) : (
          <ul className="task-list" aria-label="משימות פתוחות">
            {open.map((task) => (
              <li key={task.id} className="task-row">
                <button type="button" className="task-main" onClick={() => setEditing(task)} aria-label={`עריכת המשימה ${task.title}`}>
                  <span className="task-title">{task.title}</span>
                  {describeReminder(task) && <span className="task-meta">{describeReminder(task)}</span>}
                </button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => toggle(task)}>
                  בוצע
                </button>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <>
            <button type="button" className="link-btn" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              {showDone ? 'הסתרת' : 'הצגת'} משימות שבוצעו ({done.length})
            </button>
            {showDone && (
              <ul className="task-list" aria-label="משימות שבוצעו">
                {done.map((task) => (
                  <li key={task.id} className="task-row is-done">
                    <button type="button" className="task-main" onClick={() => setEditing(task)} aria-label={`עריכת המשימה ${task.title}`}>
                      <span className="task-title">{task.title}</span>
                    </button>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => toggle(task)}>
                      החזרה
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {editing && (
        <EditTaskDialog
          task={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            void persist(next);
            setEditing(null);
          }}
          onDelete={() => {
            deleteTask(uid, editing.id).catch(() => reportFailure('לא הצלחנו לסנכרן את מחיקת המשימה.'));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ReminderFields({
  draft,
  errors,
  onChange,
}: {
  draft: TaskDraft;
  errors: ReturnType<typeof validateTaskDraft>;
  onChange: (draft: TaskDraft) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="remind-mode">תזכורת</label>
        <select
          id="remind-mode"
          className="input"
          value={draft.remind}
          onChange={(e) => {
            const remind = e.target.value as RemindMode;
            onChange({ ...draft, remind, remindDate: remind === 'date' && !draft.remindDate ? todayIso() : draft.remindDate });
          }}
        >
          {(Object.keys(REMIND_LABELS) as RemindMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {REMIND_LABELS[mode]}
            </option>
          ))}
        </select>
        <div className="field-hint">התזכורת קופצת בכניסה לאפליקציה, עד שמסמנים "בוצע".</div>
      </div>
      {draft.remind === 'date' && (
        <Field
          label="תאריך התזכורת"
          type="date"
          dir="ltr"
          value={draft.remindDate}
          onChange={(e) => onChange({ ...draft, remindDate: e.target.value })}
          error={errors.remindDate}
        />
      )}
    </>
  );
}

function EditTaskDialog({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>({ title: task.title, remind: task.remind, remindDate: task.remindDate });
  const [errors, setErrors] = useState<ReturnType<typeof validateTaskDraft>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateTaskDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave(buildTask(draft, { id: task.id, scope: task.scope, businessId: task.businessId, now: Date.now(), createdAt: task.createdAt, done: task.done }));
  };

  return (
    <Modal title="עריכת משימה" onClose={onClose}>
      <form className="settings-form" onSubmit={submit} noValidate>
        <Field label="משימה" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} error={errors.title} autoComplete="off" />
        <ReminderFields draft={draft} errors={errors} onChange={setDraft} />
        <button type="submit" className="btn btn-primary">
          אישור
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          ביטול
        </button>
        {confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            לחיצה נוספת למחיקה סופית
          </button>
        ) : (
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
            מחיקת המשימה
          </button>
        )}
      </form>
    </Modal>
  );
}
