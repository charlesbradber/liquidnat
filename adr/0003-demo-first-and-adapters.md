# ADR 0003 — Demo first, shared transitions, isolated adapters

Status: implemented development direction per owner instruction, 2026-11-05. E16/E17/E24 prototype. Independent security/design review pending.

Prioritize the complete web playground over further packet milestones. Keep the existing original engine and its tests; do not present simulation as appliance capability. Use React/TypeScript with the same typed actions and workspace model in two adapters: browser session storage for the hosted static demo, and a PHP/SQLite anonymous-session API for local server-side integration. PHP runs a single fixed bundled Node simulator worker to prevent duplicate transition logic and never accepts a command or path from the browser. This is a demo implementation, not the final production PHP framework/database architecture.

The hosted application can be static and owner-private, without customer data, management sockets, external callbacks, secrets, network access or shared mutable server state. Browser-local mutations only affect a visitor’s current session. The optional PHP adapter establishes explicit cookie/CSRF/revision/idempotency boundaries and bounded state; it does not enable production control. Public multi-user deployment needs independent review, egress isolation and an approved production server profile.

The UI uses reserved address ranges, labels simulation in its persistent banner and telemetry/HA workflows, shows validation and change impact, and records actual simulated state transitions in a bounded audit trail. Tests must prove all scenarios, reset, isolation and rejection paths. Browser-rendering tests are a separate acceptance item; unavailable browser infrastructure must be disclosed.

Revisit when adding real appliance capability discovery/authentication, production subscriber pagination, PostgreSQL management persistence, live protocol services or public sharing. Keep adapters explicit and fail rather than fall back from real hardware to a simulator.
