#!/usr/bin/env python3
"""Build, test and preserve auditable evidence. No live network operations."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
if not __debug__:
    raise RuntimeError('Run verification without Python optimization; assertions are required')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path)
    parser.add_argument('--fuzz-runs', type=int, default=200000)
    args = parser.parse_args()
    assert 1 <= args.fuzz_runs <= 10000000
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    out = (args.out or ROOT / 'benchmarks/results' / f'verify-{stamp}').resolve()
    out.mkdir(parents=True, exist_ok=False)
    observations = []

    def run(name, command):
        print(f'Running {name}...', flush=True)
        started = time.monotonic()
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=180,
                                env={**os.environ, 'LC_ALL': 'C', 'SOURCE_DATE_EPOCH': '1793836800'})
        log = out / f'{name}.log'
        log.write_text(result.stdout + result.stderr)
        observations.append({'step': name, 'command': command, 'exit_code': result.returncode,
                             'elapsed_seconds': time.monotonic() - started, 'log': log.name})
        (out / 'steps.json').write_text(json.dumps(observations, indent=2) + '\n')
        if result.returncode:
            raise RuntimeError(f'{name} failed; see {log}')

    run('release-configure', ['cmake', '-S', '.', '-B', 'build', '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'])
    run('release-build', ['cmake', '--build', 'build'])
    run('startup-guards', [sys.executable, 'tests/startup_guards.py'])
    run('release-unit', ['ctest', '--test-dir', 'build', '--output-on-failure', '-V'])
    run('sanitize-configure', ['cmake', '-S', '.', '-B', 'build-sanitize', '-G', 'Ninja',
                              '-DLIQUIDNAT_DPDK=OFF', '-DLIQUIDNAT_SANITIZE=ON', '-DCMAKE_BUILD_TYPE=Debug'])
    run('sanitize-build', ['cmake', '--build', 'build-sanitize'])
    run('sanitize-unit', ['ctest', '--test-dir', 'build-sanitize', '--output-on-failure', '-V'])
    run('fuzz-configure', ['cmake', '-S', '.', '-B', 'build-fuzz', '-G', 'Ninja',
                          '-DCMAKE_CXX_COMPILER=clang++', '-DLIQUIDNAT_DPDK=OFF', '-DLIQUIDNAT_FUZZ=ON', '-DCMAKE_BUILD_TYPE=Debug'])
    run('fuzz-build', ['cmake', '--build', 'build-fuzz'])
    spec = importlib.util.spec_from_file_location('wire_oracle', ROOT / 'lab/forwarding.py')
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    corpus = out / 'corpus'
    corpus.mkdir()
    for family in (4, 6):
        for direction in (0, 1):
            for tags in ((), ((0x8100, 100),), ((0x88a8, 200), (0x8100, 100))):
                p = oracle.packet(direction, family, 128, tags)
                (corpus / f'v{family}-{direction}-{len(tags)}').write_bytes(p)
    # Valid control seed (big-endian contract, independent of the C++ encoder).
    import struct
    (corpus / 'control-health').write_bytes(struct.pack('!4sHHIIQQQQQ', b'LNCT', 1, 1, 0, 0, 1, 7, 0, 0, 1000))
    run('fuzz', [str(ROOT / 'build-fuzz/parser_fuzz'), str(corpus), f'-runs={args.fuzz_runs}',
                 '-max_len=4096', '-seed=42', f'-artifact_prefix={out}/'])
    run('forwarding', [sys.executable, 'lab/forwarding.py', '--out', str(out / 'forwarding')])
    run('rebuild-configure', ['cmake', '-S', '.', '-B', 'build-reproduce', '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'])
    run('rebuild', ['cmake', '--build', 'build-reproduce'])
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    first = digest(ROOT / 'build/packetd')
    second = digest(ROOT / 'build-reproduce/packetd')
    assert first == second, 'same-toolchain independent build paths produced different packetd binaries'
    summary = {'schema_version': 1, 'passed': True, 'timestamp_utc': stamp,
               'source_sha256': oracle.source_digest(), 'packetd_sha256': first,
               'specification_sha256': digest(ROOT / 'goal.md'),
               'rebuild_sha256': second, 'same_toolchain_binary_reproducible': True,
               'hermetic_build_verified': False, 'fuzz_runs': args.fuzz_runs,
               'steps': observations, 'forwarding_report': 'forwarding/report.json',
               'open_gates': ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']}
    (out / 'verification.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(f'PASS: all verification steps; evidence {out}/verification.json')


if __name__ == '__main__':
    main()
