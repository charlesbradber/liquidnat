"""Check generated links and deployment integrity without touching the demo."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import hashlib
import json
import subprocess
import urllib.error
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
    paths = sorted(DIST.glob('*.php'))
    assert len(paths) == 18 and not list(DIST.glob('*.html')), 'Missing PHP pages or stale HTML'
    rendered = {}
    parsed = {}
    for path in paths:
        result = subprocess.run(['php', str(path)], check=True, capture_output=True)
        assert not result.stderr, result.stderr
        rendered[path.name] = result.stdout
        page = Page()
        page.feed(result.stdout.decode())
        parsed[path.name] = page
    for path in paths:
        page = parsed[path.name]
        assert page.headings == 1, f'{path}: expected one h1'
        assert len(page.ids) == len(set(page.ids)), f'{path}: duplicate IDs'
        for link in page.links:
            parts = urlsplit(link)
            if parts.scheme or parts.netloc:
                continue
            target = DIST / unquote(parts.path) if parts.path else path
            assert target.resolve().is_relative_to(DIST.resolve()), link
            assert target.is_file(), f'{path}: broken {link}'
            if parts.fragment and target.name in parsed:
                assert unquote(parts.fragment) in parsed[target.name].ids, f'{path}: missing anchor {link}'
        if args.live:
            remote = fetch('https://liquidnat.com/' + path.name)
            assert hashlib.sha256(remote).digest() == hashlib.sha256(rendered[path.name]).digest(), f'{path}: public bytes differ'
    if args.live:
        assert fetch('https://liquidnat.com/') == rendered['index.php'], 'Root is not serving PHP index'
        for asset in (DIST / 'assets').iterdir():
            assert fetch('https://liquidnat.com/assets/' + asset.name) == asset.read_bytes(), asset.name
        for name in ['index', 'compare', 'compare-netelastic', 'contact']:
            with urllib.request.urlopen('https://liquidnat.com/' + name + '.html', timeout=30) as response:
                assert urlsplit(response.url).path == '/' + name + '.php', 'Legacy URL did not redirect'
        for template in ['header', 'footer']:
            try:
                fetch('https://liquidnat.com/includes/' + template + '.php')
                raise AssertionError('Shared template directly accessible')
            except urllib.error.HTTPError as error:
                assert error.code in (403, 404)
        evidence = json.loads(fetch('https://liquidnat.com/deployment.json'))
        assert evidence['commit'] == args.commit, 'Wrong deployed commit'
        assert evidence['site'] == 'landing'
        assert fetch('https://demo.liquidnat.com/'), 'Demo is not responding'
    print('PASS: 18 rendered PHP pages, links and anchors' + (', public bytes, commit and demo response' if args.live else ''))

if __name__ == '__main__':
    main()
