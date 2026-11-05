# LiquidNAT

Independent ISP packet-engine and control-plane development, following [goal.md](goal.md).

**Interactive demo and development laboratory.** No production, capacity, HA, subscriber, NAT, or standards-compliance claims. The current priority is the Manager web playground (§24), while the Gateway implementation continues underneath. See [the demo guide](docs/demo.md) and [implementation plan](docs/implementation-plan.md).

The engine is independently authored C++20; DPDK provides I/O, never forwarding policy. The default lab uses two isolated PCAP virtual ports without touching host interfaces. No management listener is exposed.

Product components: **LiquidNAT Gateway** (original packet-engine foundations), **LiquidNAT RADIUS** (planned managed FreeRADIUS integration), **LiquidNAT Manager** (interactive React/TypeScript GUI and isolated PHP simulator API). The GUI deliberately simulates protocol services; it does not operate the real engine yet.

Start the web demo:

**Live demo: https://demo.liquidnat.com/**. Demo changes on `main` deploy to the cPanel host automatically; see [deployment instructions](docs/deployment.md). Engine-only and unrelated site changes do not deploy the demo.

```sh
cd management/web
npm ci
npm run dev
```

Open http://localhost:5173/ and choose **Explore demo**. All nine seeded workflows are interactive. For the local PHP-backed version and tests, see [docs/demo.md](docs/demo.md).

Inside Ubuntu 24.04 with the [recorded toolchain](packaging/dev/toolchain-lock.json):

```sh
python3 packaging/dev/check-toolchain.py
python3 tests/verify.py
```

See [lab instructions](docs/lab.md), [control contract](schemas/engine-control-v1.md), [architecture decisions](adr/0001-engine-foundations.md), and [evidence](docs/evidence.md). All commands run without attaching a host interface. Verification writes timestamped raw captures, logs, dependency BOMs and JSON under `benchmarks/results/`.
