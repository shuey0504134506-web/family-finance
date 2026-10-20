import { describe, expect, it } from 'vitest';
import { pickInstaller } from './releases';

const list = [
  { tag_name: 'android-v1.0.15', assets: [{ name: 'family-finance-1.0.15.apk', browser_download_url: 'u-apk15' }] },
  { tag_name: 'desktop-v1.0.9', assets: [{ name: 'finance-desktop-1.0.9-x64.exe', browser_download_url: 'u-exe9' }] },
  { tag_name: 'desktop-v1.0.13', assets: [{ name: 'finance-desktop-1.0.13-x64.exe', browser_download_url: 'u-exe13' }] },
  { tag_name: 'desktop-v1.0.14', draft: true, assets: [{ name: 'a.exe', browser_download_url: 'u-draft' }] },
  { tag_name: 'android-v1.0.13', assets: [{ name: 'family-finance-1.0.13.apk', browser_download_url: 'u-apk13' }] },
];

describe('pickInstaller', () => {
  it('בוחר את הגרסה הגבוהה ביותר, לא את הראשונה ברשימה, ומדלג על טיוטות', () => {
    expect(pickInstaller(list, 'windows')).toBe('u-exe13');
    expect(pickInstaller(list, 'android')).toBe('u-apk15');
  });
  it('1.0.13 גבוהה מ-1.0.9', () => {
    expect(pickInstaller(list.slice(1, 3), 'windows')).toBe('u-exe13');
  });
  it('בלי קובץ מתאים מחזיר null', () => {
    expect(pickInstaller([], 'android')).toBeNull();
  });
});

import { isNewerVersion, latestRelease } from './releases';

describe('עדכון מתוך האפליקציה', () => {
  it('latestRelease מחזיר גם את מספר הגרסה', () => {
    expect(latestRelease(list, 'windows')).toEqual({ version: '1.0.13', url: 'u-exe13' });
  });
  it('isNewerVersion משווה מספרית, לא לפי טקסט', () => {
    expect(isNewerVersion('1.0.20', '1.0.19')).toBe(true);
    expect(isNewerVersion('1.0.19', '1.0.19')).toBe(false);
    expect(isNewerVersion('1.0.9', '1.0.13')).toBe(false);
    expect(isNewerVersion('1.0.19', '0.1.0')).toBe(true);
    expect(isNewerVersion('abc', '1.0.1')).toBe(false);
  });
});
