# LiquidNAT Manager interactive demo

Priority updated by the project owner on 5 November 2026: deliver a usable web playground first, while retaining and extending the underlying platform. This implements the simulated evaluation experience in goal.md §24; it is distinct from the actual appliance lab in §25.

## Run it

Inside WSL Ubuntu:

```sh
cd /home/charlesbradbeer/projects/liquidnat/management/web
npm ci
npm run dev
```

Open **http://localhost:5173/**. No email or password required. Choose **Explore demo** to see all nine guided scenarios. Each browser session has independent fictional state, a two-hour lifetime, reset, and bounded fixtures (12,864 seeded subscribers, up to 15,000 total, 100 audit entries, 20 jobs and 20,000 mapping records). Session storage unavailable: the UI reports that changes will last in memory only. No analytics, remote fonts, third-party assets, or production credentials are used.

## Larger network, global search, and IPv4 modes

The overview shows roughly **86 Gb/s of simulated aggregate traffic**, with a 120 Gb/s graph scale. These are illustrative demo figures, not measured capacity of the real engine.

The persistent top-bar search accepts name, RADIUS username, IPv4, IPv6 WAN address or delegated prefix, circuit, subscriber ID, and MAC address. MACs accept colon, hyphen, dotted or compact notation; IPv6 full-address searches normalize expanded notation. Suggestions show at most six matches; Enter or **View all matches** opens the paginated subscriber list. List pages contain ten rows and can filter independently by connection status and IPv4 mode. The diagnostic selector is bounded too; use global search to diagnose subscribers outside its short list.

Subscriber details offer **Change IPv4 mode**:

- **CGNAT:** shared IPv4, a subscriber-side 100.64.0.0/16 address and fictional tuple attribution.
- **Direct IPv4:** automatically assigned routed lab IPv4, without NAT.
- **Static IPv4:** a specific reserved routed lab IPv4, without NAT. Validation rejects invalid/unsafe demo addresses and duplicate assignments, including addresses reserved by suspended subscribers.

Direct/static fixtures use reserved benchmark addresses within **198.18.0.0/15**, never real publicly routed customer addresses. Manual static allocation also permits RFC 5737 documentation ranges. Changes preview before/after mode and address, reconnect/flow impact, IPv6 retention and expected revision. Applying closes existing NAT mappings at an exclusive end timestamp, retains historical attribution, updates pool assignment counts, and records an audit event. Entering CGNAT requires capacity; expand the seeded pool first when full. **View NAT mappings** from a CGNAT subscriber opens that service’s current tuples. Direct/static services bypass NAT and have no active NAT mappings.

Deterministic subscriber/mapping fixtures are generated locally; persistence and the PHP API transfer compact schema-v2 deltas rather than 12,000 full records. Stored v1 browser workspaces reset to the new fixtures on this demo upgrade; production data migrations are not involved. Edits, new subscribers, failover, and mapping closure survive compact round trips. The server-side subscriber endpoint uses the same search/mode/status filtering and returns at most 50 rows per request.

The hosted version uses this browser simulator adapter and no production services. It is intentionally owner-private until sharing is explicitly changed.

**Published private demo:** https://liquidnat-manager-demo.charlesbradbeer.chatgpt.site

Deployment confirmed successful on 2026-11-05. Site project `appgprj_6aec69f7578c8191a5a878133e6ba86a`; deployment `appgdep_6aec794309c48191ae1ed6040dc09109`; saved version `appgprj_6aec69f7578c8191a5a878133e6ba86a~appgver_814413767be88191ad7ef0428107f59f`. Published source commit in the separate Sites checkout: `91ba01d61d0e84d6cfd1609ddde1ff0bf041993b`. The application source is also merged/pushed to the main product repository at `2094705858d919f122cd526883da09505fa1f7bf`; publication checkout metadata is separate from product Git history.

## Explore

