"""
מצלם את מסכי ההדגמה מהאפליקציה האמיתית (בנייה עם Firebase מדומה).
שימוש: python3 tools/helpcap/capture.py <he|en> [מזהי סצנות...]
פלט: /tmp/capshots/<lang>/<id>.png + manifest.json (מיקום האלמנט המסומן, ביחס למסך).
"""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from scenes import S

ROOT = Path(__file__).resolve().parents[2]
URL = 'http://localhost:8741/tools/helpcap/index.html'
W, H = 360, 640
lang = sys.argv[1]
only = set(sys.argv[2:])
out = Path('/tmp/capshots') / lang
out.mkdir(parents=True, exist_ok=True)

EN = {}
for line in (ROOT / 'src/i18n/en.ts').read_text(encoding='utf-8').splitlines():
    m = re.match(r'\s*("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*"),?\s*$', line)
    if m:
        EN[json.loads(m.group(1))] = json.loads(m.group(2))
tr = (lambda s: EN.get(s, s)) if lang == 'en' else (lambda s: s)

def loc(pg, spec):
    nth = 0
    m = re.match(r'^(.*)@(\d+)$', spec)
    if m: spec, nth = m.group(1), int(m.group(2))
    kind, _, val = spec.partition(':')
    if kind == 'C':
        l = pg.locator(val)
    elif kind == 'B': l = pg.get_by_role('button', name=tr(val), exact=True)
    elif kind == 'R': l = pg.get_by_role('radio', name=tr(val), exact=True)
    elif kind == 'A': l = pg.get_by_role('link', name=tr(val), exact=True)
    elif kind == 'L': l = pg.get_by_label(tr(val), exact=True)
    elif kind == 'H': l = pg.get_by_role('heading', name=tr(val), exact=True)
    elif kind == 'T': l = pg.get_by_text(tr(val), exact=True)
    else: raise ValueError(spec)
    return l.nth(nth) if nth else l.first

def val(v):
    return (v[2] if lang == 'en' else v[1]) if isinstance(v, tuple) else v

def fresh(pg):
    pg.goto(URL)
    pg.wait_for_selector('.scope-tab', timeout=15000)

manifest = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, locale='en-US' if lang == 'en' else 'he-IL')
    if lang == 'en':
        ctx.add_init_script("localStorage.setItem('ff.lang.v1','en')")
    pg = ctx.new_page()
    pg.set_default_timeout(5000)
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    fresh(pg)
    for sc in S:
        if sc.get('fresh'): fresh(pg)
        try:
            for act in sc['do']:
                k = act[0]
                if k == 'goto':
                    pg.evaluate(f"location.hash='{act[1]}'"); pg.wait_for_timeout(500)
                elif k == 'click':
                    loc(pg, act[1]).click(timeout=4000); pg.wait_for_timeout(350)
                elif k == 'fill':
                    loc(pg, act[1]).fill(val(act[2]), timeout=4000)
                elif k == 'select':
                    loc(pg, act[1]).select_option(act[2])
                elif k == 'check':
                    loc(pg, act[1]).check()
                elif k == 'wait':
                    pg.wait_for_timeout(act[1])
            if not sc['shot']: continue
            if only and sc['id'] not in only: continue
            t = loc(pg, sc['target'])
            pg.evaluate('window.scrollTo(0, 0)')
            bb = t.bounding_box()
            if bb['y'] < 70 or bb['y'] + bb['height'] > H - 120:
                t.evaluate("e => e.scrollIntoView({ block: 'center' })")
            pg.wait_for_timeout(450)
            bb = t.bounding_box()
            pg.screenshot(path=str(out / f"{sc['id']}.png"))
            manifest[sc['id']] = dict(x=bb['x'] / W, y=bb['y'] / H, w=bb['width'] / W, h=bb['height'] / H)
        except Exception as e:  # noqa
            print('FAIL', sc['id'], str(e).splitlines()[0][:150])
    b.close()
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
print('done', len(manifest))
