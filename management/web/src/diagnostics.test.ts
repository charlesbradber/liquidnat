import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
import { describe, expect, it } from "vitest";
import { seed } from "./simulator";
import { diagnose, diagnosticBundle } from "./diagnostics";
describe("Fixture diagnostic evidence", () => {
  it("blocks downstream stages after a VLAN fault and never asserts measured traffic", () => {
    const s = seed();
    const steps = diagnose(
      s,
      s.subscribers.find((sub) => sub.status === "vlan-mismatch")!,
    );
    expect(steps.map((step) => step.state)).toEqual([
      "failed",
      "blocked",
      "blocked",
      "blocked",
      "blocked",
      "unverified",
    ]);
    expect(steps[0].code).toBe("ACCESS_VLAN_MISMATCH");
    expect(steps[1].detail).not.toContain("Access-Accept");
  });
  it("reports the earliest specific failure for authentication, allocation and suspension", () => {
    const s = seed();
    for (const [status, code] of [
      ["auth-rejected", "AUTH_REJECTED"],
      ["pool-exhausted", "LEASE_POOL_EXHAUSTED"],
      ["suspended", "SERVICE_SUSPENDED"],
    ] as const) {
      const sub = {
        ...(s.subscribers.find((sub) => sub.status === status) ||
          s.subscribers[0]),
        status,
      };
      const steps = diagnose(s, sub);
      expect(steps.find((step) => step.state === "failed")?.code).toBe(code);
      expect(steps.at(-1)?.state).toBe("unverified");
    }
  });
  it("exports only the chosen fictional subscriber and relevant policy with a simulation manifest", () => {
    const s = seed();
    const bundle = diagnosticBundle(s, s.subscribers[0], s.created);
    expect(bundle.manifest.simulation).toBe(true);
    expect(bundle.manifest.packetEngineConnected).toBe(false);
    expect(bundle.subscriber.id).toBe(s.subscribers[0].id);
    expect(bundle.profile?.id).toBe(s.subscribers[0].profile);
    expect(JSON.stringify(bundle).length).toBeLessThan(6000);
    expect(JSON.stringify(bundle)).not.toContain(s.subscribers[1].username);
    expect(bundle.steps.filter((step) => step.state === "passed")).toHaveLength(
      5,
    );
  });
});
