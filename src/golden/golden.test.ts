import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { householdTotals, totalsByCategory, totalsOf, transferFromBusinesses } from '../domain/summary';
import { spendingBreakdown } from '../features/home/spending';
import { parseWorkbook } from '../domain/import/parse';
import type { Sheet } from '../domain/import/text';

/**
 * בדיקות Golden: לכל תרחיש יש שני קבצים בתיקיית cases:
 *   <שם>.input.json   – הקלט (kind + נתונים), קריא לאדם
 *   <שם>.golden.json  – התוצאה שאושרה
 * בשינוי מכוון של התנהגות: UPDATE_GOLDEN=1 npm test, ואז בודקים את ה-diff של קבצי golden ב-git.
 */
type Case =
  | { kind: 'household-month'; mode?: 'allow-negative' | 'positive-only'; business: Row[]; household: Row[] }
  | { kind: 'spending'; maxSlices?: number; items: Row[] }
  | { kind: 'by-category'; type: 'income' | 'expense'; items: Row[] }
  | { kind: 'import'; sheets: Sheet[] };

interface Row {
  type: 'income' | 'expense';
  amountAgorot: number;
  businessId?: string;
  categoryId?: string;
  categoryName?: string;
}

function run(c: Case): unknown {
  switch (c.kind) {
    case 'household-month': {
      const fromBusiness = transferFromBusinesses(c.business, c.mode);
      return { businessNet: totalsOf(c.business), household: householdTotals(c.household, fromBusiness) };
    }
    case 'spending':
      return spendingBreakdown(c.items as never, c.maxSlices);
    case 'import': {
      const { parsed, skipped } = parseWorkbook(c.sheets);
      return {
        skipped,
        sheets: parsed.map((p) => ({ sheet: p.sheet.name, layout: p.layout, rows: p.rows.map((r) => ({ ...r, key: undefined })) })),
      };
    }
    case 'by-category':
      return Object.fromEntries(totalsByCategory(c.items as never, c.type));
  }
}

const dir = join(__dirname, 'cases');
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.input.json'))
  .map((f) => f.replace('.input.json', ''))
  .sort();

describe('golden', () => {
  it('יש תרחישים', () => expect(names.length).toBeGreaterThan(0));
  for (const name of names) {
    it(name, () => {
      const input = JSON.parse(readFileSync(join(dir, `${name}.input.json`), 'utf8')) as Case;
      const actual = JSON.stringify(run(input), null, 2) + '\n';
      const goldenPath = join(dir, `${name}.golden.json`);
      if (process.env.UPDATE_GOLDEN === '1' || !existsSync(goldenPath)) {
        writeFileSync(goldenPath, actual);
        return;
      }
      expect(actual).toBe(readFileSync(goldenPath, 'utf8'));
    });
  }
});
