# סקריפט שיצר את תמונות ההרים ב-src/assets (לשימוש חוזר אם רוצים לשנות גוונים). דורש numpy, pillow, scipy.
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, gaussian_filter1d, map_coordinates

rng = np.random.default_rng(7)
W, H = 780, 1688
HZ = int(H * 0.585)
SUNX = 0.63 * W

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def mix(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]

def fbm1d(n, octaves, pers, seed, base_freq=3):
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, n)
    out = np.zeros(n); amp = 1; tot = 0
    for o in range(octaves):
        f = base_freq * 2 ** o
        pts = r.random(f + 2)
        xs = np.linspace(0, 1, f + 2)
        v = np.interp(x, xs, pts)
        # smooth interpolation
        out += amp * v; tot += amp; amp *= pers
    return out / tot

def noise2d(shape, sig, seed):
    r = np.random.default_rng(seed)
    n = gaussian_filter(r.standard_normal(shape), sig, mode='wrap')
    n = (n - n.mean()) / (n.std() + 1e-9)
    return n

def fbm2d(shape, sigs, seed, aniso=(1, 1)):
    out = np.zeros(shape); w = 1; tot = 0
    for i, s in enumerate(sigs):
        out += w * noise2d(shape, (s * aniso[0], s * aniso[1]), seed + i)
        tot += w; w *= 0.55
    return out / tot

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# ---------- sky ----------
t = np.clip(yy / HZ, 0, 1.4)
stops = [(0.0, (176, 192, 222)), (0.35, (206, 204, 222)), (0.65, (240, 208, 200)), (0.88, (252, 216, 172)), (1.0, (255, 232, 190))]
sky = np.zeros((H, W, 3), np.float32)
for c in range(3):
    sky[..., c] = np.interp(t, [s[0] for s in stops], [s[1][c] for s in stops])
# sun glow
d = np.sqrt(((xx - SUNX) / 1.15) ** 2 + (yy - (HZ - 70)) ** 2)
glow = np.exp(-(d / 260) ** 2)[..., None]
sky = sky + glow * np.array([70, 55, 30])[None, None, :] * 1.0
core = np.exp(-(d / 70) ** 2)[..., None]
sky = sky + core * np.array([40, 40, 40])
# clouds
cn = fbm2d((H, W), [60, 28, 12], 40, aniso=(0.22, 1.0))
cloud = smooth(0.15, 0.95, cn) * smooth(40, 220, yy) * (1 - smooth(HZ * 0.55, HZ * 0.85, yy))
ccol = mix(np.full((H, W, 3), (150, 150, 185), np.float32), np.full((H, W, 3), (255, 205, 170), np.float32), smooth(HZ * 0.15, HZ * 0.7, yy) * 0.9 + glow[..., 0] * 0.3)
img = mix(sky, ccol, cloud * 0.62)
HAZE = np.array([252, 222, 192], np.float32)

# ---------- mountain layers ----------
def ridge(seed, base, amp, sharp):
    n = fbm1d(W, 7, 0.52, seed, base_freq=2)
    n2 = fbm1d(W, 6, 0.55, seed + 100, base_freq=3)
    rd = 1 - np.abs(2 * n2 - 1)
    prof = (1 - sharp) * n + sharp * (0.30 * n + 0.70 * rd ** 1.5)
    prof = (prof - prof.min()) / (prof.max() - prof.min())
    return base - amp * prof

def ridged2d(seed):
    out = np.zeros((H, W), np.float32); w = 1.0; tot = 0
    for i, s_ in enumerate([46, 24, 13, 7, 3.5]):
        n = noise2d((H, W), (s_ * 1.9, s_ * 0.8), seed + i * 7)
        r = (1 - np.abs(n) / 2.2).clip(0, 1) ** 2
        out += w * r; tot += w; w *= 0.52
    return out / tot

