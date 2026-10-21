#!/usr/bin/env python3
"""
מדריך התקנה (PDF) לטלפון בלי דפדפן: האפליקציה עוברת בבלוטוס מטלפון שיש בו דפדפן.
כל עמוד מציג את שני הטלפונים (סמסונג עם דפדפן, שיאומי בלי) עם מסגרת וחץ על מה שלוחצים.
צילומי מסך של האפליקציה עצמה (דף הנחיתה, רישום, כניסה) אמיתיים; מסכי המערכת מאוירים.

שימוש: python3 build.py <תיקיית צילומים> <קובץ יציאה .pdf> [גרסת APK]
צילומים נדרשים בתיקייה: landing.png signup.png signup_filled.png login_filled.png icon.png home.webp
"""
import base64
import sys
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
VER = sys.argv[3] if len(sys.argv) > 3 else '1.0.20'
APK = f'family-finance-{VER}.apk'
LINK = 'https://family-finance-b29f5.web.app/#/start'


def b64(name):
    p = SRC / name
    mime = 'image/webp' if name.endswith('webp') else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()


IMG = {k: b64(k) for k in ['landing.png', 'signup.png', 'signup_filled.png', 'login_filled.png', 'icon.png', 'home.webp']}
W, H = 236, 500  # גודל מסך מצויר

# ---------------------------------------------------------------- אלמנטים בסיסיים


def hl(x, y, w, h, r=10):
    return f'<div class="hl" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px"></div>'


def arrow(x1, y1, x2, y2):
    """חץ אדום מנקודה לנקודה (קואורדינטות מסך)."""
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    hx1 = x2 - 13 * math.cos(ang - 0.45)
    hy1 = y2 - 13 * math.sin(ang - 0.45)
    hx2 = x2 - 13 * math.cos(ang + 0.45)
    hy2 = y2 - 13 * math.sin(ang + 0.45)
    return (
        f'<svg class="arrow" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#d62828" stroke-width="5" stroke-linecap="round"/>'
        f'<polygon points="{x2},{y2} {hx1:.1f},{hy1:.1f} {hx2:.1f},{hy2:.1f}" fill="#d62828" stroke="#d62828" stroke-width="3" stroke-linejoin="round"/>'
        '</svg>'
    )


def status(kind, dark=False):
    cls = 'dark' if dark else ''
    if kind == 'sam':
        return (f'<div class="status {cls}"><span>9:41</span><i class="hole"></i><span class="si">▂▄▆ ▮</span></div>')
    return (f'<div class="status {cls} mi"><span>9:41</span><i class="hole mih"></i><span class="si">5G ▂▄▆ ▮</span></div>')


def navbar(kind):
    return '<div class="nav"><i></i></div>'


def phone(kind, content, title, sub='', dim=False):
    name = 'סמסונג' if kind == 'sam' else 'שיאומי'
    return (
        f'<figure class="ph {kind} {"dimmed" if dim else ""}">'
        f'<div class="body"><div class="scr">{content}</div></div>'
        f'<figcaption><b>{title}</b><span>{sub}</span></figcaption>'
        '</figure>'
    )


# ---------------------------------------------------------------- מסכים

APPS = {
    'sam': ['טלפון', 'הודעות', 'מצלמה', 'גלריה', 'הקבצים שלי', 'הגדרות', 'Chrome', 'שעון', 'יומן', 'מחשבון', 'Play Store', 'מפות'],
    'mi': ['טלפון', 'הודעות', 'מצלמה', 'גלריה', 'מנהל קבצים', 'הגדרות', 'שעון', 'מחשבון', 'יומן', 'מפות', 'מוסיקה', 'ערכות נושא'],
}
COLORS = ['#3b82f6', '#22c55e', '#64748b', '#f59e0b', '#14b8a6', '#6366f1', '#ef4444', '#0ea5e9', '#a855f7', '#84cc16', '#f97316', '#10b981']


def app_pos(i):
    col, row = i % 4, i // 4
    cw = W / 4
    return W - (col + 1) * cw + (cw - 44) / 2, 52 + row * 76


def launcher(kind, mark=None, extra=''):
    apps = APPS[kind]
    out = [status(kind, dark=True), f'<div class="wall {kind}"></div>']
    for i, name in enumerate(apps):
        x, y = app_pos(i)
        rad = '14px' if kind == 'sam' else '12px'
        out.append(
            f'<div class="app" style="left:{x - 6:.0f}px;top:{y}px"><i style="background:{COLORS[i]};border-radius:{rad}"></i><span>{name}</span></div>'
        )
    out.append(f'<div class="dock {kind}"></div>')
    if mark is not None:
        x, y = app_pos(apps.index(mark))
        out.append(hl(x - 5, y - 5, 54, 74, 14))
        out.append(arrow(x + 60 if x < 120 else x - 18, y + 112, x + 22, y + 68) if False else '')
    out.append(extra)
    out.append(navbar(kind))
    return ''.join(out)


