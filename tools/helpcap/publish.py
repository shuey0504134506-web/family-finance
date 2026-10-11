"""ממיר את הצילומים ל-webp ב-public/help ומייצר src/features/help/scenes.json (שם הקובץ + מיקום היעד)."""
import hashlib, json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
pub = ROOT / 'public/help'
if pub.exists():
    for f in pub.rglob('*.webp'): f.unlink()
result = {}
for lang in ('he', 'en'):
    d = Path('/tmp/capshots') / lang
    m = json.loads((d / 'manifest.json').read_text())
    (pub / lang).mkdir(parents=True, exist_ok=True)
    result[lang] = {}
    for sid, r in m.items():
        png = d / f'{sid}.png'
        h = hashlib.sha1(png.read_bytes()).hexdigest()[:10]
        out = pub / lang / f'{h}.webp'
        if not out.exists():
            Image.open(png).convert('RGB').resize((540, 960), Image.LANCZOS).save(out, 'WEBP', quality=72, method=6)
        result[lang][sid] = dict(img=f'{h}.webp', **{k: round(v, 4) for k, v in r.items()})
(ROOT / 'src/features/help/scenes.json').write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n')
print({l: len(v) for l, v in result.items()}, sum(f.stat().st_size for f in pub.rglob('*.webp')) // 1024, 'KB')
