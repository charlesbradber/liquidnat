import { initialNetwork, routeLookup } from "./network";
import type { Subscriber, Workspace } from "./simulator";
import { connectionTypeLabel } from "./simulator";
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
      detail: `${connectionTypeLabel[sub.connectionType]} · ${sub.circuit} · received VLAN ${sub.vlan} · expected ${sub.expectedVlan}`,
      failed: sub.vlan !== sub.expectedVlan,
      code: "ACCESS_VLAN_MISMATCH",
    },
    {
      title: "RADIUS authentication",
      detail:
        sub.status === "auth-rejected"
          ? sub.connectionType === "dhcp"
            ? "Access-Reject · synthetic MAC / circuit identity rejected"
            : "Access-Reject · synthetic invalid credentials"
          : sub.connectionType === "dhcp"
            ? `Simulated DHCP/IPoE Access-Accept · MAC ${sub.mac} · circuit ${sub.circuit}`
            : `Simulated PPPoE Access-Accept · realm ${workspace.radius?.realm || "liquidnet.net"}`,
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
            ? `${policy.name} · ${policy.down}/${policy.up} Mb/s · service policy`
            : "Assigned profile is missing",
      failed: sub.status === "suspended" || !policy,
      code:
        sub.status === "suspended"
          ? "SERVICE_SUSPENDED"
          : "POLICY_REVISION_MISMATCH",
    },
    {
      title: "Forwarding readiness",
      detail: routeLookup(workspace.network || initialNetwork(), "1.1.1.1"),
      failed: routeLookup(
        workspace.network || initialNetwork(),
        "1.1.1.1",
      ).startsWith("No installed"),
      code: "FORWARDING_READY",
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
            : "STAGE_READY",
    };
  });
  result.push({
    title: "Path verification",
    state: "unverified",
    code: "PROBE_NOT_RUN",
    detail:
      "Run a gateway-side packet probe to verify upstream reachability and return-path routing.",
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
        "Selected subscriber only; excludes unrelated subscribers, NAT history and global audit details.",
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
