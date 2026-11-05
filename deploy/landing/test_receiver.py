import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

receiver, packager = load('receiver'), load('package')
COMMIT = 'a' * 40

class ReceiverTests(unittest.TestCase):
    def archive(self, name, content=b'bad', kind=tarfile.REGTYPE):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
            member = tarfile.TarInfo(name)
            member.type = kind
            member.size = len(content) if kind == tarfile.REGTYPE else 0
            archive.addfile(member, io.BytesIO(content) if member.size else None)
        return buffer.getvalue()

    def test_reject_unsafe_and_demo_paths(self):
        for name in ['../index.html', '/index.html', 'demo.liquidnat.com/index.html', '.htaccess', 'shell.php', 'assets/nested/file.js']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                receiver.decode_release(self.archive(name), COMMIT)

    def test_reject_symlink(self):
        with self.assertRaises(ValueError):
            receiver.decode_release(self.archive('index.html', kind=tarfile.SYMTYPE), COMMIT)

    def test_valid_release_preserves_demo_and_cpanel(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'dist'
            dist.mkdir()
            (dist / 'index.php').write_text('home')
            (dist / 'about.php').write_text('about')
            (dist / 'includes').mkdir()
            (dist / 'includes/header.php').write_text('header')
            archive = root / 'release.tar.gz'
            packager.package(dist, archive, COMMIT)
            files, manifest = receiver.decode_release(archive.read_bytes(), COMMIT)
            receiver.DOCROOT = root / 'public_html'
            receiver.RELEASES = root / 'releases'
            receiver.RELEASES.mkdir()
            demo = receiver.DOCROOT / 'demo.liquidnat.com'
            demo.mkdir(parents=True)
            (demo / 'index.html').write_text('existing demo')
            (receiver.DOCROOT / '.htaccess').write_text('cpanel')
            receiver.publish(files, manifest)
            self.assertEqual((demo / 'index.html').read_text(), 'existing demo')
            self.assertEqual((receiver.DOCROOT / '.htaccess').read_text(), 'cpanel')
            self.assertEqual((receiver.DOCROOT / 'about.php').read_text(), 'about')
            with self.assertRaises(ValueError):
                receiver.decode_release(archive.read_bytes(), 'b' * 40)

    def test_symlink_destination_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'target').write_text('keep')
            (root / 'index.html').symlink_to(root / 'target')
            with self.assertRaises(ValueError):
                receiver.atomic_write(root / 'index.html', b'replace')
            self.assertEqual((root / 'target').read_text(), 'keep')

if __name__ == '__main__':
    unittest.main()
