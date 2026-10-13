import { describe, expect, it } from 'vitest';
import { deviceLang } from './lang';

describe('deviceLang', () => {
  it('מכשיר בעברית נשאר בעברית (גם בקוד הישן iw)', () => {
    expect(deviceLang(['he-IL', 'en-US'])).toBe('he');
    expect(deviceLang(['iw'])).toBe('he');
  });

  it('מכשיר בכל שפה אחרת נפתח באנגלית', () => {
    expect(deviceLang(['en-US'])).toBe('en');
    expect(deviceLang(['ru-RU', 'he'])).toBe('en');
  });

  it('בלי מידע על שפה נשארים בעברית', () => {
    expect(deviceLang([])).toBe('he');
  });
});
