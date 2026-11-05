export type Link = {
  id: string;
  role: string;
  address: string;
  ipv6?: string;
  mtu: number;
  enabled: boolean;
};
export type Route = {
  id: string;
  prefix: string;
  via: string;
  interface: string;
  metric: number;
};
export type NetworkConfig = { interfaces: Link[]; routes: Route[] };
export const initialNetwork = (): NetworkConfig => ({
  interfaces: [
    {
      id: "access0.200",
      role: "Subscriber access",
      address: "100.64.0.1/16",
      ipv6: "2001:db8::1/48",
      mtu: 1492,
      enabled: true,
    },
    {
      id: "upstream0",
      role: "Transit uplink",
      address: "198.51.100.2/30",
      ipv6: "2001:db8:ffff:1::2/64",
      mtu: 1500,
      enabled: true,
    },
    {
      id: "mgmt0",
      role: "Management",
      address: "192.0.2.10/25",
      mtu: 1500,
      enabled: true,
    },
    {
      id: "replica0",
      role: "HA replication",
      address: "192.0.2.129/30",
      mtu: 1500,
      enabled: true,
    },
  ],
  routes: [
    {
      id: "default6",
      prefix: "::/0",
      via: "2001:db8:ffff:1::1",
      interface: "upstream0",
      metric: 10,
    },
    {
      id: "subscribers6",
      prefix: "2001:db8::/32",
      via: "Direct",
      interface: "access0.200",
      metric: 0,
    },
    {
      id: "default",
      prefix: "0.0.0.0/0",
      via: "198.51.100.1",
      interface: "upstream0",
      metric: 10,
    },
    {
      id: "direct",
      prefix: "198.18.0.0/15",
      via: "Direct",
      interface: "access0.200",
      metric: 0,
    },
  ],
});
export function ipv4(value: string): number {
  if (
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(value) ||
    value.split(".").some((x) => Number(x) > 255)
  )
    throw Error("Enter a valid IPv4 address.");
  return value.split(".").reduce((n, x) => n * 256 + Number(x), 0) >>> 0;
}
export function cidr(value: string) {
  const [address, bits, extra] = value.split("/");
  if (
    extra !== undefined ||
    bits === undefined ||
    !/^\d+$/.test(bits) ||
    Number(bits) > 32
  )
    throw Error("Enter an IPv4 prefix with a length from 0 to 32.");
  const length = Number(bits),
    mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  const network = (ipv4(address) & mask) >>> 0;
  return {
    network,
    mask,
    length,
    prefix:
      [24, 16, 8, 0].map((b) => (network >>> b) & 255).join(".") + "/" + length,
  };
}
function ipValue(value: string): { value: bigint; bits: number } {
  if (!value.includes(":")) return { value: BigInt(ipv4(value)), bits: 32 };
  let normalized: string;
  try {
    normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  } catch {
    throw Error("Enter a valid IPv6 address.");
  }
  const halves = normalized.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  const words =
    halves.length > 1
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
  return {
    value: words.reduce((n, x) => (n << 16n) + BigInt(parseInt(x, 16)), 0n),
    bits: 128,
  };
}
function prefixInfo(value: string) {
  const [address, bits, extra] = value.split("/");
  const ip = ipValue(address);
  if (
    extra !== undefined ||
    bits === undefined ||
    !/^\d+$/.test(bits) ||
    Number(bits) > ip.bits
  )
    throw Error("Enter a valid IPv4 or IPv6 prefix length.");
  const length = Number(bits),
    shift = BigInt(ip.bits - length),
    network = (ip.value >> shift) << shift;
  let prefix: string;
  if (ip.bits === 32)
    prefix =
      [24n, 16n, 8n, 0n].map((b) => Number((network >> b) & 255n)).join(".") +
      "/" +
      length;
  else {
    const full = Array.from({ length: 8 }, (_, i) =>
      ((network >> BigInt((7 - i) * 16)) & 65535n).toString(16),
    ).join(":");
    prefix = new URL(`http://[${full}]/`).hostname.slice(1, -1) + "/" + length;
  }
  return {
    network,
    length,
    bits: ip.bits,
    prefix,
    contains: (other: ReturnType<typeof ipValue>) =>
      other.bits === ip.bits && (other.value >> shift) << shift === network,
  };
}
export function validateNetwork(config: NetworkConfig) {
  if (
    !config ||
    !Array.isArray(config.interfaces) ||
    !Array.isArray(config.routes) ||
    config.interfaces.length > 64 ||
    config.routes.length > 256
  )
    throw Error("Network configuration exceeds capacity.");
  const names = new Set<string>();
  for (const link of config.interfaces) {
    if (!/^[a-zA-Z][a-zA-Z0-9._-]{0,31}$/.test(link.id) || names.has(link.id))
      throw Error("Use a unique interface name.");
    names.add(link.id);
    cidr(link.address);
    if (link.ipv6 && prefixInfo(link.ipv6).bits !== 128)
      throw Error("Enter a valid IPv6 interface prefix.");
    if (
      !link.role.trim() ||
      link.role.length > 64 ||
      typeof link.enabled !== "boolean" ||
      !Number.isInteger(link.mtu) ||
      link.mtu < 576 ||
      link.mtu > 9216
    )
      throw Error("Provide a role and MTU between 576 and 9216.");
  }
  const prefixes = new Set<string>();
  for (const route of config.routes) {
    const destination = prefixInfo(route.prefix);
    if (destination.prefix !== route.prefix)
      throw Error(
        "Route prefix must use the network address: " + destination.prefix,
      );
    if (prefixes.has(route.prefix))
      throw Error("A route already exists for this prefix.");
    prefixes.add(route.prefix);
    const link = config.interfaces.find((x) => x.id === route.interface);
    if (!link) throw Error("Select an existing interface.");
    if (route.via !== "Direct") {
      const next = ipValue(route.via),
        address = next.bits === 128 ? link.ipv6 : link.address;
      if (
        !address ||
        next.bits !== destination.bits ||
        !prefixInfo(address).contains(next) ||
        next.value === ipValue(address.split("/")[0]).value
      )
        throw Error(
          "Next hop must be a different address on the selected interface network.",
        );
    }
    if (
      !Number.isInteger(route.metric) ||
      route.metric < 0 ||
      route.metric > 65535
    )
      throw Error("Metric must be between 0 and 65535.");
  }
  return config;
}
export function forwardingTable(config: NetworkConfig) {
  return [
    ...config.interfaces.flatMap((link) =>
      [link.address, link.ipv6]
        .filter((a): a is string => !!a)
        .map((address) => ({
          id: "connected-" + link.id + address,
          prefix: prefixInfo(address).prefix,
          via: "Direct",
          interface: link.id,
          metric: 0,
          protocol: "Connected",
        })),
    ),
    ...config.routes.map((route) => ({ ...route, protocol: "Static" })),
  ].map((route) => ({
    ...route,
    installed: !!config.interfaces.find((link) => link.id === route.interface)
      ?.enabled,
  }));
}
export function routeLookup(config: NetworkConfig, address: string) {
  try {
    const ip = ipValue(address.trim());
    const route = forwardingTable(config)
      .filter((r) => r.installed && prefixInfo(r.prefix).contains(ip))
      .sort(
        (a, b) =>
          prefixInfo(b.prefix).length - prefixInfo(a.prefix).length ||
          a.metric - b.metric,
      )[0];
    return route
      ? `${route.prefix} → ${route.via} · ${route.interface} · ${route.protocol} · metric ${route.metric}`
      : "No installed route for this address.";
  } catch (e) {
    return (e as Error).message;
  }
}