def launcher_arrow_target(kind, name):
    apps = APPS[kind]
    x, y = app_pos(apps.index(name))
    return x + 22, y + 66


def image_page(img, top, height, overlays='', chrome=False, kind='sam'):
    chrome_bar = ''
    if chrome:
        chrome_bar = (
            '<div class="chrome"><span class="lock">🔒</span><span class="url">family-finance-b29f5.web.app</span><span class="dots">⋮</span></div>'
        )
    return (
        f'{status(kind)}{chrome_bar}'
        f'<div class="shot" style="top:{top}px;height:{height}px"><img src="{IMG[img]}" alt=""></div>'
        f'{overlays}{navbar(kind)}'
    )


def home_idle(kind):
    return launcher(kind)


def browser_landing(mark_button=None, kind='sam'):
    # תמונה ברוחב 236 => גובה 460; מוצגת מתחת לשורת הכתובת (גובה 58)
    top, ov = 58, ''
    if mark_button == 'download':
        y = top + 1236 / 1520 * 460
        ov = hl(8, y - 2, 220, 32, 16) + arrow(118, 497, 118, 468)
    return image_page('landing.png', top, 460, ov, chrome=True, kind=kind)


def dlg(top, title, body, cancel, ok, head=''):
    return (
        f'<div class="dim"></div><div class="dialog" style="top:{top}px">{head or f"<b>{title}</b>"}'
        f'<p>{body}</p><div class="btns"><span class="b">{cancel}</span><span class="b ok mk">{ok}</span></div></div>'
    )


def chrome_warning(kind='sam'):
    return browser_landing(None, kind) + dlg(150, 'הקובץ הזה עלול להזיק למכשיר', f'סוג הקובץ (APK) עלול לפגוע במכשיר. להוריד את <span class="ltr">{APK}</span>?', 'ביטול', 'שמירה')


def chrome_done(kind='sam'):
    base = browser_landing(None, kind)
    bar = (
        '<div class="snack"><span>ההורדה הסתיימה</span><b>פתיחה</b></div>'
    )
    return base + bar


def files_list(kind, folder='הורדות', mark=False, selected=False, share=False):
    title = {'sam': 'הקבצים שלי', 'mi': 'מנהל קבצים'}[kind]
    rows = [
        ('📷', 'IMG_20261018.jpg', '3.2 MB'),
        ('📄', 'חשבונית.pdf', '210 KB'),
        ('🤖', APK, '8.4 MB'),
        ('🎵', 'שיר.mp3', '4.9 MB'),
    ]
    out = [status(kind), f'<div class="fhead"><b>{title}</b><span>{folder}</span></div>']
    y0 = 78
    for i, (ic, name, size) in enumerate(rows):
        y = y0 + i * 52
        is_apk = name == APK
        sel = selected and is_apk
        out.append(
            f'<div class="frow {"sel" if sel else ""}" style="top:{y}px"><span class="fic">{"✔" if sel else ic}</span>'
            f'<span class="ft"><b class="ltr">{name}</b><em>{size}</em></span></div>'
        )
        if is_apk and mark:
            out.append(hl(4, y - 2, W - 8, 48, 12))
            out.append(arrow(W - 30, y - 46, W - 40, y - 4))
    if share:
        out.append(
            '<div class="abar"><span>שיתוף</span><span>העברה</span><span>מחיקה</span></div>'
        )
        out.append(hl(8, H - 74, 66, 44, 12))
        out.append(arrow(40, H - 140, 40, H - 80))
    out.append(navbar(kind))
    return ''.join(out)


def share_sheet(kind, mark=True):
    base = files_list(kind, selected=True)
    opts = ['Quick Share', 'Bluetooth', 'WhatsApp', 'Gmail', 'Drive', 'עוד']
    cells = ''.join(
        f'<div class="so"><i style="background:{COLORS[(i * 3) % 12]}"></i><span>{o}</span></div>' for i, o in enumerate(opts)
    )
    sheet = f'<div class="dim"></div><div class="sheet"><b>שיתוף באמצעות</b><div class="sgrid">{cells}</div></div>'
    out = base + sheet
    if mark:
        # אפשרות Bluetooth: עמודה שנייה מהימין? בגריד RTL: הסדר מימין לשמאל
        out += hl(85, 372, 66, 66, 12) + arrow(118, 312, 118, 366)
    return out


