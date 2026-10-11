"""
תסריט צילום ההדגמות. כל סצנה: מזהה, פעולות להגעה למצב המסך, והאלמנט שהחץ מצביע עליו.
קידומות בבוחרים: B=כפתור, R=רדיו, L=תווית שדה, T=טקסט, A=קישור, C=CSS. סיומת @n = האלמנט ה-n.
V(עברית, אנגלית) = טקסט שמוקלד בשדה.
"""
def V(he, en): return ('V', he, en)

HOUSE = ('goto', '#/household')
S = []
def scene(id, do, target, shot=True): S.append(dict(id=id, do=do, target=target, shot=shot))

# --- הוספת הוצאה
scene('home-add-expense', [HOUSE], 'B:הוספת הוצאה')
scene('exp-amount', [('click', 'B:הוספת הוצאה'), ('fill', 'C:input[inputmode=decimal]', '85')], 'C:input[inputmode=decimal]')
scene('exp-name', [('fill', 'C:form input >> nth=1', V('שופרסל', 'Supermarket'))], 'C:form input >> nth=1')
scene('exp-category', [('click', 'R:מזון')], 'R:מזון')
scene('exp-more', [], 'B:פרטים נוספים')
scene('exp-save', [], 'B:שמירה')

# --- הוספת הכנסה
scene('home-add-income', [HOUSE], 'B:הוספת הכנסה')
scene('inc-amount', [('click', 'B:הוספת הכנסה'), ('fill', 'C:input[inputmode=decimal]', '4200'), ('fill', 'C:form input >> nth=1', V('משכורת', 'Salary'))], 'C:input[inputmode=decimal]')
scene('inc-method', [('click', 'R:העברה בנקאית')], 'R:העברה בנקאית')
scene('inc-save', [], 'B:שמירה')

# --- עריכה ומחיקה
scene('menu-expenses', [('goto', '#/household/menu')], 'A:הוצאות')
scene('list-edit', [('goto', '#/household/list/expense')], 'C:.txc-icon >> nth=0')
scene('list-delete', [], 'C:.txc-icon >> nth=1')

# --- הגדרות
scene('home-gear', [HOUSE], 'B:הגדרות')
scene('settings-manage', [('goto', '#/settings')], 'C:#acc-btn-manage')
scene('cat-x', [HOUSE, ('click', 'B:הוספת הוצאה')], 'C:.chip-with-x .chip-x >> nth=0')
scene('cat-dialog', [('click', 'C:.chip-with-x .chip-x >> nth=0')], 'B:מחיקה')
scene('settings-mode', [('goto', '#/settings')], 'C:#acc-btn-mode')
scene('mode-add-name', [('click', 'C:#acc-btn-mode'), ('fill', 'L:הוספת עסק', V('סטודיו דנה', 'Dana Studio'))], 'L:הוספת עסק')
scene('mode-add-btn', [], 'B:הוספת עסק')
scene('mode-visible', [], 'C:label:has(input[type=checkbox]) >> nth=0')

scene('switch-biz', [HOUSE], 'C:.scope-tab-business')
scene('switch-hh', [('goto', '#/business')], 'C:.scope-tab-household')

# --- תקציב
scene('menu-budget', [('goto', '#/household/menu')], 'A:תקציב')
scene('budget-set', [('goto', '#/household/budget')], 'B:הגדרת תקציב')
scene('budget-form', [('click', 'B:הגדרת תקציב')], 'B:לכל החודשים')
scene('budget-amount', [('fill', 'C:#b-overall', '2500')], 'C:#b-overall')
scene('budget-save', [], 'B:שמירה')

