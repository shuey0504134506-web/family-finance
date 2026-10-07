# מדריך Firebase: מה לעשות עכשיו ומה בהמשך

מדריך זה נועד לעבודה ממחשב כלשהו, דרך הדפדפן בלבד. אין צורך להתקין שום דבר.
הקובץ נמצא גם באינטרנט: https://github.com/shuey0504134506-web/family-finance/blob/main/docs/FIREBASE_SETUP.md

חשבון Google שבו משתמשים: `shuey0504134506@gmail.com`. מומלץ להשתמש באותו חשבון בכל השלבים.

---

## חלק א: הגדרה ראשונה (עושים פעם אחת)

### 0. תנאי מקדים: אימות דו-שלבי של Google

Google דורשת אימות דו-שלבי כדי להיכנס ל-Firebase Console.

1. נכנסים ל-https://myaccount.google.com/security
2. בחלק "How you sign in to Google" לוחצים **2-Step Verification** ומשלימים את ההגדרה.
3. אם מוצעת רק אפשרות "מפתח גישה" (Passkey): לוחצים על "אפשרויות נוספות" או "Try another way" כדי לראות עוד שיטות.
   אם אין, אפשר לאשר דרך הטלפון: סורקים את קוד ה-QR בטלפון המחובר לאותו חשבון ומאשרים בטביעת אצבע או קוד נעילה.
4. מומלץ להוסיף מספר טלפון לקבלת קוד ב-SMS, כדי שלא תינעל מחוץ לחשבון.
5. שומרים את קודי הגיבוי (Backup codes) במקום בטוח (**לא** בתוך הפרויקט).

### 1. יצירת הפרויקט

1. נכנסים ל-https://console.firebase.google.com
2. **Create a project** (או Add project).
3. שם: למשל `family-finance` (השם גם יהפוך לחלק ממזהה הפרויקט).
4. Google Analytics: **לכבות** (אין בו צורך). לוחצים **Create project** ומחכים לסיום, ואז **Continue**.

### 2. הפעלת התחברות (Authentication)

1. תפריט ימני: **Build ← Authentication** ← **Get started**.
2. לשונית **Sign-in method** ← **Email/Password**.
3. מפעילים **Enable** בשורה הראשונה בלבד. את "Email link (passwordless)" משאירים כבוי. **Save**.

### 3. יצירת בסיס הנתונים (Firestore)

1. תפריט ימני: **Build ← Firestore Database** ← **Create database**.
2. Edition: אם נשאלים, בוחרים **Standard**.
3. Database ID: משאירים `(default)`.
4. מיקום: `me-west1` (תל אביב) או `eur3`. **אי אפשר לשנות אחרי היצירה.**
5. מצב: **Start in production mode**. ואז **Create**.

### 4. רישום אפליקציית Web וקבלת הערכים

1. גלגל השיניים ליד "Project Overview" ← **Project settings** ← לשונית **General**.
2. למטה, בחלק **Your apps**, לוחצים על סמל ה-Web (`</>`).
3. שם כינוי: `family-finance-web`. **לא** מסמנים "Firebase Hosting". לוחצים **Register app**.
4. יופיע קוד עם `firebaseConfig`. מעתיקים את הערכים לפי הטבלה:

| בקוד של Firebase | שם הסוד ב-GitHub |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

אפשר לחזור למסך הזה בכל עת: Project settings ← General ← Your apps ← בחירת האפליקציה ← **Config**.

הערה: ערכים אלה אינם סוד במובנה הרגיל. הם נחשפים בכל אתר Firebase, וההגנה האמיתית על הנתונים היא חוקי האבטחה (שלב 5).

### 5. פרסום חוקי האבטחה (חשוב מאוד, לפני כל שימוש אמיתי)

1. פותחים את הקובץ `firestore.rules` ב-GitHub: https://github.com/shuey0504134506-web/family-finance/blob/main/firestore.rules
   (אם הקישור לא נפתח: ה-Repository ← הקובץ `firestore.rules` ← כפתור **Raw** או **Copy raw file**).
2. מעתיקים את **כל** התוכן.
3. ב-Firebase: **Build ← Firestore Database ← Rules**.
4. מוחקים את כל התוכן הקיים, מדביקים, ולוחצים **Publish**.
5. ודאו שמופיעה הודעה על פרסום מוצלח ושעת העדכון מתעדכנת.

בלי השלב הזה Firestore חוסם כל כתיבה וקריאה, והאפליקציה לא תוכל לשמור.

### 6. הוספת הערכים ל-GitHub (Secrets)

