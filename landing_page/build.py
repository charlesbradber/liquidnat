from pathlib import Path
import json, re, shutil

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
config = json.loads((ROOT / 'site.json').read_text())
header = (ROOT / 'shared/header.html').read_text()
footer = (ROOT / 'shared/footer.html').read_text()
for source in sorted((ROOT / 'pages').glob('*.html')):
    text = source.read_text()
    title, description, body = text.split('\n', 2)
    active_header = header.replace(f'href="{source.name}"', f'href="{source.name}" aria-current="page"')
    document = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | LiquidNAT</title><meta name="description" content="{description}">
<meta name="theme-color" content="#1239ed"><meta property="og:title" content="{title} | LiquidNAT"><meta property="og:description" content="{description}"><meta property="og:type" content="website">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/site.css"><script src="assets/site.js" defer></script></head>
<body id="top" data-contact-email="{config['contact_email']}">{active_header}<main id="main">{body}</main>{footer}</body></html>'''
    (OUT / source.name).write_text(document)
shutil.copytree(ROOT / 'assets', OUT / 'assets', dirs_exist_ok=True)
not_found = re.sub(r'<main id="main">.*?</main>', '<main id="main"><section class="page-hero"><span class="eyebrow">404 / WRONG TURN</span><h1>Let’s reconnect.</h1><p>This address does not point to a page.</p><a class="button" href="index.html">Back to LiquidNAT ↗</a></section></main>', (OUT / 'index.html').read_text(), flags=re.S)
(OUT / '404.html').write_text(not_found.replace('<title>ISP networking, with a clearer view | LiquidNAT</title>', '<title>Page not found | LiquidNAT</title>'))
print(f'Built {len(list((ROOT / "pages").glob("*.html")))} pages into {OUT}')