def bt_picker(kind='sam'):
    devs = [('🎧', 'אוזניות'), ('📱', 'Xiaomi של שוע (מצומד)'), ('🚗', 'רכב')]
    rows = ''.join(f'<div class="drow"><span>{ic}</span><b>{n}</b></div>' for ic, n in devs)
    out = (
        status(kind)
        + '<div class="fhead"><b>בחירת מכשיר בלוטוס</b><span>הקשה על שם הטלפון השני</span></div>'
        + f'<div class="dlist">{rows}</div>'
        + navbar(kind)
    )
    out += hl(6, 150, W - 12, 50, 12) + arrow(W - 50, 262, W - 60, 206)
    return out


def quick_settings(kind='mi', mark=True):
    tiles = [('Wi‑Fi', '#3b82f6', True), ('בלוטוס', '#2563eb', False), ('נתונים', '#22c55e', True), ('פנס', '#64748b', False),
             ('מצב טיסה', '#64748b', False), ('סיבוב', '#64748b', False), ('אל תפריע', '#64748b', False), ('מיקום', '#22c55e', True)]
    cells = ''
    for i, (n, c, on) in enumerate(tiles):
        col, row = i % 4, i // 4
        x = W - (col + 1) * 56 - 4
        y = 54 + row * 76
        cells += f'<div class="qt" style="left:{x}px;top:{y}px"><i style="background:{c if on else "#d5dbe3"}"></i><span>{n}</span></div>'
    out = status(kind, dark=True) + '<div class="qs">' + cells + '<div class="bright"><i></i></div></div>' + navbar(kind)
    if mark:
        col, row = 1, 0
        x = W - (col + 1) * 56 - 4
        y = 54
        out += hl(x - 3, y - 3, 56, 66, 14) + arrow(x + 28, y + 140, x + 28, y + 70)
    return out


def incoming(kind='mi'):
    return launcher(kind) + dlg(140, 'קובץ נכנס בבלוטוס', f'המכשיר ששלח רוצה לשלוח לך את <span class="ltr">{APK}</span> (8.4 MB). לקבל?', 'דחייה', 'קבלה')


def sending(kind='sam'):
    base = files_list(kind, selected=True)
    return base + '<div class="dim"></div><div class="dialog" style="top:170px"><b>שולח בבלוטוס…</b><p>' + APK + '</p><div class="prog"><i style="width:62%"></i></div></div>'


def bt_received(kind='mi'):
    # רשימת קבצים בתיקיית בלוטוס
    return files_list(kind, folder='Bluetooth', mark=True)


def unknown_source(kind):
    return files_list(kind, mark=False) + dlg(130, 'התקנה חסומה מטעמי אבטחה', 'הטלפון לא מרשה להתקין אפליקציות ממקור זה. אפשר לאשר זאת בהגדרות.', 'ביטול', 'הגדרות')


def allow_toggle(kind):
    label = 'אפשרו מהמקור הזה' if kind == 'sam' else 'אפשר התקנה ממקור זה'
    owner = 'הקבצים שלי' if kind == 'sam' else 'מנהל קבצים'
    out = (
        status(kind)
        + f'<div class="fhead"><b>התקנת אפליקציות לא ידועות</b><span>{owner}</span></div>'
        + f'<div class="trow"><span>{label}</span><div class="tg"><i></i></div></div>'
        + '<p class="tnote">אפשר לכבות את זה שוב אחרי ההתקנה.</p>'
        + navbar(kind)
    )
    out += hl(8, 100, W - 16, 56, 14) + arrow(40, 210, 40, 160)
    return out


def install_dialog(kind):
    head = f'<div class="row"><img src="{IMG["icon.png"]}" alt=""><b>ניהול כספים</b></div>'
    return launcher(kind) + dlg(120, '', 'להתקין את האפליקציה הזו? היא תקבל גישה לאינטרנט.', 'ביטול', 'התקנה', head)


def installed_dialog(kind):
    head = f'<div class="row"><img src="{IMG["icon.png"]}" alt=""><b>האפליקציה הותקנה</b></div>'
    return launcher(kind) + dlg(120, '', 'ניהול כספים מוכנה לשימוש.', 'סיום', 'פתיחה', head)


def app_screen(img, kind, marks='', top=24, height=460):
    return image_page(img, top, height, marks, chrome=False, kind=kind)


def px(v):
    return v / 1520 * 460


def signup_marks(filled):
    # שדות: אימייל, סיסמה, אימות, כפתור יצירת חשבון (קואורדינטות מתוך צילום 780x1520)
    t = 24
    out = ''
    if not filled:
        # מסמנים את כל הטופס שממלאים
        out += hl(48, t + px(190), 140, px(1100), 12)
        out += arrow(210, t + px(480), 190, t + px(480))
    else:
        out += hl(54, t + px(1322) - 2, 128, px(62) + 4, 16) + arrow(118, t + px(1322) - 50, 118, t + px(1322) - 6)
    return out


