/**
 * חשבון המנהל. זה רק רמז להצגת הלשונית בהגדרות: ההרשאה האמיתית נבדקת בשרת
 * (functions/index.js), ולכן שינוי כאן במכשיר לא נותן גישה לשום נתון.
 */
export const ADMIN_EMAILS: readonly string[] = ['shuey0504134506@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMIN_EMAILS.includes((email as string).toLowerCase());
}
