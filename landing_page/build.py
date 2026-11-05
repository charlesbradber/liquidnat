"""Prepare real PHP entry points and shared templates for cPanel."""
from pathlib import Path
import json
import hashlib
import html
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
if OUT.is_symlink() or OUT.resolve().parent != ROOT:
    raise RuntimeError('Unexpected build directory')
# Remove only obsolete generated HTML entry points from the previous build.
for obsolete in OUT.glob('*.html'):
    if obsolete.is_symlink(): raise RuntimeError('Unexpected build symlink')
    obsolete.unlink()
shutil.copytree(ROOT / 'assets', OUT / 'assets', dirs_exist_ok=True)
shutil.copytree(ROOT / 'shared', OUT / 'includes', dirs_exist_ok=True)
config = json.loads((ROOT / 'site.json').read_text())
email = config['contact_email']
if not isinstance(email, str) or any(c in email for c in '<>"\\\n\r'):
    raise ValueError('Invalid contact email')
header = OUT / 'includes/header.php'
content = header.read_text().replace('hello@liquidnat.com', html.escape(email, quote=True))
for name in ['site.css', 'site.js']:
    digest = hashlib.sha256((OUT / 'assets' / name).read_bytes()).hexdigest()[:12]
    content = content.replace('assets/' + name, 'assets/' + name + '?v=' + digest)
header.write_text(content)
for source in sorted((ROOT / 'pages').glob('*.php')):
    shutil.copyfile(source, OUT / source.name)
for path in OUT.rglob('*.php'):
    subprocess.run(['php', '-l', str(path)], check=True, capture_output=True)
print(f'Built {len(list((ROOT / "pages").glob("*.php")))} PHP pages with shared server-rendered templates')
