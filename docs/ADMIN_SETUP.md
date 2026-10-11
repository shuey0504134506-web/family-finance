# הפעלת מסך המנהל (פעם אחת)

מסך "ניהול מתקדם" מופיע בהגדרות רק לחשבון `shuey0504134506@gmail.com`. הנתונים שלו מגיעים מפונקציית שרת שצריך לפרסם פעם אחת.
כל העבודה דרך הדפדפן.

## שלב 1: שדרוג התוכנית (אם עוד לא)
בפרויקט Firebase צריכה להיות תוכנית **Blaze** (יש לך כבר).

## שלב 2: מפתח שירות
1. https://console.firebase.google.com ← הפרויקט ← סמל גלגל השיניים ← **Project settings**.
2. לשונית **Service accounts** ← **Generate new private key** ← **Generate key**. יורד קובץ JSON. אסור לשלוח אותו לאף אחד.
3. נכנסים ל-https://console.cloud.google.com/iam-admin/iam (אותו פרויקט). בשורה של `firebase-adminsdk-...` לוחצים על העיפרון ומוסיפים תפקידים:
   **Cloud Functions Admin**, **Service Account User**, **Artifact Registry Writer**, **Cloud Build Editor**. שומרים.
4. מפעילים ממשקים (לוחצים **Enable** בכל אחד): Cloud Functions API, Cloud Build API, Artifact Registry API, Cloud Run Admin API, Eventarc API.
   חיפוש בשורת החיפוש העליונה של Google Cloud.

## שלב 3: סוד ב-GitHub
1. https://github.com/shuey0504134506-web/family-finance/settings/secrets/actions
2. **New repository secret**: שם `FIREBASE_SERVICE_ACCOUNT`, ערך: כל התוכן של קובץ ה-JSON (פותחים אותו בפנקס רשימות, מעתיקים הכול).

## שלב 4: פרסום
1. https://github.com/shuey0504134506-web/family-finance/actions ← **פריסת פונקציות השרת (מסך מנהל)** ← **Run workflow**.
2. מחכים לסימן ירוק (כמה דקות). אם נכשל, שולחים לי את שורת השגיאה האדומה.
3. בטלפון/באתר: הגדרות ← **ניהול מתקדם (מנהל)**.

## מה רואים
מספר חשבונות, כניסות ב-24 שעות / שבוע / חודש, חשבונות חדשים, ולכל חשבון: אימייל, תאריך הרשמה, כניסה אחרונה, כמות פעולות ורמת שימוש.
אין סכומים ואין תוכן פעולות.
