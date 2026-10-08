import { useRef, useState, type PointerEvent } from 'react';

const SIZE = 240;
const STEP = 80;
const HIT_RADIUS = 30;
const center = (index: number) => ({ x: 40 + (index % 3) * STEP, y: 40 + Math.floor(index / 3) * STEP });

/** רשת 3x3 לציור תבנית באצבע או בעכבר. מחזירה את סדרת הנקודות (0 עד 8) כשהאצבע משתחררת. */
export function PatternPad({
  onComplete,
  disabled = false,
  invalid = false,
  label,
}: {
  onComplete: (sequence: number[]) => void;
  disabled?: boolean;
  /** מציג את התבנית באדום קצר אחרי טעות. */
  invalid?: boolean;
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sequence, setSequence] = useState<number[]>([]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const current = useRef<number[]>([]);

  const toLocal = (event: PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const track = (event: PointerEvent) => {
    const point = toLocal(event);
    if (!point) return;
    setPointer(point);
    for (let i = 0; i < 9; i += 1) {
      const c = center(i);
      if (!current.current.includes(i) && Math.hypot(c.x - point.x, c.y - point.y) <= HIT_RADIUS) {
        current.current = [...current.current, i];
        setSequence(current.current);
      }
    }
  };

  const onDown = (event: PointerEvent) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    current.current = [];
    setSequence([]);
    track(event);
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setPointer(null);
    const result = current.current;
    current.current = [];
    if (result.length > 0) onComplete(result);
    // ממתינים רגע כדי שהמשתמש יראה מה צייר, ואז מנקים.
    window.setTimeout(() => setSequence([]), 350);
  };

  const points = sequence.map(center);
  const path = [...points, ...(drawing.current && pointer ? [pointer] : [])]
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      className={`pattern-pad${invalid ? ' is-invalid' : ''}${disabled ? ' is-disabled' : ''}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={(e) => drawing.current && track(e)}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {points.length > 0 && <polyline points={path} className="pattern-line" />}
      {Array.from({ length: 9 }, (_, i) => {
        const c = center(i);
        const on = sequence.includes(i);
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={22} className="pattern-halo" />
            <circle cx={c.x} cy={c.y} r={on ? 11 : 7} className={on ? 'pattern-dot is-on' : 'pattern-dot'} />
          </g>
        );
      })}
    </svg>
  );
}