layers = [
    dict(seed=11, base=HZ - 175, amp=340, sharp=0.95, lit=(238, 226, 236), dark=(150, 154, 200), haze=0.55, snow=0.64, fall=34),
    dict(seed=23, base=HZ - 115, amp=310, sharp=0.9, lit=(220, 198, 208), dark=(96, 108, 160), haze=0.36, snow=0.72, fall=40),
    dict(seed=37, base=HZ - 62, amp=270, sharp=0.8, lit=(176, 150, 158), dark=(58, 76, 116), haze=0.20, snow=0.0, fall=46),
    dict(seed=51, base=HZ - 10, amp=190, sharp=0.65, lit=(96, 108, 110), dark=(22, 38, 54), haze=0.07, snow=0.0, fall=50),
]
HAZEARR = np.broadcast_to(HAZE, (H, W, 3)).copy()
for li, L in enumerate(layers):
    ry = gaussian_filter1d(ridge(L['seed'], L['base'], L['amp'], L['sharp']), 0.9)
    below = yy - ry[None, :]
    mask_soft = smooth(-1.1, 1.1, below)
    mask_soft = np.where(yy <= HZ + 4, mask_soft, 0)
    alt = np.clip(L['base'] + 40 - yy, 0, None)
    Zn = ridged2d(L['seed'] * 3 + 5)
    Z = Zn * 70.0 + alt * 0.65
    gx = np.gradient(gaussian_filter(Z, 0.8), axis=1)
    g = 1.7 / (np.std(gx[(yy < HZ) & (mask_soft > 0.5)]) + 1e-6)
    shade = 0.5 + 0.5 * np.tanh(-gx * g)
    # silhouette-edge lighting plus a gentle vertical falloff into the mist
    depth = np.clip(below / 300.0, 0, 1)
    shade = np.clip(shade * (1 - 0.35 * depth) + 0.10 * glow[..., 0], 0, 1)
    col = mix(np.full((H, W, 3), L['dark'], np.float32), np.full((H, W, 3), L['lit'], np.float32), shade)
    # fine rock grain
    fine = noise2d((H, W), (1.2, 0.9), L['seed'] + 900)
    col = col * (1 + 0.07 * fine[..., None])
    rim = np.exp(-(np.clip(below, 0, None) / 3.0) ** 2) * 0.6 * (0.5 + glow[..., 0])
    col = col + rim[..., None] * np.array([84, 56, 26])
    if L['snow'] > 0:
        thr = L['amp'] * L['snow']
        nz = (Zn - Zn.mean()) / (Zn.std() + 1e-6)
        sn = smooth(thr - 26, thr + 22, alt + nz * 26) * smooth(0.0, 1.0, 0.9 - np.clip(np.abs(gx) * g * 0.28, 0, 1.0) + 0.35)
        sn = np.clip(sn, 0, 1)
        sl = np.array([255, 243, 232], np.float32); sd = np.array([170, 184, 228], np.float32)
        scol = mix(np.broadcast_to(sd, (H, W, 3)).copy(), np.broadcast_to(sl, (H, W, 3)).copy(), np.clip(shade * 1.15, 0, 1))
        col = mix(col, scol, sn * 0.93)
    # aerial perspective: haze grows toward the base of each layer (mist pooling in the valleys)
    hz_a = np.clip(L['haze'] + 0.6 * smooth(0.0, 1.0, (yy - (HZ - 200)) / 200.0) * (0.9 if li < 3 else 0.35), 0, 0.9)
    col = mix(col, HAZEARR, hz_a)
    img = mix(img, col, mask_soft)
    band = np.exp(-((yy - (L['base'] + 60)) / 80.0) ** 2) * 0.18
    img = mix(img, HAZEARR, band * (yy < HZ + 2))

