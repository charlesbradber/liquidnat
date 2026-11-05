# Operator workflow demo increment

Service profiles can be created from the Service profiles screen with a review step, unique case-insensitive names, integer 1–100,000 Mb/s download/upload rates, and a 32-profile workspace limit. Profiles are immutable: create a new policy and explicitly assign it to selected subscribers. Existing subscribers and their IPv4 mode remain unchanged. The model records creation in the bounded audit log, supports optimistic revisions, and persists custom policies in compact workspaces. The local PHP API accepts the same typed action; no packet engine is programmed.

Connection diagnostics now use a reusable evidence model rather than independent green/red fixture labels. A VLAN, authentication, allocation or policy fault blocks later checks. Even a ready fixture leaves real traffic, return-path routing and actual throughput unverified. The selected subscriber’s evidence can be exported as a small JSON bundle with a revision/version manifest and explicit simulation scope; unrelated subscribers, NAT history and global audit details are excluded.

Validation: model tests cover catalogue bounds, invalid speeds, duplicate names, revision conflicts, compact round trips and addressing preservation on assignment. DOM tests exercise the review/apply flow. HTTP tests create, assign, reload and isolate custom profiles through the PHP adapter. Diagnostic tests cover blocked downstream stages, stable failure codes and bounded evidence scope. These checks verify the simulator, not live forwarding or RADIUS.

Live previews use the dedicated `demo` Git branch through the existing cPanel workflow. Main integration follows the owner’s roughly hourly active-work cadence; no background scheduler or unattended merge is implied.
