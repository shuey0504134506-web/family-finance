import { describe, expect, it } from 'vitest';
import { hashSecret, verifySecret } from './appLockStorage';

describe('hashSecret / verifySecret', () => {
  it('מאמת סוד נכון ודוחה שגוי', async () => {
    const stored = await hashSecret('1234');
    expect(await verifySecret('1234', stored)).toBe(true);
    expect(await verifySecret('1235', stored)).toBe(false);
  });
  it('מלח אקראי: אותו סוד נותן גיבובים שונים, ולא נשמר טקסט גלוי', async () => {
    const a = await hashSecret('1234');
    const b = await hashSecret('1234');
    expect(a.hash).not.toBe(b.hash);
    expect(JSON.stringify(a)).not.toContain('1234');
  });
});
