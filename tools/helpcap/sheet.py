"""גיליון בדיקה: כל הצילומים עם מסגרת אדומה סביב היעד. python3 sheet.py <lang> [התחלה] [כמות]"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
lang = sys.argv[1]; start = int(sys.argv[2]) if len(sys.argv) > 2 else 0; n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
d = Path('/tmp/capshots') / lang
m = json.loads((d / 'manifest.json').read_text())
ids = list(m)[start:start + n]
tiles = []
for i in ids:
    im = Image.open(d / f'{i}.png').convert('RGB'); W, H = im.size
    r = m[i]; dr = ImageDraw.Draw(im)
    dr.rectangle([r['x'] * W, r['y'] * H, (r['x'] + r['w']) * W, (r['y'] + r['h']) * H], outline='red', width=5)
    dr.text((10, 10), i, fill='blue')
    tiles.append(im.resize((W // 2, H // 2)))
w, h = tiles[0].size
sheet = Image.new('RGB', (w * 4, h * ((len(tiles) + 3) // 4)), 'white')
for k, t in enumerate(tiles): sheet.paste(t, ((k % 4) * w, (k // 4) * h))
sheet.save(f'/tmp/capshots/sheet-{lang}.png')