def login_marks():
    t = 24
    return hl(14, t + px(878) - 2, 208, px(96) + 4, 18) + arrow(118, t + px(878) - 58, 118, t + px(878) - 6)


def landing_open():
    return browser_landing(None)


def phone_home_app(kind):
    return image_page('home.webp', 24, 460, '', chrome=False, kind=kind)


# ---------------------------------------------------------------- שלבים
A_BROWSER = 'הטלפון עם הדפדפן'
B_SHUA = 'הטלפון שלך (שיאומי)'

pages = []  # (שלב, כותרת, הסבר, phoneA, phoneB, הערה)


def add(num, title, text, a, b, note='', a_dim=False, b_dim=False, a_cap=('', ''), b_cap=('', '')):
    pages.append(dict(num=num, title=title, text=text, a=a, b=b, note=note, a_dim=a_dim, b_dim=b_dim, a_cap=a_cap, b_cap=b_cap))


files_a = launcher('sam')
files_b = launcher('mi')

add('1', 'פותחים את הקישור בטלפון שיש בו דפדפן',
    f'בטלפון שיש בו דפדפן (Chrome או אחר) פותחים את הקישור:<br><span class="link">{LINK}</span><br>נפתח דף הבית של האפליקציה.',
    browser_landing(), launcher('mi'),
    note='הטלפון השני (שלך) רק מחכה. אין צורך לעשות בו כלום עדיין.', b_dim=True,
    a_cap=(A_BROWSER, 'סמסונג'), b_cap=(B_SHUA, 'ממתין'))

add('2א', 'לוחצים על הכפתור התחתון: "הורדת האפליקציה (APK)"',
    'בתחתית הדף לוחצים על הכפתור <b>הורדת האפליקציה (APK)</b>, בתוך המסגרת האדומה.',
    browser_landing('download'), launcher('mi'),
    note='זה קובץ ההתקנה של האפליקציה. הוא מגיע לטלפון הזה, ומשם נעביר אותו לשני.', b_dim=True,
    a_cap=(A_BROWSER, 'לוחצים כאן'), b_cap=(B_SHUA, 'ממתין'))

add('2ב', 'אם מופיעה אזהרה, מאשרים את ההורדה',
    'הדפדפן עלול להזהיר שקובץ מסוג APK יכול להזיק. הקובץ שלנו, ולכן לוחצים <b>שמירה</b> (או "הורדה בכל זאת").',
    chrome_warning(), launcher('mi'),
    note='ההודעה נראית מעט שונה בכל דפדפן. הכוונה היא תמיד להמשיך ולהוריד.', b_dim=True,
    a_cap=(A_BROWSER, 'לוחצים על שמירה'), b_cap=(B_SHUA, 'ממתין'))

add('3א', 'פותחים את אפליקציית "הקבצים" (מסמכים)',
    'בטלפון עם הדפדפן יוצאים למסך הראשי ופותחים את <b>הקבצים שלי</b> (בחלק מהטלפונים: "מסמכים" או "קבצים").',
    launcher('sam', mark='הקבצים שלי') + arrow(*(lambda t: (t[0], t[1] + 70, t[0], t[1] + 14))(launcher_arrow_target('sam', 'הקבצים שלי'))),
    launcher('mi'),
    note='שני הטלפונים מכילים אפליקציה כזו. כאן מחפשים בטלפון הראשון.', b_dim=True,
    a_cap=(A_BROWSER, 'אפליקציית הקבצים'), b_cap=(B_SHUA, 'ממתין'))

add('3ב', 'בוחרים את הקובץ שהורדנו',
    f'נכנסים לתיקייה <b>הורדות</b> ולוחצים לחיצה ארוכה על הקובץ <span class="ltr">{APK}</span> עד שמופיע עליו וי.',
    files_list('sam', mark=True), launcher('mi'),
    note='המספר בשם הקובץ יכול להיות שונה. זו הגרסה העדכנית.', b_dim=True,
    a_cap=(A_BROWSER, 'לחיצה ארוכה על הקובץ'), b_cap=(B_SHUA, 'ממתין'))

add('4', 'לוחצים על "שיתוף" ובוחרים בלוטוס',
    'כשהקובץ מסומן, בתחתית המסך לוחצים על <b>שיתוף</b>.',
    files_list('sam', selected=True, share=True), launcher('mi'),
    note='בשלב הבא נבחר "Bluetooth" מרשימת האפשרויות.', b_dim=True,
    a_cap=(A_BROWSER, 'כפתור שיתוף'), b_cap=(B_SHUA, 'ממתין'))

