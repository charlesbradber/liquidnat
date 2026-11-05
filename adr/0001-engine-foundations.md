# ADR 0001 — Original single-worker engine and isolated DPDK lab

Status: proposed; implementation experiment authorized by the build request, production architecture not approved.

Owner: project maintainer (name and independent reviewer pending). Requirements E02–E05.

Use original C++20 with GCC, DPDK ethdev for I/O and a dependency-free packet-processing core. Single worker owns both ports, route snapshot and counters. No shared mutable packet state or worker dispatch yet. Fixed tables, bounded burst of 32, fixed mbuf pool of 8191, one RX/TX queue per port. Drop multi-segment buffers until scatter support is implemented. Packet processing allocates nothing and performs no logging, socket, file or database operations. Counters saturate at uint64 maximum.

Alternatives: replacing forwarding with VPP/nftables conflicts with product ownership; physical VFIO first risks host connectivity and cannot be validated in this WSL environment; a PCAP-only standalone simulator would not test DPDK I/O. Therefore use DPDK PCAP PMDs and later TAP/physical drivers with the same core. PCAP is a real engine execution but does not measure line rate or hardware latency.

Baseline distro dependencies are captured exactly in the generated BOM. Ubuntu's supported DPDK package is a development baseline, not a certified appliance dependency choice. Record compiler/DPDK/libc/kernel versions before asserting reproducibility. Container builds isolate dependencies; package versions must be pinned to a retained package snapshot for byte-identical rebuilds.

Static LPM routes and static adjacency are explicit bootstrap constraints. IPv4 options/fragments, IPv6 extensions/fragments, multicast forwarding, ARP/ND, dynamic neighbours and ICMP error generation are not silently treated as supported. Unknown EtherTypes, invalid IP lengths/checksums, expired TTL/hop-limit, no route/adjacency and MTU violations drop with reason counters. Allow up to QinQ, preserve tag values, rewrite Ethernet MACs. Decrement TTL/hop-limit once after a valid route and adjacency are selected. No ECMP, overlapping tenants or subscriber admission yet.

Evidence: parser unit/sanitizer/fuzz runs, independent Python frame generation and packet validation, JSON/BOM artifacts. Independent review and physical-NIC validation are outstanding.

Revisit before NAT, multi-worker scaling, dynamic neighbours, or any pilot. NAT requires bidirectional owner keys with tenant/VRF, generation-safe table handles, bounded expiry, durable allocation journaling and separate ADRs; this stateless scaffold does not settle those designs.
