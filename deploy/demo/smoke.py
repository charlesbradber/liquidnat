#!/usr/bin/env python3
"""Verify the exact static release over HTTPS, including every manifest hash."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tarfile
import urllib.request

def verify(url, commit, archive):
    if url != 'https://demo.liquidnat.com' or not re.fullmatch('[0-9a-f]{40}', commit):
        raise ValueError('Smoke test requires the configured HTTPS demo origin and full commit')
    with tarfile.open(archive, 'r:gz') as release:
        manifest = json.load(release.extractfile('manifest.json'))
    if manifest['commit'] != commit:
        raise ValueError('Local release commit mismatch')
    def get(path):
        request = urllib.request.Request(url + path, headers={'Cache-Control': 'no-cache', 'User-Agent': 'LiquidNAT-deploy-check/1'})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise ValueError('Unexpected HTTP response')
            return response.read(21*1024*1024), response.headers
    metadata, _ = get('/deployment.json')
    deployed = json.loads(metadata)
    if deployed.get('commit') != commit or deployed.get('simulation') is not True:
        raise ValueError('The live deployment does not match the expected source')
    for name, expected in manifest['files'].items():
        data, headers = get('/' if name == 'index.html' else '/' + name)
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Live bytes differ from release: ' + name)
        if name == 'index.html':
            if "default-src 'self'" not in headers.get('Content-Security-Policy', ''):
                raise ValueError('Missing demo Content-Security-Policy')
            if 'no-store' not in headers.get('Cache-Control', ''):
                raise ValueError('HTML must not be cached across releases')
        elif 'immutable' not in headers.get('Cache-Control', ''):
            raise ValueError('Hashed assets require immutable caching')
    print(f'PASS: HTTPS deployment {commit}; all {len(manifest["files"])} file hashes and cache/security headers verified')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='https://demo.liquidnat.com')
    parser.add_argument('--commit', required=True)
    parser.add_argument('--archive', type=Path, required=True)
    args = parser.parse_args()
    verify(args.url, args.commit, args.archive)
