import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
import { describe, it, expect } from "vitest";
import {
  initialNetwork,
  validateNetwork,
  forwardingTable,
  routeLookup,
} from "./network";
import { seed, apply, pack, unpack } from "./simulator";
describe("Network configuration", () => {
  it("persists edits, derives connected routes and withdraws routes when their link is down", () => {
    const state = seed();
    const config = initialNetwork();
    config.interfaces.push({
      id: "access0.300",
      role: "Business access",
      address: "10.30.0.1/24",
      mtu: 1500,
      enabled: true,
    });
    config.routes.push({
      id: "office",
      prefix: "10.40.0.0/16",
      via: "10.30.0.2",
      interface: "access0.300",
      metric: 10,
    });
    const saved = apply(
      state,
      { type: "network-save", config },
      state.revision,
    );
    const restored = unpack(JSON.parse(JSON.stringify(pack(saved))));
    expect(restored.network).toEqual(config);
    expect(routeLookup(restored.network!, "10.30.0.5")).toContain("Connected");
    expect(routeLookup(restored.network!, "10.40.1.5")).toContain("10.30.0.2");
    config.interfaces.find((l) => l.id === "access0.300")!.enabled = false;
    expect(
      forwardingTable(config)
        .filter((r) => r.interface === "access0.300")
        .every((r) => !r.installed),
    ).toBe(true);
    expect(routeLookup(config, "10.40.1.5")).toContain("0.0.0.0/0");
    expect(routeLookup(config, "2001:4860:4860::8888")).toContain("::/0");
    expect(state.network!.interfaces).toHaveLength(4);
  });
  it("rejects unreachable next hops, duplicate interfaces, malformed prefixes and removing referenced links", () => {
    const config = initialNetwork();
    expect(() =>
      validateNetwork({
        ...config,
        routes: [
          {
            ...config.routes.find((r) => r.id === "default")!,
            via: "10.1.1.1",
          },
        ],
      }),
    ).toThrow(/Next hop/);
    expect(() =>
      validateNetwork({
        ...config,
        interfaces: [...config.interfaces, config.interfaces[0]],
      }),
    ).toThrow(/unique/);
    expect(() =>
      validateNetwork({
        ...config,
        routes: [
          {
            ...config.routes.find((r) => r.id === "default")!,
            prefix: "10.0.1.5/24",
          },
        ],
      }),
    ).toThrow(/network address/);
    expect(() =>
      validateNetwork({
        ...config,
        interfaces: config.interfaces.filter((l) => l.id !== "upstream0"),
      }),
    ).toThrow(/existing interface/);
    expect(routeLookup(config, "999.1.1.1")).toContain("valid IPv4");
  });
});

it("persists RADIUS configuration and rejects invalid servers without changing the workspace", () => {
  const state = seed();
  const config = {
    primary: "radius-01.metro.internal",
    secondary: "radius-02.metro.internal",
    realm: "metro.net",
    clientNetwork: "10.40.0.0/24",
    accountingInterval: 120,
  };
  const saved = apply(state, { type: "radius-save", config }, state.revision);
  expect(unpack(JSON.parse(JSON.stringify(pack(saved)))).radius).toEqual(
    config,
  );
  expect(() =>
    apply(
      state,
      {
        type: "radius-save",
        config: { ...config, primary: "https://invalid" },
      },
      state.revision,
    ),
  ).toThrow(/valid hostnames/);
  expect(state.radius).toBeUndefined();
});
