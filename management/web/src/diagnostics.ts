import type { Subscriber, Workspace } from "./simulator";
export type DiagnosticStep = {
  title: string;
  detail: string;
  state: "passed" | "failed" | "blocked" | "unverified";
  code: string;
};
/** Fixture evidence only: a passed prerequisite never proves real packet delivery. */
export function diagnose(
  workspace: Workspace,
  sub: Subscriber,
): DiagnosticStep[] {
  const policy = workspace.profiles.find((p) => p.id === sub.profile);
  const stages = [
    {
      title: "Circuit & access handoff",
      detail: `${sub.circuit} · received VLAN ${sub.vlan} · expected ${sub.expectedVlan}`,
      failed: sub.vlan !== sub.expectedVlan,
      code: "ACCESS_VLAN_MISMATCH",
    },
    {
      title: "RADIUS authentication",
      detail:
        sub.status === "auth-rejected"
          ? "Access-Reject · synthetic invalid credentials"
          : "Simulated Access-Accept · realm example.net",
      failed: sub.status === "auth-rejected",
      code: "AUTH_REJECTED",
    },
    {
      title: "Address allocation & NAT",
      detail:
        sub.status === "pool-exhausted"
          ? `CGNAT admission blocked · ${workspace.poolUsed}/${workspace.poolCapacity} allocations used`
          : `${sub.ip} · ${sub.ipv6} · ${sub.addressMode === "cgnat" ? "CGNAT" : "NAT bypass"}`,
      failed: sub.status === "pool-exhausted" || sub.ip === "—",
      code: "LEASE_POOL_EXHAUSTED",
    },
    {
      title: "Service policy",
      detail:
        sub.status === "suspended"
          ? "Suspended policy · IPv4 and IPv6 access blocked"
          : policy
            ? `${policy.name} · ${policy.down}/${policy.up} Mb/s · simulated policy`
            : "Assigned profile is missing",
      failed: sub.status === "suspended" || !policy,
      code:
        sub.status === "suspended"
          ? "SERVICE_SUSPENDED"
          : "POLICY_REVISION_MISMATCH",
    },
    {
      title: "Forwarding readiness",
      detail: `${sub.gateway} · simulated upstream route available`,
      failed: false,
      code: "DEMO_FORWARDING_READY",
    },
  ];
  let blocked = false;
  const result: DiagnosticStep[] = stages.map((step) => {
    const state = blocked ? "blocked" : step.failed ? "failed" : "passed";
    if (step.failed) blocked = true;
    return {
      title: step.title,
      state,
      detail:
        state === "blocked"
          ? "Not evaluated: resolve the earlier blocking fault first."
          : step.detail,
      code:
        state === "blocked"
          ? "PREREQUISITE_FAILED"
          : step.failed
            ? step.code
            : "DEMO_STAGE_READY",
    };
  });
  result.push({
    title: "Real traffic verification",
    state: "unverified",
    code: "LIVE_TRAFFIC_UNMEASURED",
    detail:
      "Return-path routing, upstream reachability, loss and actual throughput are unmeasured. This demo does not send packets.",
  });
  return result;
}
export function diagnosticBundle(
  workspace: Workspace,
  sub: Subscriber,
  now = Date.now(),
) {
  return {
    manifest: {
      format: "liquidnat-demo-diagnostics-v1",
      generatedAt: new Date(now).toISOString(),
      version: workspace.version,
      revision: workspace.revision,
      simulation: true,
      packetEngineConnected: false,
      scope:
        "Selected fictional subscriber only; excludes unrelated subscribers, NAT history and global audit details.",
    },
    subscriber: { ...sub },
    profile: workspace.profiles.find((p) => p.id === sub.profile),
    pool:
      sub.addressMode === "cgnat"
        ? { used: workspace.poolUsed, capacity: workspace.poolCapacity }
        : null,
    steps: diagnose(workspace, sub),
  };
}
