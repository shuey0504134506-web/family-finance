# צילום מסכי ההדגמות של תוכנת המחשב

כמו `tools/helpcap` לאפליקציה, אבל מצלם את תוכנת המחשב האמיתית (בנייה רגילה), בחשבון מנותק עם נתוני דוגמה.

```
cd desktop && npm run build:renderer && (node scripts/serve-test.mjs dist 4180 &)
python3 tools/helpcap-desktop/capture.py        # אפשר גם לציין מזהי סצנות
python3 tools/helpcap-desktop/publish.py        # כותב desktop/src/assets/help ו-desktop/src/ui/helpScenes.json
```
