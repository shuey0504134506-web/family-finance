import { describe, expect, it, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isLockSuppressed, isExternalLink, resetLockSuppress } from './lockSuppress';

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}

describe('שכבת ההגנה מנעילה בפעולות חיצוניות', () => {
  beforeEach(() => resetLockSuppress());

  it('זיהוי קישורים חיצוניים', () => {
    const link = (href: string, target = '') => ({ getAttribute: () => href, target });
    for (const h of ['tel:123', 'mailto:a@b.c', 'sms:1', 'whatsapp://x']) expect(isExternalLink(link(h))).toBe(true);
    expect(isExternalLink(link('https://x.com'), 'https://me.app')).toBe(true);
    expect(isExternalLink(link('https://me.app/a'), 'https://me.app')).toBe(false);
    expect(isExternalLink(link('#/budget'))).toBe(false);
    expect(isExternalLink(link('#/x', '_blank'))).toBe(true);
  });

  it('כל שדה קובץ באפליקציה נקרא רק ממקום שהנעילה מושתקת בו (הגנה מרכזית מותקנת)', () => {
    resetLockSuppress();
    expect(isLockSuppressed()).toBe(false);
    for (const f of walk('src').filter((x) => /type="file"/.test(readFileSync(x, 'utf8')))) {
      expect(readFileSync('src/main.tsx', 'utf8'), f).toContain('installLockGuards()');
    }
  });

  it('כל מסך שיש בו שדה קובץ מוסתר או קישור tel/mailto מכוסה: ההגנה המרכזית מותקנת בכל נקודות הכניסה', () => {
    for (const entry of ['src/main.tsx', 'desktop/src/main.tsx', 'desktop/src/main.phone.tsx']) {
      expect(readFileSync(entry, 'utf8'), entry).toContain('installLockGuards()');
    }
  });

  it('פעולות חיצוניות שאינן לחיצה (מצלמה, שיתוף, התקנה) מופעלות רק מקבצים שקוראים ל-suppressLock', () => {
    const risky = /(Camera\.getPhoto|Share\.share|Filesystem\.|AppUpdater\.(download|install)|shell\.openPath|desktopUpdate\??\.install)/;
    const offenders = walk('src').concat(walk('desktop/src')).filter((f) => risky.test(readFileSync(f, 'utf8')) && !/suppressLock|lockSuppress/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