# --- מעשרות
scene('tithe-name', [('goto', '#/household/add/expense'), ('fill', 'C:input[inputmode=decimal]', '400'), ('fill', 'C:form input >> nth=1', V('גמ״ח חסד', 'Charity fund'))], 'C:form input >> nth=1')
scene('tithe-check', [('click', 'B:פרטים נוספים'), ('check', 'L:זהו תשלום מעשר')], 'L:זהו תשלום מעשר')
scene('tithe-save', [], 'B:שמירה')
scene('menu-tithes', [('goto', '#/household/menu')], 'A:מעשרות')
scene('tithe-recipients', [('goto', '#/tithes')], 'H:למי ניתנו מעשרות')

# --- מטבעות
scene('cur-more', [('goto', '#/household/add/expense'), ('fill', 'C:input[inputmode=decimal]', '120')], 'B:פרטים נוספים')
scene('cur-pick', [('click', 'B:פרטים נוספים'), ('click', 'R:$ USD')], 'R:$ USD')
scene('cur-setup', [('click', 'R:מזון'), ('fill', 'C:form input >> nth=1', V('חנות', 'Store')), ('click', 'B:שמירה'), ('wait', 800), ('goto', '#/household')], 'C:body', shot=False)
scene('cur-summary', [('goto', '#/household')], 'C:.mc-name >> nth=1')

# --- חובות
scene('menu-debts', [('goto', '#/household/menu')], 'A:חובות')
scene('debt-add', [('goto', '#/household/debts')], 'B:הוספת חוב')
scene('debt-direction', [('click', 'B:הוספת חוב')], 'B:אני חייב')
scene('debt-fields', [('fill', 'L:למי אני חייב', V('בנק הפועלים', 'Bank')), ('fill', 'L:סכום (₪)', '20000'), ('click', 'R:הלוואה בנקאית')], 'L:למי אני חייב')
scene('debt-save', [], 'B:שמירה')
scene('debt-saved', [('click', 'B:שמירה'), ('wait', 600)], 'B:רישום תשלום')
scene('debt-pay-amount', [('click', 'B:רישום תשלום')], 'C:input >> nth=0')
scene('debt-pay-fill', [('fill', 'C:input >> nth=0', '1500')], 'C:input >> nth=0')
scene('debt-pay-saved', [('click', 'B:שמירת תשלום'), ('wait', 600)], 'C:.tithe-months li >> nth=0')

# --- גיבוי
scene('manage-backup', [('goto', '#/settings'), ('click', 'C:#acc-btn-manage')], 'B:הורדת גיבוי מלא (JSON)')

# --- נעילה
scene('settings-security', [('goto', '#/settings')], 'C:#acc-btn-security')
scene('lock-pin', [('click', 'C:#acc-btn-security')], 'L:קוד PIN')
scene('lock-pin-set', [('click', 'L:קוד PIN')], 'C:input[type=password] >> nth=0')

# --- שפה
scene('settings-lang', [('goto', '#/settings')], 'C:#acc-btn-lang')
scene('lang-select', [('click', 'C:#acc-btn-lang')], 'C:#app-lang')

# --- חיפוש
scene('home-search', [HOUSE], 'B:חיפוש')
scene('search-type', [('goto', '#/search'), ('fill', 'C:#search-text', V('שופרסל', 'Supermarket'))], 'C:#search-text')

# --- סיכומים
scene('menu-summary', [('goto', '#/household/menu')], 'A:סיכומים והשוואות')
scene('summary-tabs', [('goto', '#/summary')], 'B:חודשי')
scene('summary-compare', [], 'C:select')

# --- ברירות מחדל
scene('settings-defaults', [('goto', '#/settings')], 'C:#acc-btn-defaults')
scene('defaults-pay', [('click', 'C:#acc-btn-defaults')], 'C:[id="def-pay-household.expense"]')
scene('defaults-custom', [('click', 'B:הוצאות')], 'L:שם האמצעי החדש')
scene('defaults-custom-name', [('fill', 'L:שם האמצעי החדש', V('ביט', 'Bit'))], 'B:הוספת אמצעי')
scene('custom-in-form', [('click', 'B:הוספת אמצעי'), ('wait', 400), ('goto', '#/household/add/expense')], 'R:ביט')
