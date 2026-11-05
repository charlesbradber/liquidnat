import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
import {
  apply,
  load,
  lookup,
  MAX_SUBSCRIBERS,
  parseAction,
  seed,
  STORAGE_KEY,
  tick,
  TTL,
} from "./simulator";
const now = 1793880000000;
describe("Isolated demo backend", () => {
  it("reproduces fixtures without sharing mutations", () => {
    const a = seed(now, "a"),
      b = seed(now, "b");
    const next = apply(a, { type: "fix-auth", id: "sub-0126" }, 1, now);
    expect(a.subscribers[125].status).toBe("auth-rejected");
    expect(b.subscribers[125].status).toBe("auth-rejected");
    expect(next.subscribers[125].status).toBe("online");
    expect(next.id).toBe("a");
  });
  it("completes every supported scenario through actual transitions", () => {
    let s = seed(now, "a");
    const run = (a: Parameters<typeof apply>[1]) => {
      s = apply(s, a, s.revision, now);
    };
    run({
      type: "create",
      name: "Example Subscriber",
      username: "new.person@example.net",
      profile: "home500",
    });
    expect(s.subscribers[0].status).toBe("online");
    expect(s.subscribers[0].profile).toBe("home500");
    run({ type: "fix-auth", id: "sub-0126" });
    run({ type: "fix-vlan", id: "sub-0127" });
    run({ type: "expand-pool" });
    run({ type: "profile", id: "sub-0001", profile: "home1000" });
    run({ type: "suspend", id: "sub-0001" });
    expect(s.subscribers.find((x) => x.id === "sub-0001")?.status).toBe(
      "suspended",
    );
    run({ type: "restore", id: "sub-0001" });
    run({ type: "failover" });
    expect(s.active).toBe("gateway-01");
    s = tick(s, now + 6001);
    expect(s.active).toBe("gateway-02");
    expect(
      s.subscribers
        .filter((x) => x.status === "online")
        .every((x) => x.gateway === "gateway-02"),
    ).toBe(true);
    run({ type: "upgrade" });
    s = tick(s, now + 6001);
    expect(s.version).toBe("0.2.1-demo");
    expect(s.backupAt).not.toBeNull();
    expect(lookup(s, "203.0.113.10", 40012, "TCP", now)).toHaveLength(1);
    run({ type: "mapping-viewed" });
    expect(s.completed).toHaveLength(9);
    run({ type: "rollback" });
    expect(s.version).toBe("0.2.0-demo");
    expect(s.events.length).toBeGreaterThan(9);
  });
  it("rejects stale revisions, expired sessions and unknown targets without mutation", () => {
    const s = seed(now);
    expect(() => apply(s, { type: "backup" }, 0, now)).toThrow(/changed/);
    expect(() => apply(s, { type: "backup" }, 1, now + TTL)).toThrow(/expired/);
    expect(() =>
      apply(s, { type: "suspend", id: "another-workspace-id" }, 1, now),
    ).toThrow(/not found/);
    expect(s.revision).toBe(1);
  });
  it("validates identities, duplicate names, profiles and capacity", () => {
    let s = seed(now);
    expect(() =>
      apply(
        s,
        {
          type: "create",
          name: "<script>",
          username: "x@example.net",
          profile: "home500",
        },
        1,
        now,
      ),
    ).toThrow();
    expect(() =>
      apply(
        s,
        {
          type: "create",
          name: "Example Person",
          username: "x@real.example",
          profile: "home500",
        },
        1,
        now,
      ),
    ).toThrow();
    expect(() =>
      apply(
        s,
        {
          type: "create",
          name: "Example Person",
          username: "subscriber001@example.net",
          profile: "home500",
        },
        1,
        now,
      ),
    ).toThrow(/already/);
    expect(() =>
      apply(
        s,
        { type: "profile", id: "sub-0001", profile: "unlimited" },
        1,
        now,
      ),
    ).toThrow();
    s.subscribers = Array.from(
      { length: MAX_SUBSCRIBERS },
      () => s.subscribers[0],
    );
    expect(() =>
      apply(
        s,
        {
          type: "create",
          name: "Example Person",
          username: "person@example.net",
          profile: "home500",
        },
        1,
        now,
      ),
    ).toThrow(/limited/);
  });
  it("rejects overlapping operations and duplicate pool expansion", () => {
    let s = seed(now);
    s = apply(s, { type: "failover" }, 1, now);
    expect(() => apply(s, { type: "upgrade" }, 2, now)).toThrow(
      /current operation/,
    );
    s = tick(s, now + 6000);
    expect(tick(s, now + 6001)).toBe(s);
    s = apply(s, { type: "expand-pool" }, s.revision, now);
    expect(() => apply(s, { type: "expand-pool" }, s.revision, now)).toThrow(
      /already/,
    );
  });
  it("does not attribute the wrong protocol, port or time", () => {
    const s = seed(now);
    expect(lookup(s, "203.0.113.10", 40012, "UDP", now)).toHaveLength(0);
    expect(lookup(s, "203.0.113.10", 40013, "TCP", now)).toHaveLength(0);
    expect(lookup(s, "203.0.113.10", 40012, "TCP", now - 7200000)).toHaveLength(
      0,
    );
    expect(() => lookup(s, "203.0.113.10", 70000, "TCP", now)).toThrow();
    expect(() => lookup(s, "203.0.113.10", 40012, "TCP", NaN)).toThrow();
  });
  it("bounds audit and job retention", () => {
    let s = seed(now);
    for (let i = 0; i < 120; i++)
      s = apply(
        s,
        { type: "settings", mfa: i % 2 === 0, retention: 30 },
        s.revision,
        now,
      );
    expect(s.events).toHaveLength(100);
    expect(() =>
      apply(
        s,
        { type: "settings", mfa: true, retention: 999 },
        s.revision,
        now,
      ),
    ).toThrow();
  });
  it("resets corrupt or expired session storage and uses an in-memory fallback", () => {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => map.get(k) || null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    store.setItem(STORAGE_KEY, "{corrupt");
    const a = load(store, now);
    expect(a.subscribers).toHaveLength(128);
    const b = load(store, now + TTL + 1);
    expect(b.id).not.toBe(a.id);
    const fail = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
      removeItem: () => {},
    };
    expect(load(fail, now).subscribers).toHaveLength(128);
  });
  it("rejects arbitrary backend operations and validates action fields", () => {
    for (const a of [
      null,
      [],
      { type: "exec", command: "ls" },
      { type: "create", name: 42 },
      { type: "settings", mfa: "true", retention: 30 },
    ])
      expect(() => parseAction(a)).toThrow();
    expect(
      parseAction({ type: "backup", callback: "https://example.net" }),
    ).toEqual({ type: "backup" });
  });
});