| Scenario | Where / action | Result |
|---|---|---|
| First subscriber | Add subscriber, assign Fibre 500, review and apply | New fictional dual-stack session, audit record |
| Wrong password | Diagnostics → Jordan Avery | Reject reason, preview synthetic credential reset, recovery |
| Wrong VLAN | Diagnostics → Riley Morgan | Expected versus received VLAN, reviewed correction, reconnect |
| Pool exhaustion | CGNAT → review capacity increase | Existing mappings retained, Quinn Taylor admitted |
| Package change | Subscriber details → Change profile | Policy revision, simulated CoA, session retained |
| Suspension | Subscriber details → Suspend, then Restore | IPv4/IPv6 policy state and audit events; scenario completes on restore |
| Gateway failure | Operations → Simulate failover | Six-second training timeline, standby promotion, revised session owner |
| Mapping lookup | CGNAT → search prefilled tuple/current UTC time | Protocol/time-scoped fictional subscriber attribution |
| Upgrade | Operations → Preview upgrade | Preflight/backup/stage/health timeline, demo version change, rollback |

The overview, filtered/paginated subscriber list, service profiles, RADIUS fixtures, network interfaces/routes/addressing, CGNAT, diagnostics, operations, administration, exports and preferences are usable. Review dialogs validate before offering Apply and retain their expected revision. Unsupported production features are described rather than reporting fake appliance success. No actual packet capture, live RADIUS, SSH, billing callback, or external destination is accepted.

## PHP API adapter

For the underlying HTTP API, use the same simulator rules server-side, behind a narrow PHP boundary:

```sh
cd management/web
npm run build
npm run build:api
npm run dev:api
```

Open **http://localhost:8088/?backend=php**. The same frontend now persists to a private SQLite workspace through PHP instead of browser storage. The router serves only the built frontend and allowlisted `/demo/api/v1/` routes. PHP 8.3 with PDO SQLite/mbstring and Node 18+ are required. This is a development server, bound to loopback; do not use PHP’s built-in server as a public appliance management service.

The API uses random HttpOnly/SameSite cookies, independent CSRF tokens, optimistic revisions, exact-request idempotency, a 16 KiB mutation-body limit, a two-hour expiry, 60 requests/minute/session, up to 128 concurrent workspaces, 64 remembered mutations/session and a 128 MiB SQLite page budget. Invalid requests consume the request budget. Workspace state, rate limits and replay records live in ignored `management/api/var/` (0700 directory, 0600 database). There are no production credentials or arbitrary commands; PHP invokes one fixed compiled simulator worker by argv without a shell. The worker shares the frontend’s validated transition model, not the C++ engine.

`GET /session` provides a bounded demo snapshot and CSRF token; `GET /subscribers` filters and paginates at the server (max 50/page). `POST /actions` and `/reset` require the cookie, `X-Demo-CSRF`, `If-Match`, and `Idempotency-Key`. See `schemas/demo-api.md`. Snapshot loading is a deliberately bounded demo capability; future production subscriber listings must use server pagination and object-level authorization.

## Verify

```sh
cd management/web
npm test
npm run build
npm run build:api
cd ../..
python3 tests/demo_api.py
```

Unit tests exercise all nine scenario transitions, isolation, validation, stale revisions, expiry, bounded storage and exact tuple/time lookup. DOM interaction tests exercise create/review/apply/filter/suspend, diagnostic recovery, guided navigation/reset and network tabs. The HTTP suite starts a temporary loopback-only PHP server and checks independent visitors, CSRF/origin rejection, idempotent replay/conflicts, stale revisions, validation, pagination, reset, rate limits and private-file boundaries.

Visual QA is outstanding: the browser-control host was unavailable during development. Responsive CSS and mobile navigation are implemented, but device rendering and a five-person fresh-user evaluation still need verification. Physical forwarding, NAT, PPPoE/IPoE, real RADIUS and HA remain separate platform milestones; simulated scenarios are not proof of those services.

Verified locally for this increment: 21 passing model/DOM interaction tests; successful TypeScript/release build; passing PHP HTTP isolation/security suite; existing engine unit regression passing. Browser preview returned HTTP 200. Sites returned a successful private deployment; no browser visual result is claimed.

## Git workflow

Test each change on a feature branch, commit, merge with `--no-ff` into `main`, then push `main`. The tested engine foundation is already on main. The browser demo and PHP adapter are committed and merged as separate reviewable increments. Never rewrite remote history or merge unrelated unreviewed local files.

Scaled-demo CI passed for product commit `2094705858d919f122cd526883da09505fa1f7bf`: [Manager demo/API](https://github.com/charlesbradber/liquidnat/actions/runs/42028965774) and [Gateway engine](https://github.com/charlesbradber/liquidnat/actions/runs/42028965966). Private publication of the scaled version was confirmed successful on 2026-11-05.
