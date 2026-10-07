/** תרגום קודי שגיאה של Firebase להודעות ברורות בעברית. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'כתובת המייל או הסיסמה שגויות.',
  'auth/wrong-password': 'הסיסמה שגויה.',
  'auth/user-not-found': 'לא נמצא חשבון עם כתובת המייל הזאת.',
  'auth/invalid-email': 'כתובת המייל אינה תקינה.',
  'auth/email-already-in-use': 'כבר קיים חשבון עם כתובת המייל הזאת. אפשר להיכנס אליו.',
  'auth/weak-password': 'הסיסמה חלשה מדי. יש לבחור סיסמה של 8 תווים לפחות.',
  'auth/too-many-requests': 'בוצעו יותר מדי ניסיונות. יש להמתין מעט ולנסות שוב.',
  'auth/network-request-failed': 'אין חיבור לאינטרנט. יש לבדוק את החיבור ולנסות שוב.',
  'auth/user-disabled': 'החשבון הזה הושבת.',
  'auth/requires-recent-login': 'לצורך הפעולה הזאת יש להיכנס מחדש לחשבון.',
  'permission-denied': 'אין הרשאה לבצע את הפעולה.',
  unavailable: 'השרת אינו זמין כרגע. הנתונים נשמרים במכשיר ויסונכרנו כשהחיבור יחזור.',
};

export function describeError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return MESSAGES[code] ?? 'אירעה שגיאה לא צפויה. יש לנסות שוב.';
}
