# צילום מסכי ההדגמות (עזרה)

ההדגמות במסך "עזרה" מציגות צילומים של המסכים **האמיתיים** של האפליקציה, והחץ ממוקם לפי
מיקום האלמנט האמיתי. הצילומים נוצרים כאן, מאפליקציה שרצה עם Firebase מדומה בזיכרון
ונתוני דוגמה (`entry.tsx`).

כשמשנים מסך או כיתוב שמופיע בהדגמות, מריצים מחדש:

```
export VITE_FIREBASE_API_KEY=x VITE_FIREBASE_AUTH_DOMAIN=x.firebaseapp.com VITE_FIREBASE_PROJECT_ID=x VITE_FIREBASE_APP_ID=1:1:web:1
npx vite build -c tools/helpcap/vite.config.ts --outDir /tmp/cap --emptyOutDir
(cd /tmp/cap && python3 -m http.server 8741 &)
python3 tools/helpcap/capture.py he
python3 tools/helpcap/capture.py en
python3 tools/helpcap/publish.py     # כותב public/help/* ואת src/features/help/scenes.json
```

`scenes.py` מגדיר כל סצנה (איך מגיעים למסך ועל מה החץ מצביע). `sheet.py` יוצר גיליון בדיקה.
