# ADR 0002 — Immutable revisions and a local binary control boundary

Status: proposed. Owner/reviewer: unassigned. Requirements E02, E06.

The web/PHP API and eventual PostgreSQL store desired state; neither participates in forwarding. Future Go configd validates and stages complete snapshots, then requests atomic activation at a worker burst boundary. Current prototype only exercises a codec/state model: it is not a network management daemon and is not wired to packetd.

The v1 binary envelope carries magic, version, operation, payload length, request ID, node epoch, policy generation, desired revision and absolute deadline (Unix milliseconds), all big-endian. Maximum payload 64 KiB. Reject invalid lengths/opcodes/versions without mutation. Only stage/activate/health/counters are reserved initially; unsupported operations reject. A repeated request ID with identical bytes returns the original result; changed bytes conflict. Replay memory is bounded; once full, reject new operations rather than evicting and allowing an old mutation to execute twice. Restart increments epoch and requires caller reconciliation. Revision activation requires a matching staged revision and strictly increasing generation; activation never reports applied before the worker has acknowledged it. Prototype tests the revision model, not cross-process acknowledgement.

Future transport is AF_UNIX SOCK_SEQPACKET in a protected 0700 runtime directory, socket 0600 and SO_PEERCRED uid allowlist; message credentials are not self-asserted fields. Remote control is disabled until mTLS/authorization are implemented. No arbitrary host paths, shell commands or network fetches are accepted. Production needs persisted request outcomes or explicit epoch recovery; the bounded in-memory model cannot provide durable exactly-once effects across restart.

| Failure / threat | Required outcome |
|---|---|
| UI/API/database/cloud lost | Continue last committed forwarding; reject unsafe writes |
| Malformed or oversized packet | Bounded parsing, reason drop, no privilege escalation |
| RX flood / TX congestion | Fixed burst/pool, count unsent TX and release buffers |
| Unknown route/adjacency/policy | Fail closed, no permissive fallback |
| Partial config / expired command | Reject without changing active revision |
| Unauthorized local control | Socket permissions and peer authorization before decoding commands |
| Duplicate or conflicting request | Replay original result or conflict; never double-apply |
| Packet engine failure | Outage; no HA claim in this milestone |
| Log/telemetry/storage failure | No synchronous packet dependency; future NAT admission must close before attribution is lost |

Independent security review, socket integration, crash/restart tests and state ownership/fencing decisions remain prerequisites. This document is not evidence of HA, management-outage certification, authentication or production safety.
