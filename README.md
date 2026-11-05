# LiquidNAT

Independent ISP packet-engine and control-plane development, following [goal.md](goal.md).

**Development laboratory only.** No production, capacity, HA, subscriber, NAT, or standards-compliance claims. The first implementation targets E01–E06 and gate G1; the remaining platform remains on the roadmap. See [the implementation plan](docs/implementation-plan.md) for requirements, evidence, and external prerequisites.

The engine is independently authored C++20; DPDK provides I/O, never forwarding policy. The default lab uses two isolated PCAP virtual ports without touching host interfaces. No management listener is exposed.

Product components: **LiquidNAT Gateway** (packet engine and access/control services), **LiquidNAT RADIUS** (managed FreeRADIUS integration), **LiquidNAT Manager** (PHP API and TypeScript administration). This first implementation develops the Gateway engine; RADIUS and Manager are not implemented.

Inside Ubuntu 24.04 with the [recorded toolchain](packaging/dev/toolchain-lock.json):

```sh
python3 packaging/dev/check-toolchain.py
python3 tests/verify.py
```

See [lab instructions](docs/lab.md), [control contract](schemas/engine-control-v1.md), [architecture decisions](adr/0001-engine-foundations.md), and [evidence](docs/evidence.md). All commands run without attaching a host interface. Verification writes timestamped raw captures, logs, dependency BOMs and JSON under `benchmarks/results/`.
