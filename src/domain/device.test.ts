import { describe, expect, it } from 'vitest';
import { detectDevice, installerFor, isMobileKind } from './device';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

describe('detectDevice', () => {
  it('מזהה אייפון, מק, אנדרואיד וחלונות', () => {
    expect(detectDevice({ userAgent: IPHONE })).toBe('ios');
    expect(detectDevice({ userAgent: MAC, maxTouchPoints: 0 })).toBe('mac');
    expect(detectDevice({ userAgent: ANDROID })).toBe('android');
    expect(detectDevice({ userAgent: WIN })).toBe('windows');
    expect(detectDevice({ userAgent: 'X11; Linux x86_64' })).toBe('other');
  });
  it('אייפד שמציג את עצמו כמק נחשב אייפון/אייפד', () => {
    expect(detectDevice({ userAgent: MAC, maxTouchPoints: 5 })).toBe('ios');
  });
  it('קבצי התקנה רק לחלונות ולאנדרואיד', () => {
    expect(installerFor('windows')).toBe('windows');
    expect(installerFor('android')).toBe('android');
    expect(installerFor('ios')).toBeNull();
    expect(installerFor('mac')).toBeNull();
    expect(isMobileKind('ios')).toBe(true);
    expect(isMobileKind('windows')).toBe(false);
  });
});
