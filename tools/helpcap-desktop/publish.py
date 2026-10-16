"""ממיר את הצילומים ל-webp ב-desktop/src/assets/help ומייצר desktop/src/ui/helpScenes.json."""
import hashlib, json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
d = Path('/tmp/capdesk'); pub = ROOT / 'desktop/src/assets/help'
pub.mkdir(parents=True, exist_ok=True)
for f in pub.glob('*.webp'): f.unlink()
m = json.loads((d / 'manifest.json').read_text()); res = {}
for sid, r in m.items():
    png = d / f'{sid}.png'
    h = hashlib.sha1(png.read_bytes()).hexdigest()[:10]
    Image.open(png).convert('RGB').save(pub / f'{h}.webp', 'WEBP', quality=70, method=6)
    res[sid] = dict(img=f'{h}.webp', **{k: round(v, 4) for k, v in r.items()})
(ROOT / 'desktop/src/ui/helpScenes.json').write_text(json.dumps(res, ensure_ascii=False, indent=1) + '\n')
print(len(res), sum(f.stat().st_size for f in pub.glob('*.webp')) // 1024, 'KB')
