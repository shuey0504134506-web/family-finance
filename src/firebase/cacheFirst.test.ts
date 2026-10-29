import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('פתיחה מהירה בלי אינטרנט', () => {
  it('כל האזנה לנתונים עוברת דרך onSnapshot שמציג קודם את המטמון (cacheFirst)', () => {
    const dir = 'src/services';
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .filter((f) => {
        const s = readFileSync(join(dir, f), 'utf8');
        const m = /import \{([^}]*)\} from 'firebase\/firestore';/.exec(s);
        return !!m && /\bonSnapshot\b/.test(m[1]!);
      });
    expect(offenders).toEqual([]);
  });
});
