# Isolated demo API v1

Base: `/demo/api/v1`. JSON only, no CORS, no production engine access. All responses carry `simulation: true`. Authentication is an anonymous short-lived demo workspace cookie, never a production administrator credential.

| Method/path | Request | Success | Errors |
|---|---|---|---|
| GET `/session` | Optional existing cookie | Compact schema-v2 workspace, CSRF token, explicit capabilities, ETag | 503 session budget / worker unavailable |
| GET `/subscribers` | Cookie, `q` (max 128 chars), `offset` (0–15000), `limit` (1–50), optional `mode` and `status` | Items/total/offset/limit/revision | 401 missing session, 429 budget |
| POST `/actions` | Cookie, X-Demo-CSRF, If-Match revision, Idempotency-Key; validated Action JSON | Workspace and applied revision | 403 CSRF/origin, 409 stale revision/idempotency conflict/invalid state, 413 size, 415 type, 422 validation, 429 rate/replay budget |
| POST `/reset` | Same headers; `{}` | Fresh fictional workspace; same isolated cookie | Same mutation failures |

Mutations: create `{name,username,profile}`, profile `{id,profile}`, suspend/restore/fix-auth/fix-vlan `{id}`, expand-pool, failover, upgrade, rollback, backup, mapping-viewed, settings `{mfa:boolean,retention:7|30|90}`. Each includes `type`. No external URLs, secrets, scripts, shell commands, live endpoints or uploaded configuration are accepted. Unknown action types reject. Additional fields are discarded by the allowlisted parser, never executed.

Requests are scoped by an unguessable cookie; there is no workspace-ID selector. The exact body, endpoint and expected revision are hashed for idempotency. Identical replay returns the stored response; altered reuse conflicts. Replay state is bounded to 64 mutations and rejects when exhausted. Reset is itself idempotent and returns fresh fixtures. Jobs run on simulator time and complete on session polling; they do not execute operating-system updates or HA fencing.

State schema and transition types live in `management/web/src/simulator.ts`; the PHP worker bundles that same model. No database migration or compatibility promise for production is made. SQLite is a disposable demo store, not a substitute for the intended PostgreSQL management database. This API is intentionally separate from the future authenticated appliance API.

Schema v2 seeds 12,864 subscribers and transfers `compact: true`, `subscriberChanges` and `mappingChanges` alongside workspace metadata. The browser adapter reconstructs the deterministic fixtures with `unpack`; the PHP worker uses the same pack/unpack functions. Seed records are never stored in every session/replay response. Old disposable v1 simulator workspaces are reseeded on upgrade. Full subscriber records are served through the paginated query endpoint.

`q` searches name, RADIUS username, IPv4, IPv6 WAN/delegated prefix, circuit, ID, MAC and mode label. `mode`: all/cgnat/direct/static. `status`: all/issues or a subscriber status. MAC separators and full IPv6 notation are normalized consistently across adapters.

New mutation: `{ "type": "addressing", "id": "sub-0001", "mode": "static", "staticIp": "192.0.2.50" }`. Modes cgnat/direct do not accept a chosen address; they allocate deterministically. Static host addresses must be in 198.18.0.0/15 or documentation /24s and unassigned to any other subscriber. Duplicate ownership rejects as `ADDRESS_IN_USE`; full CGNAT admission rejects as `CAPACITY`. A change closes active NAT tuples, retains time-scoped history, updates pool usage and records a reconnect/audit event while retaining IPv6. All effects are simulated.

Network providers: workspace metadata contains `providers: [{id,name}]`. Each service profile and subscriber contains a `provider` ID. Existing schema-v2 sessions without these fields migrate to ExampleNet while retaining their changes.

Provider mutations: `save-provider {name,id?}` adds or renames a provider; `delete-provider {id}` removes an empty provider. Keep at least one provider. Profile mutations: `save-profile {name,provider,down,up,price,id?}` creates or edits a provider-scoped service profile; `delete-profile {id}` removes an unassigned profile. Names must be 2–64 characters and unique within their scope; speeds must be positive and no greater than 100,000 Mb/s, prices between 0 and 100,000. The demo allows 100 providers and 300 profiles. An assigned profile cannot change provider or be deleted.

Subscriber `create` and `profile` mutations accept an optional `provider`; when omitted it is inferred from the selected profile for older callers. Explicit mismatches reject as `PROVIDER_MISMATCH`. Selecting a profile on another provider transfers the subscriber and its provider together. GET `/subscribers` accepts `provider=<id>` (default `all`) alongside the existing filters. Provider IDs are workspace configuration groupings, not security or tenant isolation boundaries. All actions remain simulations and use the same revision, validation, audit and replay rules.
