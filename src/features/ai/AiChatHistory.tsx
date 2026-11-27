import { useState } from 'react';
import { tr } from '../../i18n/translate';
import type { StoredAiChat } from '../../services/aiService';

export function AiChatHistory({ chats, active, open, onClose, onNew, onOpen, onPin, onDelete, busy }: {
  chats: StoredAiChat[]; active: string; open: boolean; onClose: () => void;
  onNew: () => void; onOpen: (chat: StoredAiChat) => void;
  onPin: (chat: StoredAiChat) => void; onDelete: (chat: StoredAiChat) => Promise<void>;
  busy: boolean;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const group = (title: string, items: StoredAiChat[]) => (
    <section className="ai-history-group" aria-label={title}>
      <h3>{title}</h3>
      {items.length === 0 && <p className="muted small">אין שיחות</p>}
      {items.map(chat => (
        <div key={chat.id} className={`ai-history-row${chat.id === active ? ' is-active' : ''}`}>
          <button type="button" className="ai-history-title" translate="no" title={chat.title} aria-current={chat.id === active ? 'true' : undefined} onClick={() => { onOpen(chat); onClose(); }}>
            {chat.pinned ? '📌 ' : ''}{chat.title}
          </button>
          <button type="button" className="ai-history-icon" translate="no" disabled={busy} aria-label={`${tr('פעולות עבור')} ${chat.title}`} aria-expanded={menu === chat.id} onClick={() => { setMenu(menu === chat.id ? null : chat.id); setConfirm(null); }}>⋯</button>
          {menu === chat.id && <div className="ai-history-menu">
            <button type="button" disabled={busy} onClick={() => { onPin(chat); setMenu(null); }}>{chat.pinned ? 'ביטול נעיצה' : 'נעיצה'}</button>
            <button type="button" disabled={busy} onClick={() => setConfirm(chat.id)}>מחיקה</button>
            {confirm === chat.id && <><button type="button" disabled={busy} className="ai-delete" onClick={() => { void onDelete(chat).then(() => { setMenu(null); setConfirm(null); }); }}>אישור מחיקה</button><button type="button" onClick={() => setConfirm(null)}>ביטול</button></>}
          </div>}
        </div>
      ))}
    </section>
  );
  return <>
    {open && <button className="ai-history-backdrop" type="button" aria-label="סגירת היסטוריה" onClick={onClose}/>}
    <aside id="ai-chat-history" className={`ai-history-panel${open ? ' is-open' : ''}`} aria-label="היסטוריה">
      <div className="ai-history-heading"><h2>היסטוריה</h2><button className="ai-history-icon ai-history-close" type="button" aria-label="סגירה" onClick={onClose}>×</button></div>
      <button type="button" className="ai-history-new" onClick={() => { onNew(); onClose(); }}><span aria-hidden="true">＋ </span><span>שיחה חדשה</span></button>
      {group('שיחות אחרונות', [...chats].sort((a,b)=>b.updatedAt-a.updatedAt || a.id.localeCompare(b.id)))}
    </aside>
  </>;
}