add('4ב', 'בוחרים "Bluetooth" ברשימת השיתוף',
    'נפתחת רשימה של דרכי שיתוף. לוחצים על <b>Bluetooth</b> (אם לא רואים אותו, גוללים או לוחצים "עוד").',
    share_sheet('sam'), launcher('mi'),
    note='אם הבלוטוס כבוי, הטלפון ישאל אם להדליק אותו. מאשרים.', b_dim=True,
    a_cap=(A_BROWSER, 'בוחרים Bluetooth'), b_cap=(B_SHUA, 'ממתין'))

add('5', 'מדליקים בלוטוס בטלפון השני (שיאומי)',
    'בטלפון שלך מחליקים עם האצבע מהקצה העליון כלפי מטה, ולוחצים על הסמל <b>בלוטוס</b> כדי שיידלק (יהפוך לכחול).',
    launcher('sam'), quick_settings('mi'),
    note='בשיאומי חדש (HyperOS) מחליקים מהצד הימני של הקצה העליון. בגרסאות ישנות מחליקים מכל מקום בקצה העליון.',
    a_dim=True, a_cap=(A_BROWSER, 'ממתין'), b_cap=(B_SHUA, 'מדליקים בלוטוס'))

add('6א', 'חוזרים לטלפון הראשון ובוחרים את הטלפון השני',
    'ברשימת המכשירים לוחצים על שם הטלפון שלך (<b>Xiaomi</b>). אם הוא לא מופיע, בוחרים "סריקה" ומחכים רגע.',
    bt_picker('sam'), launcher('mi'),
    note='בפעם הראשונה צריך לצמד את שני הטלפונים. מאשרים את הקוד שמופיע בשניהם.', b_dim=True,
    a_cap=(A_BROWSER, 'בוחרים את השיאומי'), b_cap=(B_SHUA, 'ממתין'))

add('6ב', 'מאשרים קבלת הקובץ בטלפון השני',
    'בטלפון שלך (שיאומי) קופצת הודעה שקובץ נשלח אליך. לוחצים <b>קבלה</b>.',
    sending('sam'), incoming('mi'),
    note='ההעברה לוקחת כחצי דקה. מחכים עד שהיא נגמרת בשני הטלפונים.',
    a_cap=(A_BROWSER, 'שולח…'), b_cap=(B_SHUA, 'לוחצים על קבלה'))

add('7', 'פותחים את הקבצים בשני הטלפונים ולוחצים על האפליקציה',
    f'בשני הטלפונים פותחים את אפליקציית הקבצים ולוחצים על <span class="ltr">{APK}</span>. בטלפון השני הוא נמצא בתיקייה <b>Bluetooth</b> (או "הורדות").',
    files_list('sam', mark=True), bt_received('mi'),
    note='שני הטלפונים מבצעים את אותה פעולה.',
    a_cap=(A_BROWSER, 'הורדות'), b_cap=(B_SHUA, 'תיקיית Bluetooth'))

add('8א', 'אם הטלפון חוסם את ההתקנה, לוחצים "הגדרות"',
    'בפעם הראשונה הטלפון עשוי להודיע שהתקנה ממקור זה חסומה. לוחצים <b>הגדרות</b>.',
    unknown_source('sam'), unknown_source('mi'),
    note='אם ההודעה הזו לא מופיעה, מדלגים לשלב 8ג.',
    a_cap=(A_BROWSER, 'לוחצים על הגדרות'), b_cap=(B_SHUA, 'לוחצים על הגדרות'))

add('8ב', 'מאשרים התקנה מהאפליקציה הזו',
    'מדליקים את המתג <b>אפשר התקנה ממקור זה</b> וחוזרים אחורה (חץ אחורה בתחתית המסך).',
    allow_toggle('sam'), allow_toggle('mi'),
    note='זה נדרש פעם אחת בלבד, כי האפליקציה לא מגיעה מחנות האפליקציות.',
    a_cap=(A_BROWSER, 'מדליקים את המתג'), b_cap=(B_SHUA, 'מדליקים את המתג'))

add('8ג', 'מאשרים את ההתקנה',
    'בחלון שמופיע לוחצים <b>התקנה</b>.',
    install_dialog('sam'), install_dialog('mi'),
    note='אם מופיעה הודעה של Play Protect (בדיקת אבטחה), בוחרים "התקנה בכל זאת".',
    a_cap=(A_BROWSER, 'לוחצים על התקנה'), b_cap=(B_SHUA, 'לוחצים על התקנה'))

add('8ד', 'ההתקנה הסתיימה: פותחים',
    'כשההתקנה נגמרת לוחצים <b>פתיחה</b>. בהמשך האפליקציה תופיע גם במסך הראשי של כל טלפון.',
    installed_dialog('sam'), installed_dialog('mi'),
    note='', a_cap=(A_BROWSER, 'לוחצים על פתיחה'), b_cap=(B_SHUA, 'לוחצים על פתיחה'))

