#!/usr/bin/env python3
"""Prove unsafe lab arguments reject before EAL initializes or opens any PCAP."""
from pathlib import Path
import subprocess

binary = Path(__file__).resolve().parents[1] / 'build/packetd'
safe_devices = ['--vdev', 'net_pcap0,rx_pcap=missing0,tx_pcap=must-not-create0',
                '--vdev', 'net_pcap1,rx_pcap=missing1,tx_pcap=must-not-create1']
cases = [[], ['--no-huge', *safe_devices, '--', '--no-pci'],
         ['--no-pci', *safe_devices, '--', '--no-huge'],
         ['--no-pci', '--no-huge', '--vdev', 'net_pcap0,iface=eth0', '--'],
         ['--no-pci', '--no-huge', '--vdev', 'net_pcap0,rx_iface_in=eth0,tx_pcap=x', '--'],
         ['--no-pci', '--no-huge', '--vdev', 'net_tap0,iface=eth0', '--'],
         ['--no-pci', '--no-huge', '-a', '0000:00:00.0', *safe_devices, '--'],
         ['--no-pci', '--no-huge', '-d', '/tmp/untrusted.so', *safe_devices, '--'],
         ['--no-pci', '--no-huge', '--vdev', 'net_pcap0,rx_pcap=x,tx_pcap=y,rx_iface=eth0', '--']]
for arguments in cases:
    result = subprocess.run([str(binary), *arguments], text=True, capture_output=True, timeout=5)
    if result.returncode != 2 or 'EAL:' in result.stdout + result.stderr:
        raise AssertionError(f'Unsafe arguments reached EAL: {arguments}: {result.stdout} {result.stderr}')
print(f'{len(cases)} unsafe startup forms rejected before EAL initialization')
