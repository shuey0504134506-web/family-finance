"""
מצלם את מסכי ההדגמה מתוכנת המחשב האמיתית (בנייה רגילה של desktop), בחשבון מנותק עם נתוני דוגמה.
שימוש: node desktop/scripts/serve-test.mjs desktop/dist 4180 &  ואז  python3 tools/helpcap-desktop/capture.py
פלט: /tmp/capdesk/<id>.png + manifest.json
"""
import datetime, glob, json, random, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from scenes import S

URL = 'http://127.0.0.1:4180/'
W, H = 1280, 800
PW = 'סיסמה-ארוכה-1'
out = Path('/tmp/capdesk'); out.mkdir(parents=True, exist_ok=True)
only = set(sys.argv[1:])

def demo_csv() -> Path:
    random.seed(7)
    today = datetime.date.today()
    exp = [('שופרסל', 'מזון', 85), ('רמי לוי', 'מזון', 412), ('חברת חשמל', 'חשבונות', 480), ('פז', 'רכב', 240), ('בית ספר', 'חינוך', 900),
           ('מרפאה', 'בריאות', 150), ('ארנונה', 'חשבונות', 1600), ('גן ילדים', 'ילדים', 1903), ('שכר דירה', 'דיור', 5000), ('קפה', 'בילויים', 64)]
    rows = ['תאריך,תיאור,חובה,זכות,קטגוריה']
    for back in range(0, 6):
        first = (today.replace(day=1) - datetime.timedelta(days=30 * back)).replace(day=1)
        for i, (n, c, a) in enumerate(exp):
            d = first + datetime.timedelta(days=min(i * 2 + 1, 26))
            if d > today: continue
            rows.append(f'{d.strftime("%d/%m/%Y")},{n},{a + back * 13},,{c}')
        d = first + datetime.timedelta(days=1)
        if d <= today: rows.append(f'{d.strftime("%d/%m/%Y")},משכורת,,{12000 - back * 150},משכורת')
    p = Path('/tmp/capdesk/demo.csv'); p.write_text('\n'.join(rows), encoding='utf-8-sig'); return p

def loc(pg, spec):
    nth = 0
    m = re.match(r'^(.*)@(\d+)$', spec)
    if m: spec, nth = m.group(1), int(m.group(2))
    kind, _, val = spec.partition(':')
    if kind == 'C': l = pg.locator(val)
    elif kind == 'B': l = pg.get_by_role('button', name=val, exact=True)
    elif kind == 'R': l = pg.get_by_role('radio', name=val, exact=True)
    elif kind == 'A': l = pg.get_by_role('link', name=val, exact=True)
    elif kind == 'L': l = pg.get_by_label(val, exact=True)
    elif kind == 'H': l = pg.get_by_role('heading', name=val, exact=True)
    elif kind == 'T': l = pg.get_by_text(val, exact=True)
    else: raise ValueError(spec)
    return l.nth(nth) if nth else l.first

manifest = json.loads((out / 'manifest.json').read_text()) if only and (out / 'manifest.json').exists() else {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome')[0], args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, locale='he-IL')
    pg = ctx.new_page(); pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.goto(URL); pg.wait_for_selector('text=ברוכים הבאים')
    pg.click('text=יצירת חשבון מנותק (ללא סנכרון)')
    pg.get_by_label('שם פרטי').fill('דנה'); pg.get_by_label('שם משפחה').fill('כהן')
    pg.get_by_label('סיסמה', exact=True).fill(PW); pg.get_by_label('אימות סיסמה').fill(PW)
    pg.click('button:has-text("המשך לשאלות שחזור")')
    for i, a in enumerate(['פיצה', 'רקס', 'חיפה']): pg.locator('.recovery-slot').nth(i).get_by_label('התשובה').fill(a)
    pg.click('button:has-text("יצירת החשבון")'); pg.wait_for_selector('.desktop-shell', timeout=15000)
    pg.click('.side-link:has-text("ייבוא")'); pg.locator('input[type=file]').set_input_files(str(demo_csv())); pg.wait_for_timeout(2500)
    pg.click('button:has-text("סימון הכול")'); pg.click('button:has-text("ייבוא ")'); pg.wait_for_timeout(3000)
    pg.evaluate("location.hash='#/household'"); pg.wait_for_timeout(1500)
    for sc in S:
        try:
            for act in sc['do']:
                k = act[0]
                if k == 'goto': pg.evaluate(f"location.hash='{act[1]}'"); pg.wait_for_timeout(900)
                elif k == 'click': loc(pg, act[1]).click(timeout=4000); pg.wait_for_timeout(450)
                elif k == 'fill': loc(pg, act[1]).fill(act[2], timeout=4000)
                elif k == 'check': loc(pg, act[1]).check()
                elif k == 'wait': pg.wait_for_timeout(act[1])
            if not sc['shot'] or (only and sc['id'] not in only): continue
            t = loc(pg, sc['target'])
            pg.wait_for_timeout(1700)  # אחרי אנימציות הכניסה
            bb = t.bounding_box()
            if bb is None or bb['y'] < 0 or bb['y'] + bb['height'] > H:
                t.evaluate("e => e.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(500); bb = t.bounding_box()
            pg.screenshot(path=str(out / f"{sc['id']}.png"))
            manifest[sc['id']] = dict(x=bb['x'] / W, y=bb['y'] / H, w=bb['width'] / W, h=bb['height'] / H)
        except Exception as e:  # noqa
            print('FAIL', sc['id'], str(e).splitlines()[0][:150])
    b.close()
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
print('done', len(manifest), 'of', len([s for s in S if s['shot']]))