# ---------- pines on the near shore ----------
S = 2
def pine_layer(items):
    tree = Image.new('RGBA', (W * S, (HZ + 40) * S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(tree)
    for cx, base, h, col in items:
        w = h * 0.24
        tiers = 9
        pts_l, pts_r = [(cx, base - h)], [(cx, base - h)]
        r_ = np.random.default_rng(int(cx * 7) % 1000)
        for k in range(1, tiers + 1):
            tt = k / tiers
            yk = base - h + h * tt * 0.97
            wk = w * (0.10 + 0.90 * tt)
            jag = r_.uniform(0.75, 1.15)
            pts_l += [(cx - wk * jag, yk), (cx - wk * 0.45, yk - h * 0.02)]
            pts_r += [(cx + wk * jag * r_.uniform(0.8, 1.1), yk), (cx + wk * 0.45, yk - h * 0.02)]
        poly = pts_l + pts_r[::-1]
        dr.polygon([(x * S, y * S) for x, y in poly], fill=col)
        dr.rectangle([(cx - 2) * S, (base - 6) * S, (cx + 2) * S, (base + 8) * S], fill=col)
    return tree
pr = np.random.default_rng(5)
far, near = [], []
for cx in list(pr.uniform(-10, 300, 16)) + list(pr.uniform(500, 800, 14)):
    h = pr.uniform(40, 90)
    far.append((cx, HZ + 2 + pr.uniform(-2, 3), h, (58, 80, 92, 235)))
for cx in list(pr.uniform(-20, 200, 9)) + list(pr.uniform(580, 810, 8)):
    h = pr.uniform(95, 175)
    near.append((cx, HZ + 6 + pr.uniform(-3, 10), h, (14, 30, 40, 255)))
for items in (far, near):
    tl = pine_layer(items).resize((W, HZ + 40), Image.LANCZOS)
    ta = np.array(tl).astype(np.float32)
    a_ = ta[..., 3:4] / 255.0
    # rim light on the sun side of the trees
    img[:HZ + 40] = img[:HZ + 40] * (1 - a_) + ta[..., :3] * a_

# ---------- lake ----------
upper = img.copy()
out = img.copy()
ys = np.arange(HZ, H)
dist = (ys - HZ).astype(np.float32)
src = np.clip(2 * HZ - ys, 0, HZ).astype(np.float32)
# per-row horizontal ripple displacement
rr = np.random.default_rng(3)
disp_noise = gaussian_filter1d(rr.standard_normal(len(ys)), 2.5)
disp = (np.sin(dist * 0.16) * 2.0 + disp_noise * 4.0) * (0.25 + dist / 240.0)
disp = np.clip(disp, -26, 26)
refl = np.zeros((len(ys), W, 3), np.float32)
xs = np.arange(W, dtype=np.float32)
for c in range(3):
    coords = np.vstack([np.repeat(src[:, None], W, 1).ravel(), (xs[None, :] + disp[:, None]).ravel()])
    refl[..., c] = map_coordinates(upper[..., c], coords, order=1, mode='nearest').reshape(len(ys), W)
# blur grows with depth (only horizontal blur + slight vertical)
bl1 = np.stack([gaussian_filter(refl[..., c], (1.5, 5)) for c in range(3)], -1)
bl2 = np.stack([gaussian_filter(refl[..., c], (3.5, 14)) for c in range(3)], -1)
w1 = smooth(0, 200, dist)[:, None, None]; w2 = smooth(160, 600, dist)[:, None, None]
refl = refl * (1 - w1) + bl1 * w1
refl = refl * (1 - w2) + bl2 * w2
# water tint and deepening
water_near = np.array([76, 118, 134], np.float32)
water_deep = np.array([12, 38, 58], np.float32)
dp = smooth(0, 700, dist)[:, None, None]
tint = water_near * (1 - dp) + water_deep * dp
fres = (0.62 - 0.40 * smooth(0, 520, dist))[:, None, None]  # reflection strength
lake = refl * fres * 0.92 + tint * (1 - fres)
# ripple highlights
rip = gaussian_filter(rr.standard_normal((len(ys), W)), (0.7, 22))
rip = (rip - rip.mean()) / rip.std()
rip = np.clip(rip, 0, 3) / 3.0
lake += (rip[..., None] * np.array([46, 40, 30]) * (0.25 + 0.5 * np.exp(-(dist / 330)))[:, None, None])
# sun glitter column
colw = (70 + dist * 0.28)
gl = np.exp(-((xx[HZ:] - SUNX) / colw[:, None]) ** 2) * (0.5 + 0.5 * gaussian_filter(rr.standard_normal((len(ys), W)), (0.5, 9)))
gl = np.clip(gl, 0, 1) * np.exp(-dist / 520.0)[:, None]
lake += gl[..., None] * np.array([120, 92, 52])
# soft shoreline mist
mist = np.exp(-(dist / 14.0) ** 2)[:, None, None] * 0.55
lake = lake * (1 - mist) + HAZE * mist
out[HZ:] = lake

# ---------- finishing ----------
# vignette + bottom darkening for legible buttons
v = 1 - 0.22 * (((xx - W / 2) / (W / 2)) ** 2)[..., None]
out = out * v
bd = smooth(H * 0.70, H, yy)[..., None] * 0.30
out = out * (1 - bd) + np.array([8, 28, 44]) * bd
# grain
out += rng.standard_normal((H, W, 1)) * 2.4
out = np.clip(out, 0, 255)
# gentle S-curve
o = out / 255.0
o = o * o * (3 - 2 * o) * 0.28 + o * 0.72
res = Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8))
d = './'
res.save(d + 'welcome.jpg', quality=88, optimize=True, progressive=True)
res.crop((0, HZ - 540, W, HZ + 60)).save(d + 'home.jpg', quality=88, optimize=True, progressive=True)
print('ok')
