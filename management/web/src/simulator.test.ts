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
  pack,
  unpack,
  querySubscribers,
  matchesSubscriber,
  subscriberIp,
  validateStaticIp,
} from "./simulator";
const now = 1793880000000;
describe("Isolated demo backend", () => {
  it("retains a reserved static address after authentication recovery and can bypass a blocked NAT admission", () => {
    let s = seed(now);
    s = apply(
      s,
      {
        type: "addressing",
        id: "sub-0126",
        mode: "static",
        staticIp: "192.0.2.70",
      },
      s.revision,
      now,
    );
    s = apply(s, { type: "fix-auth", id: "sub-0126" }, s.revision, now + 1);
    expect(s.subscribers.find((sub) => sub.id === "sub-0126")?.ip).toBe(
      "192.0.2.70",
    );
    s = apply(
      s,
      { type: "addressing", id: "sub-0128", mode: "direct" },
      s.revision,
      now + 2,
    );
    expect(s.subscribers.find((sub) => sub.id === "sub-0128")?.status).toBe(
      "online",
    );
  });
  it("generates 12,864 unique IP, MAC and IPv6 assignments across all addressing modes", () => {
    const s = seed(now);
    expect(s.subscribers).toHaveLength(12864);
    for (const field of [
      "id",
      "username",
      "mac",
      "ipv6",
      "ipv6Address",
    ] as const)
      expect(new Set(s.subscribers.map((sub) => sub[field])).size).toBe(12864);
    const assigned = s.subscribers.filter((sub) => sub.ip !== "—");
    expect(new Set(assigned.map((sub) => sub.ip)).size).toBe(assigned.length);
    expect(new Set(s.subscribers.map((sub) => sub.addressMode)).size).toBe(3);
    expect(s.mappings.length).toBeGreaterThan(8000);
  });
  it("searches names, RADIUS usernames, IPv4, IPv6, prefixes and MAC formats with bounded pages", () => {
    const s = seed(now),
      sub = s.subscribers[12000];
    for (const q of [
      sub.username.toUpperCase(),
      sub.ip,
      sub.ipv6,
      sub.ipv6Address,
      sub.mac,
      sub.mac.replaceAll(":", "-"),
      sub.mac.replaceAll(":", ""),
    ])
      expect(querySubscribers(s, q).items.some((x) => x.id === sub.id)).toBe(
        true,
      );
    expect(matchesSubscriber(s.subscribers[0], "Alex Bennett")).toBe(true);
    expect(
      querySubscribers(s, "", 12850, 1000).items.length,
    ).toBeLessThanOrEqual(50);
    expect(
      querySubscribers(s, "", 0, 10, "all", "static").items.every(
        (x) => x.addressMode === "static",
      ),
    ).toBe(true);
    expect(querySubscribers(s, "not-a-real-subscriber").total).toBe(0);
  });
  it("switches CGNAT to static/direct and back, preserves IPv6 and closes historical mappings without mutating prior state", () => {
    let s = seed(now);
    const original = s;
    const sub = s.subscribers[0];
    s = apply(
      s,
      {
        type: "addressing",
        id: sub.id,
        mode: "static",
        staticIp: "192.0.2.50",
      },
      s.revision,
      now,
    );
    expect(s.subscribers[0].ip).toBe("192.0.2.50");
    expect(s.subscribers[0].ipv6).toBe(sub.ipv6);
    expect(s.poolUsed).toBe(original.poolUsed - 1);
    expect(original.mappings[0].ended).toBeNull();
    expect(original.subscribers[0].addressMode).toBe("cgnat");
    expect(lookup(s, "203.0.113.10", 40012, "TCP", now - 1)).toHaveLength(1);
    expect(lookup(s, "203.0.113.10", 40012, "TCP", now)).toHaveLength(0);
    s = apply(
      s,
      { type: "addressing", id: sub.id, mode: "direct" },
      s.revision,
      now + 1,
    );
    expect(s.subscribers[0].ip).toBe(subscriberIp(0, "direct"));
    s = apply(
      s,
      { type: "addressing", id: sub.id, mode: "cgnat" },
      s.revision,
      now + 2,
    );
    expect(s.subscribers[0].addressMode).toBe("cgnat");
    expect(s.poolUsed).toBe(original.poolUsed);
    expect(
      s.mappings.filter((m) => m.subscriber === sub.id && !m.ended),
    ).toHaveLength(1);
    expect(s.events[0].category).toBe("Addressing");
  });
  it("rejects duplicate or unsafe static addresses and full-pool admission", () => {
    const s = seed(now),
      staticSub = s.subscribers.find((sub) => sub.addressMode === "static")!;
    expect(() =>
      apply(
        s,
        {
          type: "addressing",
          id: "sub-0001",
          mode: "static",
          staticIp: staticSub.ip,
        },
        1,
        now,
      ),
    ).toThrow(/already assigned/);
    for (const ip of [
      "8.8.8.8",
      "100.64.0.5",
      "198.18.0.256",
      "198.18.0.0",
      "198.18.0.255",
      "::1",
    ])
      expect(() => validateStaticIp(ip)).toThrow();
    const direct = s.subscribers.find((sub) => sub.addressMode === "direct")!;
    expect(() =>
      apply(s, { type: "addressing", id: direct.id, mode: "cgnat" }, 1, now),
    ).toThrow(/pool is full/);
    expect(() =>
      parseAction({ type: "addressing", id: direct.id, mode: "passthrough" }),
    ).toThrow();
  });
  it("persists large workspaces as compact deltas and restores changes and historical mappings exactly", () => {
    let s = seed(now, "compact");
    expect(JSON.stringify(pack(s)).length).toBeLessThan(10000);
    s = apply(
      s,
      {
        type: "addressing",
        id: "sub-0001",
        mode: "static",
        staticIp: "192.0.2.60",
      },
      1,
      now + 1,
    );
    s = apply(
      s,
      {
        type: "create",
        name: "Demo Test",
        username: "new.test@example.net",
        profile: "home500",
      },
      s.revision,
      now + 2,
    );
    s = apply(s, { type: "failover" }, s.revision, now + 3);
    s = tick(s, now + 7000);
    const packed = pack(s);
    expect(packed.subscriberChanges).toHaveLength(2);
    expect(JSON.stringify(packed).length).toBeLessThan(15000);
    const restored = unpack(JSON.parse(JSON.stringify(packed)));
    expect(restored).toEqual(s);
    expect(restored.subscribers).toHaveLength(12865);
  });
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
    expect(a.subscribers).toHaveLength(12864);
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
    expect(load(fail, now).subscribers).toHaveLength(12864);
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

describe("Network providers", () => {
  it("creates provider-scoped profiles and subscribers, transfers services, and persists links", () => {
    let s = seed(now);
    s = apply(
      s,
      parseAction({ type: "save-provider", name: "City Fibre" }),
      s.revision,
      now,
    );
    const provider = s.providers[1].id;
    s = apply(
      s,
      parseAction({
        type: "save-profile",
        name: "City 200",
        provider,
        down: 200,
        up: 50,
        price: 30,
      }),
      s.revision,
      now,
    );
    const profile = s.profiles.at(-1)!.id;
    const before = s;
    expect(() =>
      apply(
        s,
        {
          type: "create",
          name: "Alex Morgan",
          username: "alex@example.net",
          profile,
          provider: "examplenet",
        },
        s.revision,
        now,
      ),
    ).toThrow(/belonging/);
    expect(s).toEqual(before);
    s = apply(
      s,
      parseAction({
        type: "create",
        name: "Alex Morgan",
        username: "alex@example.net",
        profile,
        provider,
      }),
      s.revision,
      now,
    );
    expect(s.subscribers[0]).toMatchObject({ provider, profile });
    expect(() =>
      apply(
        s,
        { type: "profile", id: "sub-0001", profile: "home100", provider },
        s.revision,
        now,
      ),
    ).toThrow(/belonging/);
    s = apply(
      s,
      parseAction({ type: "profile", id: "sub-0001", profile, provider }),
      s.revision,
      now,
    );
    expect(s.subscribers.find((sub) => sub.id === "sub-0001")).toMatchObject({
      provider,
      profile,
    });
    const restored = unpack(JSON.parse(JSON.stringify(pack(s))));
    expect(restored.providers).toEqual(s.providers);
    expect(restored.profiles).toEqual(s.profiles);
    expect(restored.subscribers).toEqual(s.subscribers);
    expect(seed(now).providers).toHaveLength(1);
    expect(() =>
      apply(s, { type: "delete-provider", id: provider }, s.revision, now),
    ).toThrow(/Remove its profiles/);
    expect(() =>
      apply(s, { type: "delete-profile", id: profile }, s.revision, now),
    ).toThrow(/Move assigned/);
    expect(() =>
      apply(
        s,
        {
          type: "save-profile",
          id: profile,
          name: "City 200",
          provider: "examplenet",
          down: 200,
          up: 50,
          price: 30,
        },
        s.revision,
        now,
      ),
    ).toThrow(/Move assigned/);
  });
  it("validates and edits records and deletes unused provider catalogues", () => {
    let s = seed(now);
    s = apply(
      s,
      { type: "save-provider", name: "City Fibre" },
      s.revision,
      now,
    );
    const id = s.providers[1].id;
    expect(() =>
      apply(s, { type: "save-provider", name: "city fibre" }, s.revision, now),
    ).toThrow(/already exists/);
    expect(() =>
      apply(
        s,
        { type: "save-provider", id: "missing", name: "City" },
        s.revision,
        now,
      ),
    ).toThrow(/not found/);
    s = apply(
      s,
      { type: "save-provider", id, name: "City Network" },
      s.revision,
      now,
    );
    expect(s.providers[1].name).toBe("City Network");
    const values = {
      type: "save-profile" as const,
      provider: id,
      name: "Essential 100",
      down: 100,
      up: 20,
      price: 25,
    };
    expect(() =>
      apply(s, { ...values, provider: "missing" }, s.revision, now),
    ).toThrow(/valid network provider/);
    expect(() => apply(s, { ...values, down: 0 }, s.revision, now)).toThrow(
      /speeds/,
    );
    expect(() => parseAction({ ...values, down: "100" })).toThrow(
      /Invalid service/,
    );
    s = apply(s, values, s.revision, now);
    const profileId = s.profiles.at(-1)!.id;
    expect(() => apply(s, values, s.revision, now)).toThrow(/already exists/);
    s = apply(s, { ...values, id: profileId, down: 250 }, s.revision, now);
    expect(s.profiles.at(-1)!.down).toBe(250);
    s = apply(s, { type: "delete-profile", id: profileId }, s.revision, now);
    s = apply(s, { type: "delete-provider", id }, s.revision, now);
    expect(s.providers).toHaveLength(1);
    expect(() =>
      apply(s, { type: "delete-provider", id: "examplenet" }, s.revision, now),
    ).toThrow(/at least one/);
  });
  it("migrates existing sessions and rejects stored cross-provider assignments", () => {
    let s = seed(now);
    s = apply(s, { type: "suspend", id: "sub-0001" }, s.revision, now);
    const old = JSON.parse(JSON.stringify(pack(s)));
    delete old.providers;
    old.profiles.forEach((p: Record<string, unknown>) => delete p.provider);
    old.subscriberChanges.forEach(
      (p: Record<string, unknown>) => delete p.provider,
    );
    const migrated = unpack(old);
    expect(migrated.subscribers[0]).toMatchObject({
      provider: "examplenet",
      status: "suspended",
    });
    expect(migrated.providers[0].name).toBe("ExampleNet");
    old.subscriberChanges[0].provider = "missing";
    expect(() => unpack(old)).toThrow(/Invalid subscriber/);
  });
});
