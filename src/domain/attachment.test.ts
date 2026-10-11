import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_CHARS, cleanAttachments, isAttachmentImage } from './attachment';

describe('תמונות מצורפות', () => {
  it('מקבל רק data URL של תמונה בגודל מותר', () => {
    expect(isAttachmentImage('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isAttachmentImage('data:application/pdf;base64,AAAA')).toBe(false);
    expect(isAttachmentImage(`data:image/jpeg;base64,${'A'.repeat(MAX_ATTACHMENT_CHARS)}`)).toBe(false);
  });
  it('מנקה רשימה לא תקינה ומגביל את הכמות', () => {
    expect(cleanAttachments('x')).toEqual([]);
    const good = 'data:image/jpeg;base64,AAAA';
    expect(cleanAttachments([good, 5, good, good, good])).toHaveLength(MAX_ATTACHMENTS);
  });
});
