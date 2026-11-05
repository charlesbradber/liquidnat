# Implementation plan and evidence ledger

Scope source: goal.md §§7, 27–31, 38–41. Start with E01–E06; this is not approval of a production rollout. No milestone is complete merely because this ledger exists.

**Owner priority update, 2026-11-05:** deliver the interactive web playground first, with underlying services alongside it. E16/E17/E24 now take priority over expanding the packet engine. The implemented simulator GUI and PHP API adapter are described in [demo.md](demo.md); the nine simulated scenarios do not complete the corresponding real protocol milestones. Commit tested increments and merge/push them into main. The full platform acceptance scope below remains intact.

| ID | Component and supported behaviour | Failure semantics / schema | Acceptance and expected evidence | Status |
|---|---|---|---|---|
| E01 | Buyer discovery and first topology | Unknown buyer/hardware assumptions stay unratified | 10–15 interviews, 2–3 design partners, signed first profile | External prerequisite; not performed |
| E02 | Architecture, threat model, ownership | Fail closed on unknown protocols and unresolved state | ADRs, failure matrix, independent review | Proposed decisions; review pending |
| E03 | GCC/CMake/DPDK build and isolated lab | No physical NIC attachment in automated tests; bounded run | Clean build, dependency BOM, raw PCAPs and JSON report | Software lab passes; hermetic/physical validation pending |
| E04 | Ethernet/VLAN/IPv4/IPv6 parser, DPDK I/O, counters | Bounded burst/pool, explicit drop reasons, no hot-path allocation | Unit tests, ASan/UBSan, fuzzing, malformed traffic and conservation checks | PCAP core passes; NIC/overload/soak validation pending |
| E05 | Two-way routed IPv4/IPv6, static route/adjacency | Decrement TTL/hop limit, repair v4 checksum; MTU/no-route drops | Independent multi-size tagged/untagged packet oracle and negative tests | Partial: dynamic ARP/ND, ICMP errors, neighbour expiry remain open |
| E06 | Versioned local binary control contract | Bounded body, request/epoch/revision/deadline and replay rules | Codec boundary tests, idempotency/conflict tests, authenticated socket integration | Contract prototype; daemon integration remains open |

## Sequence

1. Record first-profile assumptions, architecture and threat/failure boundaries.
2. Build original parser/forwarding core with fixed resource limits and explicit outcomes.
3. Connect exactly two DPDK ports and exercise actual RX/TX with generated PCAPs.
4. Independently validate every emitted frame, all drop counters and resource bounds. Record measured software-lab timings separately from physical-NIC benchmarks.
5. Implement and test a bounded binary control codec and revision transaction model; keep it disconnected from external management until transport authorization is tested.
6. Add dynamic ARP/ND and ICMP errors, then namespace/TAP integration, hardware tests and a reviewed supported profile before claiming G1.
7. Proceed to E07–E10 NAT/allocation journal/subscriber admission once foundations are evidenced; then PPPoE/IPoE, IPv6 delegation, QoS, routing, PHP API and TypeScript administration, diagnostics, installation, upgrade/recovery, HA and demos in dependency order from §31.

## Proposed first reference profile (unratified)

Ubuntu 24.04 x86-64 development under WSL2, one pinned worker, two PCAP virtual ports, no production interface binding, one routing domain, at most two VLAN tags, fixed 16 static routes and 16 static adjacencies, 1500-byte L3 MTU, IPv4 without fragmentation/options and IPv6 without extension headers. Unsupported packets drop with a reason. Documentation-only addresses: 192.0.2.0/24, 198.51.100.0/24, 2001:db8:1::/64 and 2001:db8:2::/64. No BNG, NAT, dynamic routing, HA, tenants or live customer traffic in this profile.

## Release gate status

G0 is open: buyer commitments, named technical lead, funding/hardware/topology approval and independent design review are absent. G1 is open until complete neighbour/ICMP handling, reproducible clean-environment evidence and independent real-interface measurements are recorded. G2–G6 are unimplemented. WSL PCAP results cannot certify 10 GbE, latency, loss-free maximum, session rate, or physical-NIC compatibility.

## Changes and review

Parser and forwarding changes do not create database/schema migrations. Control protocol starts at v1 and rejects other versions; no backwards compatibility is promised before a published release. Evidence must name the source hash and dependency versions, retain raw observations, distinguish measured from unavailable metrics, and fail tests when expected packets/counters differ. Independent author review remains outstanding. Do not add synthetic acceptance or partner signatures.
