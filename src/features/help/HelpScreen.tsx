import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FAQ, TIPS, type HelpItem } from './helpContent';
import { WalkthroughPlayer } from './WalkthroughPlayer';

type Tab = 'faq' | 'tips';

/** עזרה: שאלות נפוצות וטיפים, עם הדגמות מונפשות לפעולות מרכזיות. */
export function HelpScreen() {
  const [tab, setTab] = useState<Tab>('faq');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = tab === 'faq' ? FAQ : TIPS;
    const q = query.trim();
    return q ? list.filter((i) => i.title.includes(q) || i.body.includes(q)) : list;
  }, [tab, query]);

  return (
    <div className="app-shell">
      <ScreenHeader title="עזרה" />
      <main className="content">
        <div className="segmented" role="group" aria-label="סוג תוכן">
          {(
            [
              ['faq', 'שאלות נפוצות'],
              ['tips', 'טיפים'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? 'is-active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="help-search">חיפוש בעזרה</label>
          <input id="help-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>

        {items.length === 0 ? (
          <p className="muted">לא נמצא תוכן מתאים.</p>
        ) : (
          <div className="acc-list">
            {items.map((item) => (
              <HelpEntry key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function HelpEntry({ item, open, onToggle }: { item: HelpItem; open: boolean; onToggle: () => void }) {
  const panelId = `help-${item.id}`;
  return (
    <div className="help-entry">
      <button type="button" className="acc-trigger" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span>{item.title}</span>
      </button>
      {open && (
        <div id={panelId} className="help-body">
          <p>{item.body}</p>
          {item.steps && <WalkthroughPlayer steps={item.steps} label={`הדגמה: ${item.title}`} />}
          {item.links && (
            <div className="help-links">
              {item.links.map((link) => (
                <Link key={link.to + link.label} className="chip-btn" to={link.to}>
                  {link.label} ←
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
