# Standards register — development worklist, no compliance claim

Owner and independent protocol reviewer: unassigned. Date: 2026-11-05. This register separates source references, implementation profile and missing conformance evidence. All current-status/updates/errata reviews are **pending**; references are starting points, not a claim that each is the latest applicable standard. Review authoritative RFC Editor/IEEE registries and record errata before advertising a protocol profile.

| Document / version | Relevant requirement | Current supported profile and code | Test / evidence | Deviation and current-status review |
|---|---|---|---|---|
| IEEE 802.3, edition selection pending | E04 Ethernet decoding and frame bounds | 14-byte Ethernet II, engine/src/packet.cpp | unit truncation + independent PCAP frames | No FCS validation or physical NIC certification; revision/errata review pending |
| IEEE 802.1Q, edition selection pending | E04/E05 VLAN/QinQ | Up to two 0x8100/0x88a8 tags, preserve tags | lab/forwarding.py tag profiles | No VLAN admission/translation/tenant isolation; revision review pending |
| RFC 791 (IPv4) and applicable updates | E04/E05 header/TTL/fragment/MTU | Version/IHL/length/header checksum, TTL decrement, static LPM | tests/unit.cpp and two-way oracle | Drop options/fragments; no ICMP errors yet; updates/errata pending |
| RFC 1071 (Internet checksum) | E04/E05 IPv4 checksum | Full header recomputation | Independent Python checksum + bad-checksum drops | Offload/segmentation interaction untested; status review pending |
| RFC 8200 (IPv6) and applicable updates | E04/E05 IPv6 forwarding | Base header, payload bound, hop-limit decrement, static LPM | Unit + tagged/untagged two-way oracle | No extensions/fragments/jumbograms; current-status/errata pending |
| RFC 826 (ARP), RFC 4861 (ND) | E05 dynamic adjacencies | Not implemented; only static resolved MACs | Missing integration evidence | Blocks full E05; current-status/errata pending |
| RFC 792, RFC 4443, RFC 1191, RFC 8201 | E05 ICMP errors and PMTU | MTU/TTL reason drops only | Negative drop checks, no protocol-error responses | ICMP generation/PMTU discovery pending; status/errata pending |
| RFC 6888, 4787, 5382, 5508, 7857, 7422 | E07/E08 NAT protocol/allocation/traceability | Not implemented | No NAT conformance or fault evidence | Full workstream pending; current-status/errata review pending |
| RFC 1661, 2516 | E11 PPP/PPPoE | Not implemented | CPE/BNG Blaster matrix pending | Authentication/MTU/reconnect/teardown pending; updates review pending |
| RFC 2131, 8415 and applicable updates | E12/E13 DHCPv4/v6/PD | Not implemented | Relay/lease/PD tests pending | Address ownership and trusted identity pending; updates review pending |
| RFC 2865, 2866, 5080, 5176, 6614 and subsequent security updates | E10 RADIUS/auth/accounting/CoA/TLS | Planned managed FreeRADIUS boundary, not bundled | External interop/security/retry tests pending | No authentication methods certified; review latest security notices and RFC updates |
| RFC 4271, 2328 and applicable updates | E15 BGP/OSPF | Planned FRR adapter, not bundled | FIB reconciliation/fault tests pending | No routing protocol supported; updates/errata pending |

Authoritative starting points: RFC Editor `https://www.rfc-editor.org/`, IEEE Standards `https://standards.ieee.org/`, FreeRADIUS `https://www.freeradius.org/security/`, and the official sources in goal.md §41. For each future completed profile add exact update/erratum IDs, acceptance test IDs, raw report path, implementation revision, exclusions, reviewer and review date. Neither imported protocol services nor successful PCAP traffic establish general RFC compliance.
