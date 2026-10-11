"""מדפיס את הטקסטים והאלמנטים הנראים במסך, כדי לכתוב תסריטי צילום."""
import sys
from playwright.sync_api import sync_playwright
routes = sys.argv[1:]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    pg = b.new_context(viewport={'width': 360, 'height': 680}).new_page()
    pg.goto('http://localhost:8741/tools/helpcap/index.html')
    pg.wait_for_timeout(2000)
    for r in routes:
        pg.evaluate(f"location.hash='{r}'")
        pg.wait_for_timeout(700)
        print('=====', r)
        print(pg.evaluate("""() => [...document.querySelectorAll('button,a,input,select,textarea,[role=radio],[role=tab],label,h1,h2,h3,summary')]
          .filter(e => e.offsetParent !== null)
          .map(e => e.tagName.toLowerCase() + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : '') + ' | ' + (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 60) + (e.id ? ' #' + e.id : '') + (e.className && typeof e.className === 'string' ? ' .' + e.className.split(' ').slice(0,2).join('.') : '')).join('\\n')"""))
    b.close()
