# Engine control envelope v1 (prototype)

E06 contract, network byte order, no native structs or pointers on the wire.

| Offset | Width | Field |
|---|---|---|
| 0 | 4 | Magic `LNCT` |
| 4 | 2 | Version = 1 |
| 6 | 2 | Operation: health=1, counters=2, stage=3, activate=4 |
| 8 | 4 | Payload length, 0–65536 |
| 12 | 4 | Reserved, must be zero |
| 16 | 8 | Nonzero request ID |
| 24 | 8 | Node epoch |
| 32 | 8 | Policy generation |
| 40 | 8 | Desired revision |
| 48 | 8 | Nonzero absolute deadline, Unix milliseconds |
| 56 | variable | Typed payload (not yet implemented; nonempty payload rejected) |

Reject truncation, trailing bytes, excessive length, bad magic/version/reserved/opcode. This is a bounded codec and revision model, not an exposed server. No authorization or wire reply codec is claimed. Replies in the model include accepted/applied/rejected, structured Code, active revision; real applied replies will require worker acknowledgement.

Replay cache: 64 exact byte requests per epoch, maximum ~4.2 MiB plus metadata. New request when full rejects; identical retained request returns original reply even after deadline, conflicting reuse rejects. Callers must reconcile active state after an epoch change. Stage/activate currently exercise revision ordering only, not packetd configuration. Snapshot payloads, bulk partial results, drain/flow/replica/capabilities and local socket authorization are pending.