add('9א', 'יוצרים חשבון בטלפון אחד: ממלאים את הפרטים',
    'בטלפון שלך (שיאומי) לוחצים על <b>כניסה או יצירת חשבון</b> ואז <b>יצירת חשבון</b>, וממלאים שם פרטי, שם משפחה, טלפון, כתובת מייל וסיסמה (פעמיים).',
    phone_home_app('sam'), app_screen('signup.png', 'mi', signup_marks(False)),
    note='את הסיסמה כדאי לרשום במקום בטוח. לפחות 10 תווים.',
    a_dim=True, a_cap=(A_BROWSER, 'ממתין'), b_cap=(B_SHUA, 'ממלאים את הטופס'))

add('9ב', 'לוחצים על "יצירת חשבון"',
    'אחרי מילוי כל השדות, לוחצים על הכפתור הכחול <b>יצירת חשבון</b> בתחתית הטופס.',
    phone_home_app('sam'), app_screen('signup_filled.png', 'mi', signup_marks(True)),
    note='אחרי הלחיצה נכנסים ישר לאפליקציה.',
    a_dim=True, a_cap=(A_BROWSER, 'ממתין'), b_cap=(B_SHUA, 'לוחצים על יצירת חשבון'))

add('10', 'נכנסים לחשבון קיים בטלפון השני: מייל וסיסמה',
    'בטלפון השני (עם הדפדפן) פותחים את האפליקציה, לוחצים <b>כניסה או יצירת חשבון</b>, מזינים את אותו מייל ואותה סיסמה ולוחצים <b>כניסה</b>.',
    app_screen('login_filled.png', 'sam', login_marks()), phone_home_app('mi'),
    note='כך שני הטלפונים רואים את אותם נתונים בדיוק.',
    a_cap=(A_BROWSER, 'כניסה עם מייל וסיסמה'), b_cap=(B_SHUA, 'כבר מחובר'))

# ---------------------------------------------------------------- HTML