1. נכנסים ל-https://github.com/shuey0504134506-web/family-finance
2. **Settings ← Secrets and variables ← Actions ← New repository secret**.
3. יוצרים סוד לכל שורה בטבלה בשלב 4 (שם בדיוק כמו בטבלה, בלי רווחים, הערך בלי מרכאות).
4. אופציונלי: `VITE_PRIVACY_CONTACT_EMAIL` עם כתובת המייל שתוצג במדיניות הפרטיות.

סה"כ 6 סודות חובה ועוד אחד אופציונלי.

### 7. הפעלת GitHub Pages

1. ב-GitHub: **Settings ← Pages**.
2. תחת **Build and deployment**, בשדה **Source** בוחרים **GitHub Actions**.

### 8. אישור הכתובת ב-Firebase

1. Firebase: **Authentication ← Settings ← Authorized domains**.
2. **Add domain** ומוסיפים: `shuey0504134506-web.github.io` (בלי `https://` ובלי סלאש בסוף).

כתובת האתר שלך: `https://shuey0504134506-web.github.io/family-finance/`

> בדקו את השם המדויק בכתובת של GitHub Pages (Settings ← Pages), והוסיפו בדיוק אותו דומיין.

### 9. פרסום האתר

1. ב-GitHub: לשונית **Actions**.
2. בחרו **בדיקות ופריסה ל-GitHub Pages** ← **Run workflow** ← **Run workflow**.
3. מחכים כמה דקות לוי ירוק. אם יש X אדום: נכנסים אליו, מעתיקים את הודעת השגיאה ושולחים לי.

### 10. בדיקת תקינות (רשימת סימון)

פותחים את האתר מהטלפון או מהמחשב ובודקים:

- [ ] האתר נפתח ומוצג מסך הפתיחה (ולא מסך "האפליקציה עדיין לא מוגדרת").
- [ ] הרשמה עם מייל וסיסמה מצליחה ומגיעים למסך הבית.
- [ ] ב-Firebase: **Authentication ← Users** מופיע המשתמש החדש.
- [ ] ב-Firebase: **Firestore Database ← Data** מופיע `users` ובתוכו מסמך עם המזהה של המשתמש, ותתי-אוספים (settings, categories ועוד).
- [ ] יציאה וכניסה מחדש עובדות.
- [ ] "שכחתי סיסמה" שולח מייל (בדקו גם בתיבת הספאם).
- [ ] הפעלת מצב טיסה בטלפון ופתיחה מחדש של האפליקציה: היא עדיין נפתחת (יש מטמון מקומי).

---

## חלק ב: פעולות עתידיות ב-Firebase

### בכל פעם שמשתנה הקובץ `firestore.rules`

אחרי שאני משנה את החוקים בקוד (למשל כשמוסיפים תקציבים ומעשרות), **צריך לפרסם אותם מחדש ידנית**:
Firestore Database ← Rules ← מדביקים את התוכן החדש ← **Publish**.
פרסום האתר ב-GitHub **לא** מעדכן את החוקים. אני אציין לך בכל סבב אם החוקים השתנו.

### פרסום חוקים מחדש אחרי עדכון (חשוב: נדרש עכשיו)

בסבב 4 נוספו חוקי אבטחה לתקציבים. **עד שתפרסם אותם, שמירת תקציב תיכשל** (תופיע הודעה אדומה).

1. פותחים https://raw.githubusercontent.com/shuey0504134506-web/family-finance/main/firestore.rules
2. מסמנים הכול (Ctrl+A) ומעתיקים (Ctrl+C).
3. ב-Firebase: **Firestore Database ← Rules**, מוחקים הכול, מדביקים, ולוחצים **Publish**.

עושים את זה בכל פעם שאני כותב לך שהחוקים השתנו.

### אינדקסים

רוב השאילתות אינן דורשות אינדקס. אם בעתיד אפליקציה תציג שגיאה על חסר אינדקס (או שאבקש), יש שתי דרכים:
1. ב-Console ← **Firestore Database ← Indexes ← Composite ← Add index**, לפי ההוראות שאתן לך.
2. לפעמים השגיאה בדפדפן כוללת קישור: לוחצים עליו ו-Firebase יוצר את האינדקס. יצירה לוקחת כמה דקות.

תוכן האינדקסים המתוכננים נמצא ב-`firestore.indexes.json`.

### תבנית מייל לאיפוס סיסמה בעברית

1. **Authentication ← Templates ← Password reset** ← סמל העיפרון.
2. בשפה (Language) בוחרים **Hebrew** ושומרים.
3. אפשר לערוך את שם השולח והנושא.

