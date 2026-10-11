/**
 * תמונות מצורפות לפעולה (קבלה, תלוש). עד שלוש לפעולה, כל אחת מוקטנת ל-JPEG קטן ונשמרת
 * כמחרוזת data URL במסמך נפרד (users/{uid}/attachments/{מזהה הפעולה}), כדי שרשימות הפעולות יישארו קלות.
 */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_DIM = 1400;
/** מגבלת אורך לתמונה. שלוש תמונות נשארות מתחת ל-1MB של מסמך. */
export const MAX_ATTACHMENT_CHARS = 280_000;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export const isAttachmentImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_ATTACHMENT_CHARS && DATA_URL.test(value);

/** מנקה רשימה שנקראה מהשרת: רק תמונות תקינות, ולא יותר מהמותר. */
export const cleanAttachments = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isAttachmentImage).slice(0, MAX_ATTACHMENTS) : [];
