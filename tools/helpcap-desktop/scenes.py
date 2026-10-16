"""
תסריט צילום ההדגמות של תוכנת המחשב. כל סצנה: מזהה, פעולות להגעה למצב המסך, והאלמנט שהחץ מצביע עליו.
קידומות: B=כפתור, R=רדיו, L=תווית שדה, T=טקסט, A=קישור, H=כותרת, C=CSS. סיומת @n = האלמנט ה-n.
"""
HOUSE = ('goto', '#/household')
S = []
def scene(id, do, target, shot=True): S.append(dict(id=id, do=do, target=target, shot=shot))
SIDE = lambda name: f'C:.side-nav a:has-text("{name}")'

scene('dk-home', [HOUSE], 'C:.side-nav')
# הוספת הוצאה
scene('home-add-expense', [HOUSE], 'B:הוספת הוצאה')
scene('exp-amount', [('click', 'B:הוספת הוצאה'), ('fill', 'C:input[inputmode=decimal]', '85')], 'C:input[inputmode=decimal]')
scene('exp-name', [('fill', 'C:form input >> nth=1', 'שופרסל')], 'C:form input >> nth=1')
scene('exp-category', [('click', 'R:מזון')], 'R:מזון')
scene('exp-more', [], 'B:פרטים נוספים')
scene('exp-save', [], 'B:שמירה')
# הוספת הכנסה
scene('home-add-income', [HOUSE], 'B:הוספת הכנסה')
scene('inc-amount', [('click', 'B:הוספת הכנסה'), ('fill', 'C:input[inputmode=decimal]', '4200'), ('fill', 'C:form input >> nth=1', 'משכורת')], 'C:input[inputmode=decimal]')
scene('inc-method', [('click', 'R:העברה בנקאית')], 'R:העברה בנקאית')
scene('inc-save', [], 'B:שמירה')
# עריכה ומחיקה
scene('menu-expenses', [HOUSE], SIDE('הוצאות'))
scene('list-edit', [('goto', '#/household/list/expense')], 'C:.txc-icon >> nth=0')
scene('list-delete', [], 'C:.txc-icon >> nth=1')
# קטגוריות
scene('cat-x', [HOUSE, ('click', 'B:הוספת הוצאה')], 'C:.chip-with-x .chip-x >> nth=0')
scene('cat-dialog', [('click', 'C:.chip-with-x .chip-x >> nth=0')], 'B:מחיקה')
# הגדרות ועסק
scene('home-gear', [HOUSE], SIDE('הגדרות').replace('.side-nav', '.side'))
scene('settings-mode', [('goto', '#/settings')], 'C:#acc-btn-mode')
scene('mode-add-name', [('click', 'C:#acc-btn-mode'), ('fill', 'L:הוספת עסק', 'סטודיו דנה')], 'L:הוספת עסק')
scene('mode-add-btn', [], 'B:הוספת עסק')
# מעבר בין מרחבים
# תקציב
scene('menu-budget', [HOUSE], SIDE('תקציב'))
scene('budget-set', [('goto', '#/household/budget')], 'B:הגדרת תקציב')
scene('budget-amount', [('click', 'B:הגדרת תקציב'), ('fill', 'C:#b-overall', '2500')], 'C:#b-overall')
scene('budget-save', [], 'B:שמירה')
# מעשרות
scene('tithe-name', [('goto', '#/household/add/expense'), ('fill', 'C:input[inputmode=decimal]', '400'), ('fill', 'C:form input >> nth=1', 'גמ״ח חסד')], 'C:form input >> nth=1')
scene('tithe-check', [('click', 'B:פרטים נוספים'), ('check', 'L:זהו תשלום מעשר')], 'L:זהו תשלום מעשר')
scene('tithe-save', [], 'B:שמירה')
scene('menu-tithes', [HOUSE], SIDE('מעשרות'))
# חיפוש וסיכומים
scene('home-search', [HOUSE], 'C:.app-header [aria-label="חיפוש"]')
scene('search-type', [('goto', '#/search'), ('fill', 'C:#search-text', 'שופרסל')], 'C:#search-text')
scene('menu-summary', [HOUSE], SIDE('סיכומים והשוואות'))
scene('summary-tabs', [('goto', '#/summary')], 'B:חודשי')
# חובות
scene('menu-debts', [HOUSE], SIDE('חובות'))
scene('debt-add', [('goto', '#/household/debts')], 'B:הוספת חוב')
# ייבוא
scene('menu-import', [HOUSE], SIDE('ייבוא נתונים'))
scene('import-pick', [('goto', '#/household/import')], 'C:main label:has(input[type=file]), main .btn')
# גיבוי ואבטחה
scene('manage-backup', [('goto', '#/settings'), ('click', 'C:#acc-btn-manage')], 'B:הורדת גיבוי מלא (JSON)')
scene('settings-security', [('goto', '#/settings')], 'C:#acc-btn-security')
scene('lock-pin', [('click', 'C:#acc-btn-security')], 'L:קוד PIN')
# סנכרון ושחזור סיסמה
scene('side-recovery', [HOUSE], 'C:.side a:has-text("שחזור סיסמה")')
