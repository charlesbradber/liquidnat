# Engine foundations lab — E03–E06

Run inside Ubuntu 24.04 x86-64. WSL2 is suitable for this file-backed correctness lab. This is real C++/DPDK execution, not a browser simulation. It does not certify a physical appliance or replace the later subscriber VM lab from goal.md §25.

## Dependencies

The current development package versions are in `packaging/dev/toolchain-lock.json`. Install CMake, Ninja, GCC, Clang, Python 3, pkg-config and libdpdk-dev from your approved Ubuntu repository. Do not remove repository signature checks to install them. Review mismatches explicitly:

```sh
python3 packaging/dev/check-toolchain.py
```

Each lab report preserves a full `dpkg-query` BOM. The release verification builds packetd in two different build directories and compares SHA-256 hashes. This establishes reproducibility on this toolchain only; a retained package snapshot, pinned base-image digest and clean-environment validation remain outstanding.

## One-command verification

```sh
cd /home/charlesbradbeer/projects/liquidnat
python3 tests/verify.py
```

No root required. This builds release/unit, ASan/UBSan and Clang libFuzzer targets, exercises 200,000 mutations from IPv4/IPv6/VLAN/control seeds, runs the independent PCAP oracle, and compares independent release builds. It writes a fresh timestamped directory under `benchmarks/results/`. Existing evidence directories are never overwritten. Inspect `verification.json`, step logs, `forwarding/report.json`, raw RX/TX captures, `engine.json`, `engine.log` and `packages.tsv`. Any failure exits nonzero; absence of `verification.json` means the whole run did not pass.

For just the engine and lab:

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
python3 lab/forwarding.py
```

To test the parser/control core without DPDK, configure `-DLIQUIDNAT_DPDK=OFF`. This intentionally does not build packetd. The actual packetd build requires DPDK and never substitutes an existing forwarding engine.

## Topology and behaviour

Two PCAP PMDs model left/right Ethernet ports. Host interfaces, physical PCI devices, hugepages and VFIO are not used or modified. The binary requires `--no-pci --no-huge --lab`, exactly two net_pcap ports, and rejects live interface arguments. One CPU from the current allowed affinity set is used; the exact EAL invocation is retained.

Left: 192.0.2.0/24 and 2001:db8:1::/64. Right: 198.51.100.0/24 and 2001:db8:2::/64. Static routes and MAC adjacencies are in `engine/src/packet.cpp::lab_config`. Packets destined back onto their ingress drop. Tables are fixed at 16 entries, RX bursts at 32, mbuf pool at 8191 × 4096-byte data rooms. L3 MTU is 1500. Up to two tags are preserved. IPv4 TTL/checksum and IPv6 hop limit are updated; UDP content must remain byte-identical.

The oracle checks every output byte and packet order, compares RX/TX/drop counts, conserves all packets and verifies reason codes for malformed/truncated frames, excessive tags, unknown EtherType, IP version/length/checksum errors, fragments/extensions, expired hop limit, missing route, MTU, invalid source and wrong ingress. Unit tests separately cover missing static adjacency, LPM, saturation and control envelope/revision/replay boundaries. Packet sizes are Ethernet frame lengths without FCS: nominal 64,128,512,1024,1514; tagged IPv6/UDP minimums are enlarged where necessary and recorded per profile.

## Limits and recovery

The lab runs a fixed 500 ms polling window with a 30-second subprocess timeout. Incomplete reception fails validation; it cannot be reported as zero-loss success. RX buffers are freed on drop; unsent TX is counted and freed. No dynamic neighbour resolution, ICMP errors, fragmentation, IPv4 options, IPv6 extension headers, NAT, subscriber anti-spoofing, control socket, HA, licensing or production management is implemented. Unresolved routes/adjacencies drop; nothing invokes the host network stack as a fallback. SIGINT/SIGTERM end the lab and flush captures; re-run with a new evidence directory.

PCAP timestamps do not measure engine packet latency. `packet_latency`, physical link rate, loss-free maximum PPS and session churn are explicitly null in reports. CPU time/RSS and wall times describe a bounded software lab; do not market them as appliance performance. Physical test equipment, independent capture/timestamps, congestion/resource exhaustion tests and protocol interoperability are still required for G1 and later gates.
