import { describe, expect, it } from 'vitest';
import { MAX_LOGO_CHARS, isLogoData } from './logo';

describe('isLogoData', () => {
  it('מקבל תמונת data URL תקינה', () => {
    expect(isLogoData('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isLogoData('data:image/webp;base64,AAAA')).toBe(true);
  });
  it('דוחה סוגים אחרים, טקסט רגיל וגדלים חורגים', () => {
    expect(isLogoData('data:text/html;base64,AAAA')).toBe(false);
    expect(isLogoData('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isLogoData('https://example.com/a.png')).toBe(false);
    expect(isLogoData(5)).toBe(false);
    expect(isLogoData(`data:image/png;base64,${'A'.repeat(MAX_LOGO_CHARS)}`)).toBe(false);
  });
});
