# Development evidence and remaining work

2026-11-05, Ubuntu 24.04 / WSL2 x86-64. This is an implementation experiment for LiquidNAT Gateway, not G0/G1 certification. LiquidNAT RADIUS and LiquidNAT Manager remain planned.

The current verification entry point is `python3 tests/verify.py`; it creates a new timestamped evidence folder and prints its path. See `verification.json` for exact source/specification/binary hashes and step commands, and `forwarding/report.json` for the traffic profile, CPU affinity, hardware/software inventory, measured CPU/RSS and explicit nulls for unmeasured performance quantities. Large generated artifacts are excluded from source control; preserve them with a release candidate before making claims.

Initial passing run: `benchmarks/results/verify-20261105T112941.346389Z/verification.json`.

Latest passing foundations run: `benchmarks/results/verify-20261105T113330.617063Z/verification.json`, including nine startup-guard cases rejected before DPDK EAL initialization and fuzz assertions for drop immutability and parser bounds.

| Check | Observed result |
|---|---|
| C++20 GCC release build | Pass, warnings treated as errors |
| Unit tests | 185 assertions; 100,000 deterministic malformed frames |
| Address/undefined-behaviour sanitizers | Pass on core unit tests |
| Clang libFuzzer | 200,000 seeded parser/forwarding/control-decoder executions, no crash |
| Actual DPDK PCAP RX/TX | 6,034 frames received; 6,000 independently checked exact outputs; 34 expected drops |
| Directions/profiles | IPv4/IPv6, untagged/VLAN/QinQ, five nominal sizes, both directions |
| Resource/counter accounting | All packets accounted, no observed TX loss or multi-segment packets |
| Replay/state model | Version/size/deadline/epoch/revision/generation/conflict/exhaustion checks |
| Same-toolchain rebuild | Packetd SHA-256 identical across two build directories |

After changes, rerun verification; old hashes prove only the source recorded by that run. Unit tests and fuzzing cover the original core; linked DPDK libraries are not sanitizer-instrumented. GitHub workflow is provided but has not been executed in a remote runner. CI installs the exact direct package versions and fails if unavailable; a retained transitive package snapshot is pending.

Open work against the full specification:

- E01 buyer interviews, named owners, design partners, funding and topology approval.
- E02 independent architecture/security review, remaining state ownership/fencing and subsystem ADRs.
- E03 hermetic clean-environment rebuilds, physical/TAP-interface integration and independent hardware measurements.
- E04 NIC certification, sustained overload/exhaustion tests, scatter/offload profiles and longer fuzz/soak testing.
- E05 ARP/ND, dynamic neighbour expiry/resolution, ICMP errors/PMTU, broader forwarding profile and real-interface fault testing.
- E06 actual immutable snapshot payloads, authenticated local socket daemon, worker commit acknowledgement, durable replay/recovery and management-outage integration.
- E07–E30 NAT/journaling, BNG/RADIUS/policy, IPv6 delegation, QoS/FRR, PHP API/TypeScript UI, diagnostics, transactional recovery, HA, installer/updates, both demos, integrations, independent review, pilot and commercial readiness.

No physical throughput, latency, session capacity, RFC compliance, HA, pilot or general-availability claim has been established. All release gates remain open; consult goal.md for the full acceptance scope.