### שינוי כתובת האתר או דומיין חדש

אם האתר עובר לכתובת אחרת (דומיין משלך, או Firebase Hosting), מוסיפים אותה ב-
**Authentication ← Settings ← Authorized domains**. בלי זה ההתחברות תיחסם.

### גיבוי ויצוא נתונים

- האפליקציה תכלול בסבב מאוחר יותר יצוא וגיבוי מתוך ההגדרות.
- גיבוי של כל בסיס הנתונים ב-Firebase דורש מעבר לתוכנית Blaze (תשלום לפי שימוש). בשימוש אישי רגיל העלות אפסית, אך נדרש כרטיס אשראי. אין צורך בכך כעת.

### מחיקת חשבון משתמש

מחיקה ידנית מתוך Console (**Authentication ← Users ← ⋮ ← Delete account**) מוחקת רק את ההתחברות, **לא** את הנתונים. את הנתונים צריך למחוק ידנית מ-Firestore (המסמך `users/{uid}` ותתי-האוספים שלו). מחיקת חשבון מתוך האפליקציה תטופל בסבב ההגדרות, וכוללת מחיקת הנתונים וההתחברות יחד.

### מעקב צריכה ועלויות

- **Firestore Database ← Usage**: קריאות, כתיבות ואחסון. בתוכנית החינמית (Spark) יש מכסה יומית, ושימוש אישי רחוק ממנה.
- אם תרצו התראה בתקציב, יש לעבור ל-Blaze ולהגדיר **Budgets & alerts** ב-Google Cloud. לא נדרש כעת.

### אבטחה: מה כדאי לבדוק מדי פעם

- **Authentication ← Users**: ודאו שאין משתמשים שאינכם מכירים.
- **Firestore ← Rules**: ודאו שאין כלל כמו `allow read, write: if true`.
  אם כתוב כך, זה פתוח לכולם. החליפו בחוקים מהקובץ `firestore.rules`.
- אל תשתפו סיסמאות או קודי גיבוי של Google בצ'אט או בקוד.
- מומלץ להפעיל **App Check** בעתיד (לא נדרש כעת). אציין זאת כשנגיע לשלב האריזה כאפליקציית Android.

### בדיקת חוקי האבטחה (למפתחים)

הפקודה `npm run test:rules` בודקת שמשתמש אחד לא רואה נתונים של אחר. היא דורשת Java והורדה של אמולטור, ולכן לא ניתן להריץ אותה בסביבה שלי עד כה. עד שהיא תורץ, החוקים **לא נבדקו אוטומטית**. מומלץ לבדוק ידנית: הרשמה עם שני משתמשים שונים וידוא שכל אחד רואה רק את שלו, וכן להשתמש ב-**Rules Playground** (Firestore ← Rules ← Rules playground).

### אריזה עתידית כאפליקציית Android

כשנגיע לשלב זה יידרש ב-Firebase:
1. **Project settings ← Your apps ← Add app ← Android**, עם שם חבילה (Package name) שנקבע יחד.
2. הוספת טביעת SHA-1 של מפתח החתימה.
3. הוספת הדומיינים המתאימים של Capacitor ל-Authorized domains (`localhost`).
אתן הוראות מדויקות כשנגיע לשם.

---

## פתרון בעיות נפוצות

| תסמין | סיבה אפשרית ופתרון |
| --- | --- |
| מסך "האפליקציה עדיין לא מוגדרת" | חסר סוד ב-GitHub, או שהוא נכתב בשם שגוי. בדקו שמות והרצו שוב את ה-workflow. |
| ה-workflow נכשל בשלב "בדיקה שפרטי Firebase הוגדרו" | לא הוגדרו הסודות `VITE_FIREBASE_API_KEY` או `VITE_FIREBASE_PROJECT_ID`. |
| הרשמה נכשלת עם הודעה על הרשאות (permission-denied) | חוקי האבטחה לא פורסמו, או פורסמה גרסה ישנה. חזרו לשלב 5. |
| "auth/unauthorized-domain" | הדומיין לא נוסף ל-Authorized domains. חזרו לשלב 8. |
| דף לבן באתר | בדקו שב-Pages נבחר Source: GitHub Actions, והריצו את ה-workflow מחדש. |
| מייל איפוס סיסמה לא הגיע | בדקו ספאם, וודאו ש-Email/Password מופעל. |
| נפתחת שאלה על חיוב (Blaze) | לא צריך לשדרג. נשארים ב-Spark. |

אם משהו לא עובד: צלמו מסך של הודעת השגיאה (או העתיקו אותה) ושלחו לי.