CSS = """
@page { size: 150mm 218mm; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body { font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif; direction: rtl; color: #14304f; background: #f6f1e6 }
.page { width: 150mm; height: 218mm; padding: 9mm 8mm 7mm; page-break-after: always; position: relative; overflow: hidden;
  background: linear-gradient(180deg, #fbf8f0, #efe9db) }
.page:last-child { page-break-after: auto }
.top { display: flex; align-items: center; gap: 10px; margin-bottom: 4mm }
.num { flex: 0 0 auto; min-width: 46px; height: 46px; border-radius: 23px; padding: 0 12px; background: #14304f; color: #fff; font-weight: 800; font-size: 22px; display: grid; place-items: center }
.top h1 { margin: 0; font-size: 22px; line-height: 1.25 }
.txt { font-size: 16px; line-height: 1.6; margin: 0 0 4mm; color: #1b2b3c }
.link, .ltr { direction: ltr; unicode-bidi: embed; display: inline-block; color: #1f6f66; font-weight: 700 }
.link { font-size: 13px; word-break: break-all }
.phones { display: flex; gap: 6mm; justify-content: center; align-items: flex-start; direction: rtl }
.note { margin: 4mm 0 0; padding: 10px 14px; background: #e6efed; border-radius: 14px; font-size: 14px; line-height: 1.5; color: #1b3a38 }
.foot { position: absolute; bottom: 4mm; left: 0; right: 0; text-align: center; font-size: 10px; color: #7a8794 }
/* טלפון */
.ph { margin: 0; width: 244px; display: flex; flex-direction: column; align-items: center }
.ph .body { width: 244px; height: 508px; padding: 4px; background: #0e1419; border-radius: 30px; box-shadow: 0 10px 22px rgba(15,42,71,.22) }
.ph.mi .body { border-radius: 24px; background: #1a1f26; padding: 4px 4px }
.scr { position: relative; width: 236px; height: 500px; background: #fff; border-radius: 26px; overflow: hidden; font-size: 11px; direction: rtl; color: #14212e }
.ph.mi .scr { border-radius: 20px }
.ph.dimmed .body { opacity: .55; filter: saturate(.5) }
.ph figcaption { margin-top: 7px; text-align: center; display: flex; flex-direction: column; gap: 1px; direction: rtl }
.ph figcaption b { font-size: 13px; color: #14304f }
.ph figcaption span { font-size: 12px; color: #5d6b78 }
.status { position: absolute; left: 0; right: 0; top: 0; height: 22px; padding: 5px 14px 0; display: flex; justify-content: space-between; direction: ltr; font-size: 10px; font-weight: 700; z-index: 5; color: #14212e; background: transparent }
.status.dark { color: #fff }
.hole { position: absolute; left: 50%; top: 6px; width: 9px; height: 9px; margin-left: -4px; border-radius: 50%; background: #05080b }
.hole.mih { width: 7px; height: 7px; margin-left: -3px; top: 7px }
.nav { position: absolute; bottom: 0; left: 0; right: 0; height: 18px; display: grid; place-items: center; z-index: 5 }
.nav i { width: 70px; height: 4px; border-radius: 2px; background: rgba(20,33,46,.55) }
.wall { position: absolute; inset: 0; background: linear-gradient(160deg, #6fa0cf, #c9b4cf 55%, #f0cfa8) }
.wall.mi { background: linear-gradient(170deg, #1d3a5c, #5b4b8a 55%, #e79a6b) }
.app { position: absolute; width: 56px; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #fff; font-size: 9px; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.55) }
.app i { display: block; width: 44px; height: 44px }
.dock { position: absolute; left: 10px; right: 10px; bottom: 26px; height: 56px; border-radius: 22px; background: rgba(255,255,255,.28) }
.chrome { position: absolute; top: 22px; left: 8px; right: 8px; height: 30px; border-radius: 15px; background: #ece6d6; display: flex; align-items: center; gap: 6px; padding: 0 10px; direction: ltr; z-index: 4; font-size: 10px; color: #4a5865 }
.chrome .url { flex: 1; overflow: hidden; white-space: nowrap }
.chrome .dots { font-weight: 800; font-size: 14px }
.shot { position: absolute; left: 0; right: 0; overflow: hidden }
.shot img { width: 236px; display: block }
.snack { position: absolute; left: 10px; right: 10px; bottom: 30px; background: #2b3844; color: #fff; border-radius: 12px; padding: 11px 14px; display: flex; justify-content: space-between; z-index: 6 }
.hl { position: absolute; border: 4px solid #d62828; z-index: 9; box-shadow: 0 0 0 3px rgba(255,255,255,.8); pointer-events: none }
.arrow { position: absolute; left: 0; top: 0; z-index: 10; pointer-events: none; filter: drop-shadow(0 0 2px #fff) }
.dim { position: absolute; inset: 0; background: rgba(0,0,0,.45); z-index: 6 }
.dialog { position: absolute; left: 14px; right: 14px; background: #fff; border-radius: 20px; padding: 14px; z-index: 7; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.35); direction: rtl }
.dialog b { font-size: 13px } .dialog p { margin: 0; font-size: 11px; line-height: 1.45; color: #3b4a58 }
.dialog .row { display: flex; gap: 10px; align-items: center } .dialog img { width: 36px; height: 36px; border-radius: 10px }
.dialog .btns { display: flex; justify-content: flex-end; gap: 10px; direction: ltr; margin-top: 4px }
.dialog .b { text-align: center; min-width: 64px; position: relative }
.mk { outline: 4px solid #d62828; outline-offset: 3px; z-index: 9 }
.mk::after { content: ''; position: absolute; left: 50%; top: calc(100% + 18px); width: 6px; height: 34px; margin-left: -3px; background: #d62828; border-radius: 3px }
.mk::before { content: ''; position: absolute; left: 50%; top: calc(100% + 6px); margin-left: -11px; border-left: 11px solid transparent; border-right: 11px solid transparent; border-bottom: 18px solid #d62828 }
.dialog .b { padding: 7px 16px; border-radius: 999px; font-weight: 700; font-size: 11px; color: #1f6f66 }
.dialog .b.ok { background: #1f6f66; color: #fff }
.dialog .ltr { font-size: 10px }
.prog { height: 8px; border-radius: 4px; background: #e2e8ee; overflow: hidden } .prog i { display: block; height: 100%; background: #1f6f66 }
.fhead { position: absolute; top: 28px; left: 0; right: 0; padding: 8px 14px; display: flex; flex-direction: column; gap: 2px; background: #fff; border-bottom: 1px solid #e4e8ec }
.fhead b { font-size: 15px } .fhead span { font-size: 10px; color: #6b7886 }
.frow { position: absolute; left: 8px; right: 8px; height: 44px; display: flex; align-items: center; gap: 10px; border-radius: 10px; padding: 0 10px }
.frow.sel { background: #dff0ee }
.frow .fic { width: 30px; height: 30px; border-radius: 8px; background: #eef2f5; display: grid; place-items: center; font-size: 15px }
.frow.sel .fic { background: #1f6f66; color: #fff; font-weight: 800 }
.ft { display: flex; flex-direction: column; min-width: 0 } .ft b { font-size: 10px; font-weight: 700; direction: ltr; text-align: left } .ft em { font-size: 9px; color: #6b7886; font-style: normal }
.abar { position: absolute; left: 0; right: 0; bottom: 18px; height: 56px; background: #f4f6f8; border-top: 1px solid #dde3e8; display: flex; justify-content: space-around; align-items: center; font-size: 11px; font-weight: 700 }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 160px; background: #fff; border-radius: 22px 22px 0 0; z-index: 7; padding: 12px; direction: rtl }
.sheet b { font-size: 12px }
.sgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px }
.so { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 9px } .so i { width: 36px; height: 36px; border-radius: 50% }
.dlist { position: absolute; top: 100px; left: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px }
.drow { height: 46px; border-radius: 12px; background: #f1f4f7; display: flex; align-items: center; gap: 10px; padding: 0 12px; font-size: 12px }
.qs { position: absolute; inset: 0; background: linear-gradient(180deg, #2a3342, #46506a) }
.qt { position: absolute; width: 52px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; font-size: 9px; text-align: center }
.qt i { width: 44px; height: 44px; border-radius: 50% }
.bright { position: absolute; left: 14px; right: 14px; top: 220px; height: 14px; border-radius: 7px; background: rgba(255,255,255,.25) } .bright i { display: block; width: 60%; height: 100%; border-radius: 7px; background: #fff }
.trow { position: absolute; top: 100px; left: 8px; right: 8px; height: 56px; border-radius: 14px; background: #f1f4f7; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; font-size: 12px; font-weight: 700 }
.tg { width: 44px; height: 24px; border-radius: 12px; background: #1f6f66; position: relative; flex: 0 0 auto } .tg i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff }
.tnote { position: absolute; top: 170px; left: 14px; right: 14px; margin: 0; font-size: 10px; color: #6b7886 }
/* כריכה */
.cover { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 7mm }
.cover img { width: 90px; height: 90px; border-radius: 24px; box-shadow: 0 10px 24px rgba(15,42,71,.25) }
.cover h1 { font-size: 34px; margin: 0; line-height: 1.2 }
.cover p { font-size: 17px; line-height: 1.7; margin: 0; max-width: 108mm; color: #1b2b3c }
.cover .steps { text-align: right; font-size: 15px; line-height: 1.9; background: #fff; border-radius: 18px; padding: 10px 22px; width: 112mm; box-shadow: 0 6px 16px rgba(15,42,71,.1) }
.cover small { font-size: 12px; color: #5d6b78; max-width: 110mm; line-height: 1.5 }
"""


