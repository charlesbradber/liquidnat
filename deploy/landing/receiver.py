#!/usr/bin/python3
"""Forced SSH command for liquidnat.com landing site. Installed root-owned, runs as liquidnat.

No shell, rsync, SCP, arbitrary commands, arbitrary PHP paths, dotfiles, links or client paths.
"""
import datetime
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import sys
import tarfile
import tempfile

DOCROOT = Path('/home/liquidnat/public_html')
RELEASES = Path('/home/liquidnat/landing-releases')
PHP_PAGES = frozenset({'compare.php', 'about.php', 'manager.php', 'gateway.php', 'cgnat.php', 'privacy.php', 'news.php', 'solutions.php', 'performance.php', 'platform.php', '404.php', 'migration.php', 'compare-netelastic.php', 'contact.php', 'radius.php', 'deployment.php', 'index.php', 'resources.php'})
INCLUDES = frozenset({"includes/header.php", "includes/footer.php"})
PAGES = PHP_PAGES | INCLUDES
ASSET = re.compile(r'assets/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|css|svg|png|jpe?g|webp|ico|woff2?)\Z')
SHA = re.compile(r'[0-9a-f]{40}\Z')
MAX_COMPRESSED = 16 * 1024 * 1024
MAX_UNPACKED = 20 * 1024 * 1024

def decode_release(data, commit):
    if not SHA.fullmatch(commit) or len(data) > MAX_COMPRESSED:
        raise ValueError('Invalid source commit or compressed archive size')
    files = {}
    total = 0
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member in archive:
            name = member.name
            if len(files) >= 129 or not member.isfile() or member.islnk() or member.issym():
                raise ValueError('Archive type or member count rejected')
            if name in files or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts:
                raise ValueError('Duplicate or unsafe archive path')
            if name not in PAGES and name != 'manifest.json' and not ASSET.fullmatch(name):
                raise ValueError('Only allowlisted landing pages and static assets may be deployed')
            total += member.size
            if member.size < 0 or total > MAX_UNPACKED:
                raise ValueError('Unpacked release size rejected')
            stream = archive.extractfile(member)
            content = stream.read(member.size + 1)
            if len(content) != member.size:
                raise ValueError('Truncated archive member')
            files[name] = content
    if 'index.php' not in files or 'manifest.json' not in files:
        raise ValueError('Release requires index and manifest')
    manifest = json.loads(files.pop('manifest.json'))
    if manifest.get('schema') != 1 or manifest.get('commit') != commit:
        raise ValueError('Manifest source commit mismatch')
    hashes = {name: hashlib.sha256(content).hexdigest() for name, content in files.items()}
    if manifest.get('files') != hashes:
        raise ValueError('Release manifest hash mismatch')
    for reference in re.findall(r'(?:src|href)=["\'](/assets/[^"\']+)["\']', files['index.php'].decode()):
        if reference[1:] not in files:
            raise ValueError('Index references a missing release asset')
    return files, manifest

def atomic_write(path, content):
    if path.is_symlink():
        raise ValueError('Refusing a symlink destination')
    path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    if path.parent.resolve() != path.parent:
        raise ValueError('Destination parent contains a symlink')
    fd, temporary = tempfile.mkstemp(prefix='.deploy-', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as output:
            os.fchmod(output.fileno(), 0o644)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def publish(files, manifest, rollback=False):
    release = RELEASES / manifest['commit']
    if release.is_symlink():
        raise ValueError('Release directory is a symlink')
    release.mkdir(mode=0o700, exist_ok=True)
    for name, content in files.items():
        stored = release / name
        if stored.exists() and stored.read_bytes() != content:
            raise ValueError('Existing source commit has different release bytes')
        atomic_write(stored, content)
    atomic_write(release / 'manifest.json', json.dumps(manifest, sort_keys=True).encode())
    entry = 'index.php'
    for name, content in files.items():
        if name == entry:
            continue
        destination = DOCROOT / name
        atomic_write(destination, content)
    # Assets are fully installed first. One atomic rename publishes the new page.
    atomic_write(DOCROOT / entry, files[entry])
    evidence = {'schema': 1, 'commit': manifest['commit'], 'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rollback': rollback, 'site': 'landing'}
    atomic_write(DOCROOT / 'deployment.json', json.dumps(evidence, sort_keys=True).encode())
    print(json.dumps(evidence), flush=True)

def main():
    account = pwd.getpwnam('liquidnat')
    if os.geteuid() == 0:
        os.setgroups([])
        os.setgid(account.pw_gid)
        os.setuid(account.pw_uid)
    if os.geteuid() != account.pw_uid:
        raise ValueError('Receiver must run as the liquidnat account')
    if DOCROOT.is_symlink() or DOCROOT.resolve() != DOCROOT or not DOCROOT.is_dir():
        raise ValueError('Unexpected cPanel document root')
    if RELEASES.is_symlink() or RELEASES.resolve() != RELEASES:
        raise ValueError('Unexpected release root')
    RELEASES.mkdir(mode=0o700, exist_ok=True)
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    if command == 'status':
        print((DOCROOT / 'deployment.json').read_text() if (DOCROOT / 'deployment.json').exists() else '{"deployed":false}')
        return
    match = re.fullmatch(r'(deploy|rollback) ([0-9a-f]{40})', command)
    if not match:
        raise ValueError('Only deploy <full-sha>, rollback <full-sha>, or status is allowed')
    operation, commit = match.groups()
    with (RELEASES / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        if operation == 'deploy':
            data = sys.stdin.buffer.read(MAX_COMPRESSED + 1)
            files, manifest = decode_release(data, commit)
        else:
            release = RELEASES / commit
            if release.is_symlink() or release.resolve().parent != RELEASES:
                raise ValueError('Invalid rollback release')
            manifest = json.loads((release / 'manifest.json').read_text())
            if manifest.get('commit') != commit:
                raise ValueError('Rollback manifest mismatch')
            files = {}
            for name, expected in manifest['files'].items():
                if name not in PAGES and not ASSET.fullmatch(name):
                    raise ValueError('Invalid rollback member')
                path = release / name
                if path.is_symlink() or path.resolve().parent not in (release, release / 'assets', release / 'includes'):
                    raise ValueError('Unsafe rollback path')
                files[name] = path.read_bytes()
                if hashlib.sha256(files[name]).hexdigest() != expected:
                    raise ValueError('Rollback release hash mismatch')
        publish(files, manifest, rollback=operation == 'rollback')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Landing deployment rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
