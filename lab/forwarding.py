#!/usr/bin/env python3
"""Independent stdlib-only wire generator/oracle; executes actual DPDK RX/TX.

Never connects a host interface or copies the engine's parser. Failures exit nonzero.
"""
import argparse
import collections
import datetime
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import platform
import struct
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
if not __debug__:
    raise RuntimeError('Run the validation harness without Python optimization; assertions are required')


def checksum(data):
    data += b'\0' * (len(data) % 2)
    value = sum(struct.unpack('!' + 'H' * (len(data) // 2), data))
    while value >> 16:
        value = (value & 65535) + (value >> 16)
    return (~value) & 65535


def packet(direction, family, size, tags=(), ttl=64, destination=None, protocol=17):
    left = ('192.0.2.10', '2001:db8:1::10')
    right = ('198.51.100.10', '2001:db8:2::10')
    index = 0 if family == 4 else 1
    source = ipaddress.ip_address((left if direction == 0 else right)[index]).packed
    dest = ipaddress.ip_address(destination or (right if direction == 0 else left)[index]).packed
    ether = bytes.fromhex('020000000001020000000101')
    for kind, tci in tags:
        ether += struct.pack('!HH', kind, tci)
    ether += struct.pack('!H', 0x800 if family == 4 else 0x86dd)
    header_size = 20 if family == 4 else 40
    payload_size = size - len(ether) - header_size
    assert payload_size >= 8
    payload = bytes((i * 17 + direction) % 256 for i in range(payload_size - 8))
    udp = struct.pack('!HHHH', 12345, 23456, payload_size, 0) + payload
    pseudo = source + dest
    pseudo += struct.pack('!BBH', 0, 17, len(udp)) if family == 4 else struct.pack('!I3xB', len(udp), 17)
    udp = udp[:6] + struct.pack('!H', checksum(pseudo + udp) or 65535) + udp[8:]
    if family == 4:
        ip = struct.pack('!BBHHHBBH4s4s', 0x45, 0, header_size + len(udp), 42, 0x4000, ttl, protocol, 0, source, dest)
        ip = ip[:10] + struct.pack('!H', checksum(ip)) + ip[12:]
    else:
        ip = struct.pack('!IHBB16s16s', 6 << 28, len(udp), protocol, ttl, source, dest)
    return ether + ip + udp


def forwarded(frame, direction, family, tags):
    """Independent exact expected frame, preserving transport, payload and tags."""
    out = bytearray(frame)
    egress = 1 - direction
    out[:6] = bytes([2, 0, 0, 0, egress + 1, 1])
    out[6:12] = bytes([2, 0, 0, 0, 0, egress + 1])
    l3 = 14 + 4 * len(tags)
    if family == 4:
        out[l3 + 8] -= 1
        out[l3 + 10:l3 + 12] = b'\0\0'
        out[l3 + 10:l3 + 12] = struct.pack('!H', checksum(bytes(out[l3:l3 + 20])))
    else:
        out[l3 + 7] -= 1
    return bytes(out)


def write_pcap(path, packets):
    with path.open('wb') as f:
        f.write(struct.pack('<IHHIIII', 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
        for i, p in enumerate(packets):
            f.write(struct.pack('<IIII', 1, i, len(p), len(p)))
            f.write(p)


def read_pcap(path):
    with path.open('rb') as f:
        header = f.read(24)
        assert len(header) == 24, 'missing PCAP header'
        assert header[:4] in (b'\xd4\xc3\xb2\xa1', b'\x4d\x3c\xb2\xa1'), 'unsupported PCAP endian/type'
        assert struct.unpack('<I', header[20:24])[0] == 1, 'not Ethernet'
        while record := f.read(16):
            assert len(record) == 16, 'truncated PCAP record'
            _, _, captured, original = struct.unpack('<IIII', record)
            assert captured == original and captured <= 65535, 'invalid capture length'
            frame = f.read(captured)
            assert len(frame) == captured, 'truncated PCAP frame'
            yield frame


def command(*args):
    return subprocess.check_output(args, text=True, cwd=ROOT).strip()


def source_digest():
    digest = hashlib.sha256()
    paths = [ROOT / 'CMakeLists.txt']
    for directory in ('engine', 'lab', 'tests', 'schemas', 'packaging', '.github'):
        paths += sorted(p for p in (ROOT / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    for path in paths:
        digest.update(str(path.relative_to(ROOT)).encode() + b'\0' + path.read_bytes())
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path, default=ROOT / 'build/packetd')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--repeat', type=int, default=100)
    args = parser.parse_args()
    assert 1 <= args.repeat <= 10000
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    out = (args.out or ROOT / 'benchmarks/results' / stamp).resolve()
    out.mkdir(parents=True, exist_ok=False)
    binary = args.binary.resolve()
    input_packets, expected = [[], []], [[], []]
    reasons = collections.Counter()
    sizes = [64, 128, 512, 1024, 1514]
    tag_sets = [(), ((0x8100, 100),), ((0x88a8, 200), (0x8100, 100))]
    profiles = []
    for direction in (0, 1):
        for family in (4, 6):
            for tags in tag_sets:
                for size in sizes:
                    # 64 bytes cannot fit QinQ + IPv6 + UDP. Minimum is 70.
                    actual_size = max(size, 14 + 4 * len(tags) + (20 if family == 4 else 40) + 8)
                    p = packet(direction, family, actual_size, tags)
                    input_packets[direction] += [p] * args.repeat
                    expected[1 - direction] += [forwarded(p, direction, family, tags)] * args.repeat
                    reasons['forwarded'] += args.repeat
                    profiles.append({'ingress': direction, 'family': family, 'vlan_tags': len(tags),
                                     'frame_bytes_without_fcs': actual_size, 'count': args.repeat})
        bad = []
        base = packet(direction, 4, 128)
        bad.append((base[:10], 'truncated'))
        b = bytearray(base); b[24] ^= 1; bad.append((bytes(b), 'checksum'))
        for family in (4, 6):
            bad.append((packet(direction, family, 128, ttl=1), 'hop_limit'))
            bad.append((packet(direction, family, 1600), 'mtu'))
            dst = '203.0.113.10' if family == 4 else '2001:db8:3::10'
            bad.append((packet(direction, family, 128, destination=dst), 'no_route'))
            own = ('192.0.2.10' if direction == 0 else '198.51.100.10') if family == 4 else ('2001:db8:1::10' if direction == 0 else '2001:db8:2::10')
            bad.append((packet(direction, family, 128, destination=own), 'wrong_ingress'))
        bad.append((packet(direction, 6, 128, protocol=44), 'extension'))
        b = bytearray(base); b[12:14] = b'\x08\x06'; bad.append((bytes(b), 'ether_type'))
        b = bytearray(base); b[14] = 0x65; bad.append((bytes(b), 'ip_version'))
        b = bytearray(base); b[16:18] = b'\xff\xff'; bad.append((bytes(b), 'ip_length'))
        b = bytearray(base); b[20] = 0x20; b[24:26] = b'\0\0'; b[24:26] = struct.pack('!H', checksum(bytes(b[14:34])))
        bad.append((bytes(b), 'fragment'))
        b = bytearray(base); b[26] = 127; b[24:26] = b'\0\0'; b[24:26] = struct.pack('!H', checksum(bytes(b[14:34])))
        bad.append((bytes(b), 'invalid_source'))
        bad.append((packet(direction, 4, 128, ((0x8100, 1),) * 3), 'vlan_depth'))
        for frame, reason in bad:
            input_packets[direction].append(frame)
            reasons[reason] += 1
        write_pcap(out / f'rx{direction}.pcap', input_packets[direction])
    cpu = min(os.sched_getaffinity(0))
    run = [str(binary), '-l', str(cpu), '--no-pci', '--no-huge', '--no-shconf', '--no-telemetry',
           '--file-prefix', f'liquidnat-{os.getpid()}']
    for i in (0, 1):
        run += ['--vdev', f'net_pcap{i},rx_pcap={out}/rx{i}.pcap,tx_pcap={out}/tx{i}.pcap']
    run += ['--', '--lab', '--duration-ms', '500', '--report', str(out / 'engine.json')]
    start = time.monotonic()
    result = subprocess.run(run, cwd=ROOT, text=True, capture_output=True, timeout=30)
    wall = time.monotonic() - start
    (out / 'engine.log').write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'packetd failed ({result.returncode}); inspect {out}/engine.log')
    actual = [list(read_pcap(out / f'tx{i}.pcap')) for i in (0, 1)]
    for i in (0, 1):
        assert actual[i] == expected[i], f'egress {i}: expected {len(expected[i])}, got {len(actual[i])} or mismatched bytes'
    engine = json.loads((out / 'engine.json').read_text())
    assert engine['rx'] == sum(map(len, input_packets)), 'RX loss before pipeline'
    assert engine['tx'] == reasons['forwarded'], 'TX mismatch'
    assert engine['tx_dropped'] == engine['multisegment'] == 0
    assert {k: v for k, v in engine['outcomes'].items() if v} == dict(reasons), 'drop reasons mismatch'
    assert engine['rx'] == sum(engine['outcomes'].values()), 'packet conservation failed'
    assert engine['rx_bytes'] == sum(len(p) for group in input_packets for p in group)
    bom = command('dpkg-query', '-W', '-f=${Package}\t${Version}\n')
    (out / 'packages.tsv').write_text(bom + '\n')
    report = {'schema_version': 1, 'passed': True, 'mode': 'real-engine-dpdk-file-backed-pcap',
              'source_sha256': source_digest(), 'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
              'specification_sha256': hashlib.sha256((ROOT / 'goal.md').read_bytes()).hexdigest(),
              'timestamp_utc': stamp, 'kernel': platform.release(), 'machine': platform.machine(),
              'cpu': command('lscpu'), 'compiler': command('c++', '--version').splitlines()[0],
              'cmake': command('cmake', '--version').splitlines()[0], 'dpdk': command('pkg-config', '--modversion', 'libdpdk'),
              'cpu_affinity': [cpu], 'command': run, 'process_wall_seconds': wall,
              'input_frames': list(map(len, input_packets)), 'output_frames': list(map(len, actual)),
              'exact_wire_validation': True, 'profiles': profiles, 'engine': engine,
              'packet_latency': None, 'physical_link_rate': None, 'loss_free_max_pps': None,
              'session_churn': None, 'unmeasured_reason': 'File-backed virtual PMDs; no timed external generator or physical NIC. No NAT/subscriber state in this profile.',
              'production_certified': False}
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'PASS: {engine["rx"]} received, {engine["tx"]} exact forwarded frames, {engine["rx"]-engine["tx"]} reason-checked drops')
    print(f'Evidence: {out}/report.json')


if __name__ == '__main__':
    main()
