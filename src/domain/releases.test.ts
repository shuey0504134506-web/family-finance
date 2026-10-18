import { describe, expect, it } from 'vitest';
import { pickInstaller } from './releases';

const list = [
  { tag_name: 'android-v1.2', assets: [{ name: 'family-finance-1.2.apk', browser_download_url: 'u-apk' }] },
  { tag_name: 'desktop-v1.0.9', draft: true, assets: [{ name: 'a.exe', browser_download_url: 'u-draft' }] },
  { tag_name: 'desktop-v1.0.8', assets: [{ name: 'finance-desktop-1.0.8-x64.exe', browser_download_url: 'u-exe' }] },
];

describe('pickInstaller', () => {
  it('בוחר את הקובץ הנכון לפי הסוג ומדלג על טיוטות', () => {
    expect(pickInstaller(list, 'windows')).toBe('u-exe');
    expect(pickInstaller(list, 'android')).toBe('u-apk');
  });
  it('בלי קובץ מתאים מחזיר null', () => {
    expect(pickInstaller([], 'android')).toBeNull();
  });
});
