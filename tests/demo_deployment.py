#!/usr/bin/env python3
"""Deployment boundary tests; all writes are confined to a temporary directory."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/'deploy/demo'/f'{name}.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value
package, receiver = module('package'), module('receiver')
COMMIT = 'a'*40

def malicious(name, data=b'x', kind=tarfile.REGTYPE):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        member = tarfile.TarInfo(name)
        member.type = kind
        member.size = len(data) if kind == tarfile.REGTYPE else 0
        member.linkname = '/etc/passwd' if kind != tarfile.REGTYPE else ''
        archive.addfile(member, io.BytesIO(data) if kind == tarfile.REGTYPE else None)
    return output.getvalue()

class Deployment(unittest.TestCase):
    def test_reproducible_package_and_exact_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root/'dist'; (dist/'assets').mkdir(parents=True)
            (dist/'index.html').write_text('<script src="/assets/app-abc.js"></script>')
            (dist/'assets/app-abc.js').write_text('console.log("fixture");')
            (dist/'_headers').write_text('Cloudflare-only')
            package.package(dist, root/'one.tar.gz', COMMIT)
            package.package(dist, root/'two.tar.gz', COMMIT)
            self.assertEqual((root/'one.tar.gz').read_bytes(), (root/'two.tar.gz').read_bytes())
            files, manifest = receiver.decode_release((root/'one.tar.gz').read_bytes(), COMMIT)
            self.assertEqual(set(files), {'index.html','assets/app-abc.js'})
            self.assertEqual(manifest['files']['index.html'], hashlib.sha256(files['index.html']).hexdigest())
            old_root, old_releases = receiver.DOCROOT, receiver.RELEASES
            try:
                receiver.DOCROOT=root/'site';receiver.DOCROOT.mkdir()
                receiver.RELEASES=root/'releases';receiver.RELEASES.mkdir()
                (receiver.DOCROOT/'.htaccess').write_text('preserve cPanel')
                receiver.publish(files, manifest)
                self.assertEqual((receiver.DOCROOT/'index.html').read_bytes(), files['index.html'])
                self.assertEqual((receiver.DOCROOT/'.htaccess').read_text(), 'preserve cPanel')
                self.assertEqual(json.loads((receiver.DOCROOT/'deployment.json').read_text())['commit'], COMMIT)
            finally:
                receiver.DOCROOT, receiver.RELEASES=old_root, old_releases
    def test_path_links_types_and_manifest_rejected(self):
        for name in ['../outside', '/etc/passwd', '.htaccess', 'api.php', 'assets/../../outside', 'assets/.secret.js']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                receiver.decode_release(malicious(name), COMMIT)
        for kind in [tarfile.SYMTYPE,tarfile.LNKTYPE,tarfile.CHRTYPE,tarfile.DIRTYPE]:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                receiver.decode_release(malicious('index.html',kind=kind), COMMIT)
        with self.assertRaises(ValueError):receiver.decode_release(malicious('index.html'), COMMIT)
        with self.assertRaises(ValueError):receiver.decode_release(b'x'*(receiver.MAX_COMPRESSED+1), COMMIT)
    def test_packages_refuse_executable_or_missing_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            dist=Path(temporary)/'dist';dist.mkdir()
            (dist/'index.html').write_text('<script src="/assets/missing.js"></script>')
            with self.assertRaises(ValueError):package.package(dist,Path(temporary)/'bad.tar.gz',COMMIT)
            (dist/'index.html').write_text('demo');(dist/'shell.php').write_text('not deployable')
            with self.assertRaises(ValueError):package.package(dist,Path(temporary)/'bad.tar.gz',COMMIT)

if __name__=='__main__':unittest.main()
