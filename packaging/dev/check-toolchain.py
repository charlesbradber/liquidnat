#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import sys

lock = json.loads(Path(__file__).with_name('toolchain-lock.json').read_text())
failed = False
for package, expected in lock['packages'].items():
    try:
        actual = subprocess.check_output(['dpkg-query', '-W', '-f=${Version}', package], text=True).strip()
    except subprocess.CalledProcessError:
        actual = 'missing'
    if actual != expected:
        failed = True
        print(f'{package}: expected {expected}, observed {actual}')
if failed:
    print('Toolchain mismatch. Review and record changes before updating the development lock.')
    sys.exit(1)
print('Development toolchain matches the recorded direct dependencies.')
