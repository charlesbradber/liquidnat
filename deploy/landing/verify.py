"""Check generated links and deployment integrity without touching the demo."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'landing_page/dist'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], []
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1':
            self.headings += 1
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag in ('a', 'link', 'script'):
            value = attrs.get('href', attrs.get('src'))
            if value:
                self.links.append(value)

def fetch(url):
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'LiquidNAT-deployment-check'})
    with urllib.request.urlopen(request, timeout=30) as response:
        assert response.status == 200, url
        return response.read()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--commit')
    args = parser.parse_args()
    for path in DIST.glob('*.html'):
        page = Page()
        page.feed(path.read_text())
        assert page.headings == 1, f'{path}: expected one h1'
        assert len(page.ids) == len(set(page.ids)), f'{path}: duplicate IDs'
        for link in page.links:
            parts = urlsplit(link)
            if parts.scheme or parts.netloc:
                continue
            target = DIST / unquote(parts.path) if parts.path else path
            assert target.is_file(), f'{path}: broken {link}'
        if args.live:
            remote = fetch('https://liquidnat.com/' + path.name)
            assert hashlib.sha256(remote).digest() == hashlib.sha256(path.read_bytes()).digest(), f'{path}: public bytes differ'
    if args.live:
        evidence = json.loads(fetch('https://liquidnat.com/deployment.json'))
        assert evidence['commit'] == args.commit, 'Wrong deployed commit'
        assert evidence['site'] == 'landing'
        assert fetch('https://demo.liquidnat.com/'), 'Demo is not responding'
    print('PASS: landing pages, links' + (', public bytes, commit and demo response' if args.live else ''))

if __name__ == '__main__':
    main()
