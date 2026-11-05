# Isolated demo API v1

Base: `/demo/api/v1`. JSON only, no CORS, no production engine access. All responses carry `simulation: true`. Authentication is an anonymous short-lived demo workspace cookie, never a production administrator credential.

| Method/path | Request | Success | Errors |
|---|---|---|---|
| GET `/session` | Optional existing cookie | Bounded workspace, CSRF token, explicit capabilities, ETag | 503 session budget / worker unavailable |
| GET `/subscribers` | Cookie, `q` (max 128 chars), `offset` (0–250), `limit` (1–50) | Items/total/offset/limit/revision | 401 missing session, 429 budget |
| POST `/actions` | Cookie, X-Demo-CSRF, If-Match revision, Idempotency-Key; validated Action JSON | Workspace and applied revision | 403 CSRF/origin, 409 stale revision/idempotency conflict/invalid state, 413 size, 415 type, 422 validation, 429 rate/replay budget |
| POST `/reset` | Same headers; `{}` | Fresh fictional workspace; same isolated cookie | Same mutation failures |

Mutations: create `{name,username,profile}`, profile `{id,profile}`, suspend/restore/fix-auth/fix-vlan `{id}`, expand-pool, failover, upgrade, rollback, backup, mapping-viewed, settings `{mfa:boolean,retention:7|30|90}`. Each includes `type`. No external URLs, secrets, scripts, shell commands, live endpoints or uploaded configuration are accepted. Unknown action types reject. Additional fields are discarded by the allowlisted parser, never executed.

Requests are scoped by an unguessable cookie; there is no workspace-ID selector. The exact body, endpoint and expected revision are hashed for idempotency. Identical replay returns the stored response; altered reuse conflicts. Replay state is bounded to 64 mutations and rejects when exhausted. Reset is itself idempotent and returns fresh fixtures. Jobs run on simulator time and complete on session polling; they do not execute operating-system updates or HA fencing.

State schema and transition types live in `management/web/src/simulator.ts`; the PHP worker bundles that same model. No database migration or compatibility promise for production is made. SQLite is a disposable demo store, not a substitute for the intended PostgreSQL management database. This API is intentionally separate from the future authenticated appliance API.
