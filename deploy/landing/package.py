#!/usr/bin/env python3
"""Package only built browser assets; never PHP, credentials, or repository source."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

PAGES = frozenset({'radius.html', 'solutions.html', 'index.html', 'platform.html', 'compare.html', 'manager.html', 'resources.html', 'compare-netelastic.html', 'privacy.html', 'about.html', 'contact.html', 'gateway.html', 'news.html', '404.html'})
ALLOWED_ASSET = re.compile(r'assets/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|css|svg|png|jpe?g|webp|ico|woff2?)\Z')
MAX_FILES = 128
MAX_UNPACKED = 20 * 1024 * 1024

def package(dist: Path, destination: Path, commit: str):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('A full source commit SHA is required')
    files = {}
    for path in sorted(dist.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlinks are not deployable')
        if not path.is_file():
            continue
        name = path.relative_to(dist).as_posix()
        if name == '_headers':
            continue  # Cloudflare-only config; Apache headers are managed separately.
        if name not in PAGES and not ALLOWED_ASSET.fullmatch(name):
            raise ValueError(f'Unexpected build output: {name}')
        files[name] = path.read_bytes()
    if 'index.html' not in files or len(files) > MAX_FILES or sum(map(len, files.values())) > MAX_UNPACKED:
        raise ValueError('Missing index or release exceeds deployment bounds')
    for reference in re.findall(r'(?:src|href)=["\'](/assets/[^"\']+)["\']', files['index.html'].decode()):
        if reference[1:] not in files:
            raise ValueError(f'Index references a missing asset: {reference}')
    manifest = {'schema': 1, 'commit': commit, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    files['manifest.json'] = (json.dumps(manifest, sort_keys=True) + '\n').encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('wb') as output, gzip.GzipFile(fileobj=output, mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name, data in files.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                info.mtime = 0
                archive.addfile(info, io.BytesIO(data))
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    result = package(args.dist.resolve(), args.out.resolve(), args.commit)
    print(f'Packaged {len(result["files"])} static files from {args.commit}')