def page_html(i, p, total):
    a = phone('sam', p['a'], p['a_cap'][0], p['a_cap'][1], dim=p['a_dim'])
    b = phone('mi', p['b'], p['b_cap'][0], p['b_cap'][1], dim=p['b_dim'])
    note = f'<p class="note">{p["note"]}</p>' if p['note'] else ''
    return (
        f'<section class="page"><div class="top"><span class="num">{p["num"]}</span><h1>{p["title"]}</h1></div>'
        f'<p class="txt">{p["text"]}</p><div class="phones">{a}{b}</div>{note}'
        f'<div class="foot">ניהול כספים · מדריך התקנה · עמוד {i + 2} מתוך {total + 1}</div></section>'
    )


cover = f"""
<section class="page cover">
  <img src="{IMG['icon.png']}" alt="">
  <h1>ניהול כספים<br>מדריך התקנה לטלפון</h1>
  <p>איך מתקינים את האפליקציה בטלפון שאין בו דפדפן, על ידי העברת הקובץ בבלוטוס מטלפון שיש בו דפדפן.</p>
  <div class="steps">
    1–2. מורידים את האפליקציה בטלפון עם הדפדפן<br>
    3–4. מוצאים את הקובץ ומשתפים בבלוטוס<br>
    5–6. מדליקים בלוטוס ומקבלים את הקובץ<br>
    7–8. פותחים את הקובץ ומאשרים התקנה<br>
    9–10. יוצרים חשבון, ונכנסים מהטלפון השני
  </div>
  <p><span class="link">{LINK}</span></p>
  <small>בכל עמוד שני טלפונים: מימין הטלפון עם הדפדפן (השולח), משמאל הטלפון שלך, השיאומי (המקבל). המסכים של המערכת מאוירים, ובטלפון שלכם הם עשויים להיראות מעט אחרת, אבל הסדר והפעולות זהים. צילומי האפליקציה עצמה אמיתיים.</small>
</section>
"""

html = f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מדריך התקנה: ניהול כספים</title><style>{CSS}</style></head><body>{cover}'
html += ''.join(page_html(i, p, len(pages)) for i, p in enumerate(pages))
html += '</body></html>'
(OUT.with_suffix('.html')).write_text(html, encoding='utf-8')

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page()
    pg.goto(OUT.with_suffix('.html').resolve().as_uri())
    pg.wait_for_timeout(500)
    pg.pdf(path=str(OUT), width='150mm', height='218mm', print_background=True, prefer_css_page_size=True)
    br.close()
print('ok', OUT, len(pages) + 1, 'pages')
