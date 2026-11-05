# LiquidNAT Manager interactive demo

Priority updated by the project owner on 5 November 2026: deliver a usable web playground first, while retaining and extending the underlying platform. This implements the simulated evaluation experience in goal.md §24; it is distinct from the actual appliance lab in §25.

## Run it

Inside WSL Ubuntu:

```sh
cd /home/charlesbradbeer/projects/liquidnat/management/web
npm ci
npm run dev
```

Open **http://localhost:5173/**. No email or password required. Choose **Explore demo** to see all nine guided scenarios. Each browser session has independent fictional state, a two-hour lifetime, reset, and bounded fixtures (250 subscribers, 100 audit entries, 20 jobs). Session storage unavailable: the UI reports that changes will last in memory only. No analytics, remote fonts, third-party assets, or production credentials are used.

The hosted version uses this browser simulator adapter and no production services. It is intentionally owner-private until sharing is explicitly changed. The private publication URL and saved version are recorded after deployment.

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

## Git workflow

Test each change on a feature branch, commit, merge with `--no-ff` into `main`, then push `main`. The tested engine foundation is already on main. The browser demo and PHP adapter are committed and merged as separate reviewable increments. Never rewrite remote history or merge unrelated unreviewed local files.
