import type { ReactNode } from 'react';

/**
 * בונה מסכים מצוירים להדגמות. הפריט שמסומן hl מקבל מסגרת, והחץ האדום מצביע עליו.
 * זה מצייר דמות של האפליקציה, לא את המסך האמיתי.
 */
export type MockItem =
  | { t: 'title'; text: string }
  | { t: 'balance'; text?: string; amount?: string }
  | { t: 'field'; label: string; value?: string; hl?: boolean }
  | { t: 'chips'; label?: string; items: { l: string; on?: boolean; hl?: boolean }[] }
  | { t: 'btn'; label: string; kind?: 'in' | 'out' | 'primary' | 'ghost'; hl?: boolean }
  | { t: 'btnrow'; items: { label: string; kind: 'in' | 'out' | 'primary' | 'ghost'; hl?: boolean }[] }
  | { t: 'row'; label: string; value?: string; hl?: boolean }
  | { t: 'bar'; label: string; value: string; pct: number; color?: string; hl?: boolean }
  | { t: 'toggle'; label: string; on?: boolean; hl?: boolean }
  | { t: 'tabs'; items: { l: string; on?: boolean; hl?: boolean }[] }
  | { t: 'header'; month?: string; hlSearch?: boolean; hlMenu?: boolean; hlSettings?: boolean }
  | { t: 'tx'; title: string; sub: string; amount: string; hlEdit?: boolean; hlDelete?: boolean }
  | { t: 'note'; text: string }
  | { t: 'gap' }
  | { t: 'spacer' };

const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

function render(item: MockItem, i: number): ReactNode {
  switch (item.t) {
    case 'title':
      return <div key={i} className="mk-title">{item.text}</div>;
    case 'balance':
      return (
        <div key={i} className="mk-center">
          <small>{item.text ?? 'החודש אנחנו בפלוס'}</small>
          <b className="mk-big">{item.amount ?? '2,162.86 ₪'}</b>
        </div>
      );
    case 'field':
      return (
        <div key={i} className={cls('mk-field', item.hl && 'mk-hl')}>
          <small>{item.label}</small>
          <b>{item.value ?? ''}</b>
        </div>
      );
    case 'chips':
      return (
        <div key={i} className="mk-group">
          {item.label && <small className="mk-label">{item.label}</small>}
          <div className="mk-chips">
            {item.items.map((c) => (
              <span key={c.l} className={cls('mk-chip', c.on && 'mk-chip-on', c.hl && 'mk-hl')}>
                {c.l}
              </span>
            ))}
          </div>
        </div>
      );
    case 'btn':
      return <div key={i} className={cls('mk-btn', `mk-btn-${item.kind ?? 'primary'}`, item.hl && 'mk-hl')}>{item.label}</div>;
    case 'btnrow':
      return (
        <div key={i} className="mk-row">
          {item.items.map((b) => (
            <span key={b.label} className={cls('mk-btn', `mk-btn-${b.kind}`, b.hl && 'mk-hl')}>
              {b.label}
            </span>
          ))}
        </div>
      );
    case 'row':
      return (
        <div key={i} className={cls('mk-line', item.hl && 'mk-hl')}>
          <span>{item.label}</span>
          {item.value && <b>{item.value}</b>}
        </div>
      );
    case 'bar':
      return (
        <div key={i} className={cls('mk-barrow', item.hl && 'mk-hl')}>
          <div className="mk-line mk-line-flat">
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
          <div className="mk-track">
            <i style={{ width: `${item.pct}%`, background: item.color ?? '#26784a' }} />
          </div>
        </div>
      );
    case 'toggle':
      return (
        <div key={i} className={cls('mk-toggle', item.hl && 'mk-hl')}>
          <span className={cls('mk-box', item.on && 'mk-box-on')}>{item.on ? '✓' : ''}</span>
          <span>{item.label}</span>
        </div>
      );
    case 'tabs':
      return (
        <div key={i} className="mk-tabs">
          {item.items.map((c) => (
            <span key={c.l} className={cls('mk-tab', c.on && 'mk-tab-on', c.hl && 'mk-hl')}>
              {c.l}
            </span>
          ))}
        </div>
      );
    case 'header':
      return (
        <div key={i} className="mk-header">
          <span className={cls('mk-ic', item.hlSettings && 'mk-hl')}>⚙</span>
          <b>{item.month ?? 'אוקטובר 2026'}</b>
          <span className="mk-ics">
            <span className={cls('mk-ic', item.hlMenu && 'mk-hl')}>☰</span>
            <span className={cls('mk-ic', item.hlSearch && 'mk-hl')}>⌕</span>
          </span>
        </div>
      );
    case 'tx':
      return (
        <div key={i} className="mk-tx">
          <div>
            <b>{item.title}</b>
            <small>{item.sub}</small>
          </div>
          <div className="mk-tx-end">
            <b>{item.amount}</b>
            <span className={cls('mk-ic', item.hlEdit && 'mk-hl')}>✎</span>
            <span className={cls('mk-ic', item.hlDelete && 'mk-hl')}>🗑</span>
          </div>
        </div>
      );
    case 'note':
      return <p key={i} className="mk-note">{item.text}</p>;
    case 'gap':
      return <div key={i} className="mk-gap" />;
    case 'spacer':
      return <div key={i} className="mk-spacer" />;
  }
}

export const mock = (items: MockItem[]): ReactNode => <div className="mk">{items.map(render)}</div>;
