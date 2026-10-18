"""
מצלם את צילומי המסך של דף הנחיתה, בחשבון מנותק עם נתוני דוגמה.
טלפון:  node desktop/scripts/serve-test.mjs desktop/dist-phone 4181 &   (VITE_TARGET=phone בבנייה)
מחשב:   node desktop/scripts/serve-test.mjs desktop/dist 4180 &
שימוש:  python3 tools/landing-shots/capture.py
פלט: public/landing/phone/*.webp ו-public/landing/desktop/*.webp
"""
import datetime, glob, random
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PW = 'סיסמה-ארוכה-1'
SHOTS = [('home', '#/household'), ('expenses', '#/household/list/expense'), ('budget', '#/household/budget'), ('summary', '#/summary'), ('tithes', '#/tithes')]

def demo_csv(path: Path) -> Path:
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
    path.write_text('\n'.join(rows), encoding='utf-8-sig'); return path

def run(kind: str, url: str, viewport: dict, scale: int):
    out = ROOT / 'public' / 'landing' / kind; out.mkdir(parents=True, exist_ok=True)
    tmp = Path('/tmp/landing-shots'); tmp.mkdir(exist_ok=True)
    csv = demo_csv(tmp / 'demo.csv')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome')[0], args=['--no-sandbox'])
        ctx = b.new_context(viewport=viewport, device_scale_factor=scale, locale='he-IL', has_touch=(kind == 'phone'), is_mobile=(kind == 'phone'))
        pg = ctx.new_page(); pg.set_default_timeout(8000)
        pg.goto(url); pg.wait_for_selector('text=ברוכים הבאים')
        pg.click('text=יצירת חשבון לא מקוון' if kind == 'phone' else 'text=יצירת חשבון מנותק (ללא סנכרון)')
        pg.get_by_label('שם פרטי').fill('דנה'); pg.get_by_label('שם משפחה').fill('כהן')
        pg.get_by_label('סיסמה', exact=True).fill(PW); pg.get_by_label('אימות סיסמה').fill(PW)
        pg.click('button:has-text("המשך לשאלות שחזור")')
        for i, a in enumerate(['פיצה', 'רקס', 'חיפה']): pg.locator('.recovery-slot').nth(i).get_by_label('התשובה').fill(a)
        pg.click('button:has-text("יצירת החשבון")'); pg.wait_for_selector('.desktop-shell, .app-shell', timeout=15000)
        pg.evaluate("location.hash='#/household/import'"); pg.wait_for_timeout(1200)
        pg.locator('input[type=file]').set_input_files(str(csv)); pg.wait_for_timeout(2500)
        pg.click('button:has-text("סימון הכול")'); pg.click('button:has-text("ייבוא ")'); pg.wait_for_timeout(3000)
        for name, h in SHOTS:
            pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(2200)
            png = tmp / f'{kind}-{name}.png'; pg.screenshot(path=str(png))
            Image.open(png).convert('RGB').save(out / f'{name}.webp', quality=80)
        b.close()

if __name__ == '__main__':
    run('phone', 'http://127.0.0.1:4181/', {'width': 390, 'height': 844}, 2)
    run('desktop', 'http://127.0.0.1:4180/', {'width': 1280, 'height': 800}, 1)
