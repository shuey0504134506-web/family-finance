import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevealOpen } from '../../hooks/useRevealOpen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fuzzyMatchAll } from '../../domain/fuzzy';
import { FAQ, SAVINGS, TIPS, type HelpItem } from './helpContent';
import { WalkthroughPlayer } from './WalkthroughPlayer';

type Tab = 'faq' | 'tips' | 'savings';

export interface HelpContent {
  faq: HelpItem[];
  tips: HelpItem[];
  savings: HelpItem[];
}

const DEFAULT_CONTENT: HelpContent = { faq: FAQ, tips: TIPS, savings: SAVINGS };

/** עזרה: שאלות נפוצות וטיפים, עם הדגמות מונפשות לפעולות מרכזיות. התוכנה למחשב מזינה תוכן משלה. */
export function HelpScreen({ content = DEFAULT_CONTENT }: { content?: HelpContent } = {}) {
  const [tab, setTab] = useState<Tab>('faq');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  useRevealOpen(openId);

  const q = query.trim();
  const searching = q.length > 0;

  const items = useMemo(() => {
    if (!searching) return tab === 'faq' ? content.faq : tab === 'tips' ? content.tips : content.savings;
    return searchHelp(content, q);
  }, [tab, q, searching, content]);

  return (
    <div className="app-shell">
      <ScreenHeader title="עזרה" />
      <main className="content">
        <div className="segmented" role="group" aria-label="סוג תוכן" hidden={searching}>
          {(
            [
              ['faq', 'שאלות נפוצות'],
              ['tips', 'טיפים'],
              ['savings', 'חיסכון'],
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

        {!searching && tab === 'savings' && <p className="muted small">טיפים כלליים בלבד, לא ייעוץ פיננסי או מס.</p>}

        {items.length === 0 ? (
          <p className="muted">לא נמצא תוכן מתאים.</p>
        ) : (
          <div className="acc-list">
            {items.map((item) => (
              <HelpEntry key={item.id} item={item} kind={searching ? kindOf(content, item.id) : undefined} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function HelpEntry({ item, open, onToggle, kind }: { item: HelpItem; open: boolean; onToggle: () => void; kind?: string }) {
  const panelId = `help-${item.id}`;
  return (
    <div className="help-entry" data-reveal={item.id}>
      <button type="button" className="acc-trigger" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span>{item.title}</span>
        {kind && <span className="help-kind">{kind}</span>}
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

const KIND_LABEL = { faq: 'שאלה נפוצה', tips: 'טיפ', savings: 'חיסכון' } as const;

function kindOf(content: HelpContent, id: string): string | undefined {
  if (content.faq.some((i) => i.id === id)) return KIND_LABEL.faq;
  if (content.tips.some((i) => i.id === id)) return KIND_LABEL.tips;
  if (content.savings.some((i) => i.id === id)) return KIND_LABEL.savings;
  return undefined;
}

/**
 * חיפוש אחד בכל התוכן (שאלות, טיפים וחיסכון). קודם התאמה מדויקת; אם אין, מחפשים בקירוב
 * כדי שגם טעות כתיב תגיע לתשובה. כותרת שמתאימה קודמת להתאמה בגוף הטקסט.
 */
export function searchHelp(content: HelpContent, q: string): HelpItem[] {
  const all = [...content.faq, ...content.tips, ...content.savings];
  const words = q.split(/\s+/).filter(Boolean);
  const exact = all.filter((i) => words.every((w) => i.title.includes(w) || i.body.includes(w)));
  const pool = exact.length > 0 ? exact : all.filter((i) => fuzzyMatchAll(`${i.title} ${i.body}`, q));
  const inTitle = (i: HelpItem) => (words.every((w) => i.title.includes(w)) || fuzzyMatchAll(i.title, q) ? 0 : 1);
  return [...pool].sort((a, b) => inTitle(a) - inTitle(b));
}
