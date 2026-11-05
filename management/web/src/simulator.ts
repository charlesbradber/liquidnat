import type { RadiusConfig } from "./RadiusSettings";
import { NetworkConfig, initialNetwork, validateNetwork } from "./network";
export type Status =
  | "online"
  | "suspended"
  | "auth-rejected"
  | "vlan-mismatch"
  | "pool-exhausted";
export type Provider = { id: string; name: string };
export type Profile = {
  provider: string;
  id: string;
  name: string;
  down: number;
  up: number;
  price: number;
  nat: string;
};
export type Subscriber = {
  provider: string;
  id: string;
  name: string;
  username: string;
  circuit: string;
  ip: string;
  ipv6: string;
  ipv6Address: string;
  mac: string;
  addressMode: AddressMode;
  profile: string;
  status: Status;
  vlan: number;
  expectedVlan: number;
  since: string;
  gateway: string;
};
export type Event = {
  id: string;
  at: string;
  category: string;
  title: string;
  detail: string;
  level: "info" | "warning" | "success";
};
export type Job = {
  id: string;
  type: "failover" | "upgrade" | "backup";
  status: "running" | "completed";
  started: number;
  due: number;
  detail: string;
};
export type Mapping = {
  publicIp: string;
  port: number;
  protocol: "TCP" | "UDP";
  subscriber: string;
  privateIp: string;
  privatePort: number;
  started: string;
  ended: string | null;
};
export type AddressMode = "cgnat" | "direct" | "static";
export const addressModeLabel: Record<AddressMode, string> = {
  cgnat: "CGNAT",
  direct: "Direct IPv4",
  static: "Static IPv4",
};
export type Workspace = {
  radius?: RadiusConfig;
  network?: NetworkConfig;
  schema: 2;
  id: string;
  created: number;
  expires: number;
  revision: number;
  active: string;
  version: string;
  subscribers: Subscriber[];
  profiles: Profile[];
  providers: Provider[];
  events: Event[];
  jobs: Job[];
  mappings: Mapping[];
  completed: string[];
  poolCapacity: number;
  poolUsed: number;
  poolExpanded: boolean;
  backupAt: string | null;
  mfa: boolean;
  retention: number;
};
export type Action =
  | { type: "create-profile"; name: string; down: number; up: number }
  | { type: "radius-save"; config: RadiusConfig }
  | { type: "network-save"; config: NetworkConfig }
  | {
      type: "create";
      name: string;
      username: string;
      profile: string;
      provider?: string;
    }
  | { type: "save-provider"; id?: string; name: string }
  | { type: "delete-provider"; id: string }
  | {
      type: "save-profile";
      id?: string;
      name: string;
      provider: string;
      down: number;
      up: number;
      price: number;
    }
  | { type: "delete-profile"; id: string }
  | { type: "profile"; id: string; profile: string; provider?: string }
  | { type: "addressing"; id: string; mode: AddressMode; staticIp?: string }
  | { type: "suspend" | "restore" | "fix-auth" | "fix-vlan"; id: string }
  | {
      type:
        | "expand-pool"
        | "failover"
        | "upgrade"
        | "rollback"
        | "backup"
        | "mapping-viewed";
    }
  | { type: "settings"; mfa: boolean; retention: number };
export const TTL = 2 * 60 * 60 * 1000;
export const DEMO_SUBSCRIBERS = 12864;
export const MAX_SUBSCRIBERS = 15000;
export const STORAGE_KEY = "liquidnat-demo-v2";
export function subscriberIp(index: number, mode: AddressMode) {
  const value = index + 10;
  const prefix =
    mode === "cgnat" ? "100.64" : mode === "static" ? "198.18" : "198.19";
  return `${prefix}.${Math.floor(value / 254)}.${(value % 254) + 1}`;
}
export function subscriberMac(index: number) {
  return `02:4c:4e:${index.toString(16).padStart(6, "0").match(/../g)!.join(":")}`;
}
const iso = (now: number) => new Date(now).toISOString();
export const uid = () => crypto.randomUUID();
export function validateStaticIp(value: string): string {
  const ip = value.trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
    throw new DemoError("VALIDATION", "Enter a valid IPv4 address.");
  const octets = ip.split(".").map(Number);
  if (octets.some((n) => n > 255) || octets[3] === 0 || octets[3] === 255)
    throw new DemoError(
      "VALIDATION",
      "Use a host address, not a network or broadcast address.",
    );
  const [a, b, c] = octets;
  if (
    !(
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    )
  )
    throw new DemoError(
      "VALIDATION",
      "Use an address from the configured pools: 198.18.0.0/15, 192.0.2.0/24, 198.51.100.0/24, or 203.0.113.0/24.",
    );
  return octets.join(".");
}
export function subscriberPrefix(index: number) {
  const third = Math.floor(index / 256).toString(16),
    fourth = ((index % 256) * 256).toString(16);
  return fourth === "0"
    ? third === "0"
      ? "2001:db8::/56"
      : `2001:db8:${third}::/56`
    : `2001:db8:${third}:${fourth}::/56`;
}
const normalizedQueries = new Map<string, string>();
function normalizedIpv6(value: string) {
  const cached = normalizedQueries.get(value);
  if (cached) return cached;
  let result: string;
  try {
    result = new URL(`http://[${value.split("/")[0]}]/`).hostname;
  } catch {
    result = value.toLowerCase();
  }
  if (normalizedQueries.size >= 32)
    normalizedQueries.delete(normalizedQueries.keys().next().value!);
  normalizedQueries.set(value, result);
  return result;
}
export function matchesSubscriber(sub: Subscriber, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    sub.name,
    sub.username,
    sub.circuit,
    sub.ip,
    sub.ipv6,
    sub.ipv6Address,
    sub.mac,
    sub.id,
    addressModeLabel[sub.addressMode],
  ];
  if (fields.some((v) => v.toLowerCase().includes(q))) return true;
  const mac = q.replace(/[:.\-]/g, "");
  if (
    mac.length >= 4 &&
    /^[a-f0-9]+$/.test(mac) &&
    sub.mac.replaceAll(":", "").includes(mac)
  )
    return true;
  return (
    q.includes(":") &&
    (normalizedIpv6(q) === `[${sub.ipv6Address}]` ||
      normalizedIpv6(q) === `[${sub.ipv6.split("/")[0]}]`)
  );
}
export function querySubscribers(
  s: Workspace,
  query = "",
  offset = 0,
  limit = 10,
  status = "all",
  mode = "all",
) {
  const matches = s.subscribers.filter(
    (sub) =>
      matchesSubscriber(sub, query) &&
      (status === "all" ||
        (status === "issues"
          ? !["online", "suspended"].includes(sub.status)
          : sub.status === status)) &&
      (mode === "all" || sub.addressMode === mode),
  );
  return {
    items: matches.slice(
      Math.max(0, offset),
      Math.max(0, offset) + Math.min(50, Math.max(1, limit)),
    ),
    total: matches.length,
  };
}
export function seed(now = Date.now(), id: string = uid()): Workspace {
  const first = [
    "Alex",
    "Sam",
    "Morgan",
    "Taylor",
    "Charlie",
    "Jamie",
    "Robin",
    "Casey",
    "Rowan",
    "Avery",
    "Drew",
    "Cameron",
  ];
  const last = [
    "Bennett",
    "Clarke",
    "Ellis",
    "Foster",
    "Hayes",
    "James",
    "Lane",
    "Mason",
    "Parker",
    "Reed",
    "Stone",
  ];
  const profiles = [
    {
      provider: "examplenet",
      id: "home100",
      name: "Essential 100",
      down: 100,
      up: 20,
      price: 25,
      nat: "Per-subscriber IPv4 + IPv6",
    },
    {
      provider: "examplenet",
      id: "home500",
      name: "Fibre 500",
      down: 500,
      up: 100,
      price: 39,
      nat: "Per-subscriber IPv4 + IPv6",
    },
    {
      provider: "examplenet",
      id: "home1000",
      name: "Gigabit",
      down: 1000,
      up: 200,
      price: 55,
      nat: "Per-subscriber IPv4 + IPv6",
    },
  ];
  const subscribers: Subscriber[] = Array.from(
    { length: DEMO_SUBSCRIBERS },
    (_, i) => ({
      provider: "examplenet",
      id: `sub-${String(i + 1).padStart(4, "0")}`,
      name: `${first[i % 12]} ${last[Math.floor(i / 12) % 11]}`,
      username: `subscriber${String(i + 1).padStart(3, "0")}@liquidnet.net`,
      circuit: `LN-${String(i + 1).padStart(5, "0")}`,
      ip: subscriberIp(
        i,
        i % 10 === 9 ? "static" : i % 10 >= 7 ? "direct" : "cgnat",
      ),
      ipv6: subscriberPrefix(i),
      ipv6Address: `2001:db8:ffff:${(i + 1).toString(16)}::2`,
      mac: subscriberMac(i),
      addressMode: i % 10 === 9 ? "static" : i % 10 >= 7 ? "direct" : "cgnat",
      profile: profiles[i % 3].id,
      status: "online",
      vlan: 200,
      expectedVlan: 200,
      since: iso(now - (i + 1) * 270000),
      gateway: "gateway-01",
    }),
  );
  Object.assign(subscribers[125], {
    name: "Jordan Avery",
    status: "auth-rejected",
    ip: "—",
  });
  Object.assign(subscribers[126], {
    name: "Riley Morgan",
    status: "vlan-mismatch",
    vlan: 201,
    ip: "—",
  });
  Object.assign(subscribers[127], {
    name: "Quinn Taylor",
    status: "pool-exhausted",
    ip: "—",
    addressMode: "cgnat",
  });
  return {
    network: initialNetwork(),
    schema: 2,
    id,
    created: now,
    expires: now + TTL,
    revision: 1,
    active: "gateway-01",
    version: "0.2.0",
    subscribers,
    profiles,
    providers: [{ id: "examplenet", name: "LiquidNet" }],
    events: [
      {
        id: "evt-3",
        at: iso(now - 30000),
        category: "Access",
        title: "Circuit VLAN mismatch",
        detail: "LN-00127 arrived on VLAN 201; configured service VLAN is 200.",
        level: "warning",
      },
      {
        id: "evt-2",
        at: iso(now - 120000),
        category: "CGNAT",
        title: "Address pool at capacity",
        detail:
          "New admission blocked for Quinn Taylor. Existing sessions are unaffected.",
        level: "warning",
      },
      {
        id: "evt-1",
        at: iso(now - 180000),
        category: "RADIUS",
        title: "Authentication rejected",
        detail: "Jordan Avery · invalid credentials · Access-Reject.",
        level: "warning",
      },
    ],
    jobs: [],
    completed: [],
    poolCapacity: subscribers.filter((s) => s.addressMode === "cgnat").length,
    poolUsed: subscribers.filter((s) => s.addressMode === "cgnat").length,
    poolExpanded: false,
    backupAt: null,
    mfa: false,
    retention: 30,
    mappings: [
      {
        publicIp: "203.0.113.10",
        port: 40012,
        protocol: "TCP",
        subscriber: "sub-0001",
        privateIp: subscribers[0].ip,
        privatePort: 52140,
        started: iso(now - 3600000),
        ended: null,
      },
      {
        publicIp: "203.0.113.10",
        port: 40013,
        protocol: "UDP",
        subscriber: "sub-0002",
        privateIp: subscribers[1].ip,
        privatePort: 51820,
        started: iso(now - 1800000),
        ended: null,
      },
      ...subscribers
        .filter(
          (sub, i) =>
            i > 1 && sub.addressMode === "cgnat" && sub.status === "online",
        )
        .map((sub) => ({
          publicIp: "203.0.113.11",
          port: 20000 + Number(sub.id.slice(4)),
          protocol: "TCP" as const,
          subscriber: sub.id,
          privateIp: sub.ip,
          privatePort: 51000 + (Number(sub.id.slice(4)) % 10000),
          started: iso(now - 3600000),
          ended: null,
        })),
    ],
  };
}
export class DemoError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function event(
  s: Workspace,
  category: string,
  title: string,
  detail: string,
  now: number,
  level: Event["level"] = "success",
) {
  s.events.unshift({ id: uid(), at: iso(now), category, title, detail, level });
  s.events = s.events.slice(0, 100);
}
function complete(s: Workspace, scenario: string) {
  if (!s.completed.includes(scenario)) s.completed.push(scenario);
}
export function apply(
  source: Workspace,
  action: Action,
  expectedRevision: number,
  now = Date.now(),
): Workspace {
  if (source.expires <= now)
    throw new DemoError(
      "WORKSPACE_EXPIRED",
      "Your session expired. Reset the workspace to start again.",
    );
  if (source.revision !== expectedRevision)
    throw new DemoError(
      "REVISION_CONFLICT",
      "The configuration changed. Review it again before applying.",
    );
  // Copy bounded collections, then only the subscriber or mapping being changed.
  // Full 12k-row clones on every audit-only mutation would make the demo sluggish.
  const s: Workspace = {
    ...source,
    subscribers: source.subscribers.slice(),
    events: source.events.slice(),
    jobs: source.jobs.slice(),
    mappings: source.mappings.slice(),
    completed: source.completed.slice(),
  };
  const find = (id: string) => {
    const index = s.subscribers.findIndex((x) => x.id === id);
    if (index < 0)
      throw new DemoError(
        "NOT_FOUND",
        "Subscriber not found in this workspace.",
      );
    const sub = { ...s.subscribers[index] };
    s.subscribers[index] = sub;
    return sub;
  };
  const profile = (id: string) => {
    const p = s.profiles.find((x) => x.id === id);
    if (!p)
      throw new DemoError("INVALID_PROFILE", "Choose a valid service profile.");
    return p;
  };
  const requireProvider = (id: string) => {
    if (!s.providers.some((p) => p.id === id))
      throw new DemoError(
        "INVALID_PROVIDER",
        "Choose a valid network provider.",
      );
    return id;
  };
  const selectedProvider = (profileId: string, providerId?: string) => {
    const p = profile(profileId);
    const id = requireProvider(providerId ?? p.provider);
    if (p.provider !== id)
      throw new DemoError(
        "PROVIDER_MISMATCH",
        "Choose a service profile belonging to this network provider.",
      );
    return id;
  };
  const validName = (name: string) => {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 64
    )
      throw new DemoError("VALIDATION", "Enter a name using 2–64 characters.");
    return name.trim();
  };
  if (action.type === "radius-save") {
    const c = action.config;
    const hostname = (value: string) =>
      typeof value === "string" &&
      value.length <= 253 &&
      /^[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*$/.test(value);
    if (
      !c ||
      !hostname(c.primary) ||
      !hostname(c.secondary) ||
      !hostname(c.realm) ||
      !Number.isInteger(c.accountingInterval) ||
      c.accountingInterval < 60 ||
      c.accountingInterval > 3600
    )
      throw new DemoError(
        "VALIDATION",
        "Use valid hostnames and an accounting interval from 60 to 3600 seconds.",
      );
    validateNetwork({
      interfaces: [
        {
          id: "radius",
          role: "RADIUS clients",
          address: c.clientNetwork,
          mtu: 1500,
          enabled: true,
        },
      ],
      routes: [],
    });
    s.radius = { ...c };
    event(
      s,
      "RADIUS",
      "RADIUS configuration saved",
      `${c.primary} · realm ${c.realm} · accounting every ${c.accountingInterval}s.`,
      now,
    );
  } else if (action.type === "network-save") {
    s.network = structuredClone(validateNetwork(action.config));
    event(
      s,
      "Network",
      "Network configuration saved",
      `${s.network.interfaces.length} interfaces · ${s.network.routes.length} static routes.`,
      now,
    );
  } else if (action.type === "save-provider") {
    const name = validName(action.name);
    if (action.id && !s.providers.some((p) => p.id === action.id))
      throw new DemoError("NOT_FOUND", "Network provider not found.");
    if (
      s.providers.some(
        (p) =>
          p.id !== action.id && p.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new DemoError("DUPLICATE", "That network provider already exists.");
    if (!action.id && s.providers.length >= 100)
      throw new DemoError(
        "CAPACITY",
        "Capacity is limited to 100 network providers.",
      );
    s.providers = action.id
      ? s.providers.map((p) => (p.id === action.id ? { ...p, name } : p))
      : [...s.providers, { id: uid(), name }];
    event(
      s,
      "Providers",
      action.id ? "Network provider updated" : "Network provider added",
      name,
      now,
    );
  } else if (action.type === "delete-provider") {
    requireProvider(action.id);
    if (
      s.providers.length === 1 ||
      s.profiles.some((p) => p.provider === action.id) ||
      s.subscribers.some((p) => p.provider === action.id)
    )
      throw new DemoError(
        "IN_USE",
        "Keep at least one provider. Remove its profiles and move its subscribers before deleting it.",
      );
    const name = s.providers.find((p) => p.id === action.id)!.name;
    s.providers = s.providers.filter((p) => p.id !== action.id);
    event(s, "Providers", "Network provider deleted", name, now);
  } else if (action.type === "save-profile") {
    const name = validName(action.name);
    requireProvider(action.provider);
    if (
      ![action.down, action.up].every(
        (n) => Number.isFinite(n) && n > 0 && n <= 100000,
      ) ||
      !Number.isFinite(action.price) ||
      action.price < 0 ||
      action.price > 100000
    )
      throw new DemoError(
        "VALIDATION",
        "Enter speeds above 0 and up to 100,000 Mb/s, and a price from 0 to 100,000.",
      );
    if (action.id) {
      const old = profile(action.id);
      if (
        old.provider !== action.provider &&
        s.subscribers.some((sub) => sub.profile === old.id)
      )
        throw new DemoError(
          "IN_USE",
          "Move assigned subscribers before changing this profile's provider.",
        );
    } else if (s.profiles.length >= 300)
      throw new DemoError(
        "CAPACITY",
        "Capacity is limited to 300 service profiles.",
      );
    if (
      s.profiles.some(
        (p) =>
          p.id !== action.id &&
          p.provider === action.provider &&
          p.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new DemoError(
        "DUPLICATE",
        "That service profile already exists for this provider.",
      );
    const saved: Profile = {
      id: action.id || uid(),
      name,
      provider: action.provider,
      down: action.down,
      up: action.up,
      price: action.price,
      nat: "Per-subscriber IPv4 + IPv6",
    };
    s.profiles = action.id
      ? s.profiles.map((p) => (p.id === action.id ? saved : p))
      : [...s.profiles, saved];
    event(
      s,
      "Profiles",
      action.id ? "Service profile updated" : "Service profile added",
      name,
      now,
    );
  } else if (action.type === "delete-profile") {
    const p = profile(action.id);
    if (s.subscribers.some((sub) => sub.profile === p.id))
      throw new DemoError(
        "IN_USE",
        "Move assigned subscribers before deleting this service profile.",
      );
    s.profiles = s.profiles.filter((item) => item.id !== p.id);
    event(s, "Profiles", "Service profile deleted", p.name, now);
  } else if (action.type === "create-profile") {
    const name = action.name.trim();
    if (!/^[a-zA-Z0-9 .+'-]{2,48}$/.test(name))
      throw new DemoError(
        "VALIDATION",
        "Use a profile name with 2–48 letters, numbers or spaces.",
      );
    if (
      ![action.down, action.up].every(
        (v) => Number.isInteger(v) && v >= 1 && v <= 100000,
      )
    )
      throw new DemoError(
        "VALIDATION",
        "Speeds must be whole numbers between 1 and 100,000 Mb/s.",
      );
    if (s.profiles.length >= 32)
      throw new DemoError(
        "CAPACITY",
        "This workspace supports up to 32 service profiles.",
      );
    if (s.profiles.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw new DemoError("DUPLICATE", "That profile name is already in use.");
    const created = {
      provider: s.providers[0].id,
      id: `profile-${uid()}`,
      name,
      down: action.down,
      up: action.up,
      price: 0,
      nat: "Per-subscriber IPv4 + IPv6",
    };
    s.profiles = [...s.profiles, created];
    event(
      s,
      "Profiles",
      "Service profile created",
      `${name} · ${action.down}/${action.up} Mb/s · service policy. Existing subscribers unchanged.`,
      now,
    );
  } else if (action.type === "create") {
    if (s.subscribers.length >= MAX_SUBSCRIBERS)
      throw new DemoError(
        "CAPACITY",
        "Subscriber capacity is limited to 15,000 services.",
      );
    if (!/^[a-zA-Z0-9 .'-]{2,64}$/.test(action.name.trim()))
      throw new DemoError(
        "VALIDATION",
        "Enter a name using 2–64 letters, spaces, apostrophes or hyphens.",
      );
    if (
      !/^[a-zA-Z0-9._-]{2,48}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
        action.username,
      )
    )
      throw new DemoError(
        "VALIDATION",
        "Enter a unique RADIUS username with a valid realm.",
      );
    if (
      s.subscribers.some(
        (x) => x.username.toLowerCase() === action.username.toLowerCase(),
      )
    )
      throw new DemoError("DUPLICATE", "That username is already in use.");
    const provider = selectedProvider(action.profile, action.provider);
    const i = s.subscribers.length + 1;
    s.subscribers.unshift({
      id: `sub-${String(i).padStart(4, "0")}`,
      name: action.name.trim(),
      username: action.username.toLowerCase(),
      circuit: `LN-${String(i).padStart(5, "0")}`,
      ip: subscriberIp(i - 1, "direct"),
      ipv6: subscriberPrefix(i - 1),
      ipv6Address: `2001:db8:ffff:${i.toString(16)}::2`,
      mac: subscriberMac(i - 1),
      addressMode: "direct",
      provider,
      profile: action.profile,
      status: "online",
      vlan: 200,
      expectedVlan: 200,
      since: iso(now),
      gateway: s.active,
    });
    complete(s, "first");
    event(
      s,
      "Subscribers",
      "Subscriber connected",
      `${action.name.trim()} · policy revision ${s.revision + 1} · Access-Accept.`,
      now,
    );
  } else if (action.type === "addressing") {
    const sub = find(action.id);
    if (!["cgnat", "direct", "static"].includes(action.mode))
      throw new DemoError("VALIDATION", "Choose a valid IPv4 mode.");
    const index = Number(sub.id.replace("sub-", "")) - 1;
    const nextIp =
      action.mode === "static"
        ? validateStaticIp(action.staticIp || "")
        : subscriberIp(index, action.mode);
    if (
      s.subscribers.some((other) => other.id !== sub.id && other.ip === nextIp)
    )
      throw new DemoError(
        "ADDRESS_IN_USE",
        "That IPv4 address is already assigned to another subscriber.",
      );
    if (
      sub.addressMode !== "cgnat" &&
      action.mode === "cgnat" &&
      s.poolUsed >= s.poolCapacity
    )
      throw new DemoError(
        "CAPACITY",
        "CGNAT pool is full. Expand capacity in CGNAT before moving this service.",
      );
    if (sub.addressMode === action.mode && sub.ip === nextIp)
      throw new DemoError(
        "INVALID_STATE",
        "This subscriber already has that addressing configuration.",
      );
    const oldMode = sub.addressMode,
      oldIp = sub.ip;
    s.mappings = s.mappings.map((mapping) =>
      mapping.subscriber === sub.id && !mapping.ended
        ? { ...mapping, ended: iso(now) }
        : mapping,
    );
    if (oldMode === "cgnat" && action.mode !== "cgnat") s.poolUsed--;
    if (oldMode !== "cgnat" && action.mode === "cgnat") s.poolUsed++;
    sub.addressMode = action.mode;
    sub.ip = nextIp;
    if (sub.status === "pool-exhausted" && action.mode !== "cgnat") {
      sub.status = "online";
      complete(s, "pool");
    }
    if (action.mode === "cgnat") {
      if (s.mappings.length >= 20000)
        throw new DemoError(
          "CAPACITY",
          "Mapping history is full. Reset the workspace to continue.",
        );
      let port = 40000 + index;
      while (
        s.mappings.some(
          (m) =>
            !m.ended &&
            m.publicIp === "203.0.113.10" &&
            m.port === port &&
            m.protocol === "TCP",
        )
      )
        port++;
      s.mappings.push({
        publicIp: "203.0.113.10",
        port,
        protocol: "TCP",
        subscriber: sub.id,
        privateIp: nextIp,
        privatePort: 52000 + (index % 10000),
        started: iso(now),
        ended: null,
      });
    }
    event(
      s,
      "Addressing",
      "Subscriber addressing changed",
      `${sub.name}: ${addressModeLabel[oldMode]} (${oldIp}) → ${addressModeLabel[action.mode]} (${nextIp}). IPv4 reconnect; existing NAT mappings closed, IPv6 prefix retained.`,
      now,
    );
  } else if (action.type === "profile") {
    const sub = find(action.id),
      p = profile(action.profile);
    sub.provider = selectedProvider(action.profile, action.provider);
    sub.profile = p.id;
    complete(s, "package");
    event(
      s,
      "Policy",
      "Service profile applied",
      `${sub.name} → ${p.name} (${p.down}/${p.up} Mb/s). CoA acknowledged; session retained.`,
      now,
    );
  } else if (
    ["suspend", "restore", "fix-auth", "fix-vlan"].includes(action.type)
  ) {
    const a = action as Extract<Action, { id: string }>,
      sub = find(a.id);
    if (action.type === "suspend") {
      sub.status = "suspended";
      event(
        s,
        "Subscribers",
        "Service suspended",
        `${sub.name} · IPv4 and IPv6 blocked by suspended policy.`,
        now,
      );
    } else if (action.type === "restore") {
      if (sub.status !== "suspended")
        throw new DemoError(
          "INVALID_STATE",
          "Only suspended services can be restored.",
        );
      sub.status = "online";
      complete(s, "suspension");
      event(
        s,
        "Subscribers",
        "Service restored",
        `${sub.name} · dual-stack access restored.`,
        now,
      );
    } else if (action.type === "fix-auth") {
      if (sub.status !== "auth-rejected")
        throw new DemoError(
          "INVALID_STATE",
          "No credential rejection to resolve.",
        );
      sub.status = "online";
      if (sub.addressMode !== "static" || sub.ip === "—")
        sub.ip = subscriberIp(
          Number(sub.id.replace("sub-", "")) - 1,
          sub.addressMode,
        );
      complete(s, "password");
      event(
        s,
        "RADIUS",
        "Authentication recovered",
        `${sub.name} · credential reset and Access-Accept.`,
        now,
      );
    } else {
      if (sub.status !== "vlan-mismatch")
        throw new DemoError("INVALID_STATE", "No VLAN mismatch to resolve.");
      sub.vlan = sub.expectedVlan;
      sub.status = "online";
      if (sub.addressMode !== "static" || sub.ip === "—")
        sub.ip = subscriberIp(
          Number(sub.id.replace("sub-", "")) - 1,
          sub.addressMode,
        );
      complete(s, "vlan");
      event(
        s,
        "Network",
        "Circuit VLAN corrected",
        `${sub.circuit} → VLAN ${sub.expectedVlan}; session re-established.`,
        now,
      );
    }
  } else if (action.type === "expand-pool") {
    if (s.poolExpanded)
      throw new DemoError(
        "INVALID_STATE",
        "The pool is already at its configured maximum.",
      );
    const previousCapacity = s.poolCapacity;
    s.poolCapacity = 16384;
    s.poolExpanded = true;
    s.subscribers = s.subscribers.map((sub) =>
      sub.status === "pool-exhausted"
        ? {
            ...sub,
            status: "online",
            ip: subscriberIp(Number(sub.id.slice(4)) - 1, sub.addressMode),
          }
        : sub,
    );
    complete(s, "pool");
    event(
      s,
      "CGNAT",
      "Pool capacity expanded",
      `Subscriber admission capacity ${previousCapacity.toLocaleString()} → 16,384. Existing mappings retained.`,
      now,
    );
  } else if (
    action.type === "failover" ||
    action.type === "upgrade" ||
    action.type === "backup"
  ) {
    if (s.jobs.some((x) => x.status === "running"))
      throw new DemoError(
        "JOB_RUNNING",
        "Wait for the current operation to finish.",
      );
    if (action.type === "upgrade" && s.version === "0.2.1")
      throw new DemoError(
        "INVALID_STATE",
        "This version is already installed.",
      );
    const detail =
      action.type === "failover"
        ? "Fencing → standby promotion → session reconciliation"
        : action.type === "upgrade"
          ? "Preflight → backup → stage image → health checks"
          : "Snapshot desired configuration and workspace";
    s.jobs.unshift({
      id: uid(),
      type: action.type,
      status: "running",
      started: now,
      due: now + 6000,
      detail,
    });
    s.jobs = s.jobs.slice(0, 20);
    event(
      s,
      "Operations",
      `${action.type} started`,
      `${detail}. Configuration job queued.`,
      now,
      "info",
    );
  } else if (action.type === "rollback") {
    if (s.version !== "0.2.1")
      throw new DemoError("INVALID_STATE", "There is no upgrade to roll back.");
    s.version = "0.2.0";
    event(
      s,
      "Operations",
      "Upgrade rolled back",
      "Previous version restored.",
      now,
    );
  } else if (action.type === "mapping-viewed") {
    complete(s, "mapping");
    event(
      s,
      "CGNAT",
      "Mapping attribution inspected",
      "Public tuple lookup completed.",
      now,
      "info",
    );
  } else if (action.type === "settings") {
    if (![7, 30, 90].includes(action.retention))
      throw new DemoError("VALIDATION", "Choose 7, 30 or 90 days.");
    s.mfa = action.mfa;
    s.retention = action.retention;
    event(
      s,
      "Administration",
      "Administration settings saved",
      "MFA policy and retention preference updated in this workspace only.",
      now,
    );
  }
  s.revision++;
  return s;
}
export function parseAction(value: unknown): Action {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DemoError("VALIDATION", "Action must be an object.");
  const a = value as Record<string, unknown>;
  const text = (key: string, max = 64) => {
    if (typeof a[key] !== "string" || (a[key] as string).length > max)
      throw new DemoError("VALIDATION", `Invalid ${key}.`);
    return a[key] as string;
  };
  const type = text("type", 32);
  if (type === "create-profile") {
    if (typeof a.down !== "number" || typeof a.up !== "number")
      throw new DemoError("VALIDATION", "Speeds must be numbers.");
    return { type, name: text("name", 48), down: a.down, up: a.up };
  }
  if (type === "radius-save") return { type, config: a.config as RadiusConfig };
  if (type === "network-save")
    return { type, config: validateNetwork(a.config as NetworkConfig) };
  if (type === "create")
    return {
      type,
      name: text("name"),
      username: text("username", 64),
      profile: text("profile"),
      ...(a.provider !== undefined ? { provider: text("provider") } : {}),
    };
  if (type === "profile")
    return {
      type,
      id: text("id"),
      profile: text("profile"),
      ...(a.provider !== undefined ? { provider: text("provider") } : {}),
    };
  if (type === "save-provider")
    return {
      type,
      name: text("name"),
      ...(a.id !== undefined ? { id: text("id") } : {}),
    };
  if (type === "delete-provider" || type === "delete-profile")
    return { type, id: text("id") };
  if (type === "save-profile") {
    if (
      ![a.down, a.up, a.price].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      )
    )
      throw new DemoError("VALIDATION", "Invalid service profile values.");
    return {
      type,
      name: text("name"),
      provider: text("provider"),
      down: a.down as number,
      up: a.up as number,
      price: a.price as number,
      ...(a.id !== undefined ? { id: text("id") } : {}),
    };
  }
  if (type === "addressing") {
    const mode = text("mode");
    if (!["cgnat", "direct", "static"].includes(mode))
      throw new DemoError("VALIDATION", "Invalid IPv4 mode.");
    return {
      type,
      id: text("id"),
      mode: mode as AddressMode,
      ...(mode === "static" ? { staticIp: text("staticIp", 32) } : {}),
    };
  }
  if (
    type === "suspend" ||
    type === "restore" ||
    type === "fix-auth" ||
    type === "fix-vlan"
  )
    return { type, id: text("id") };
  if (
    [
      "expand-pool",
      "failover",
      "upgrade",
      "rollback",
      "backup",
      "mapping-viewed",
    ].includes(type)
  )
    return { type } as Action;
  if (
    type === "settings" &&
    typeof a.mfa === "boolean" &&
    typeof a.retention === "number"
  )
    return { type, mfa: a.mfa, retention: a.retention };
  throw new DemoError("VALIDATION", "Unknown or invalid action.");
}
export function tick(source: Workspace, now = Date.now()): Workspace {
  if (!source.jobs.some((j) => j.status === "running" && j.due <= now))
    return source;
  const s = structuredClone(source);
  for (const j of s.jobs)
    if (j.status === "running" && j.due <= now) {
      j.status = "completed";
      if (j.type === "failover") {
        s.active = s.active === "gateway-01" ? "gateway-02" : "gateway-01";
        s.subscribers.forEach((x) => {
          if (x.status === "online") x.gateway = s.active;
        });
        complete(s, "failover");
      }
      if (j.type === "upgrade") {
        s.version = "0.2.1";
        s.backupAt = iso(now);
        complete(s, "upgrade");
      }
      if (j.type === "backup") s.backupAt = iso(now);
      event(
        s,
        "Operations",
        `${j.type} completed`,
        j.type === "failover"
          ? `${s.active} is active. Subscriber sessions reconciled.`
          : j.type === "upgrade"
            ? "Version 0.2.1 staged and healthy. Rollback is available."
            : "Configuration snapshot ready to export.",
        now,
      );
    }
  s.revision++;
  return s;
}
export type PackedWorkspace = Omit<Workspace, "subscribers" | "mappings"> & {
  compact: true;
  subscriberChanges: Subscriber[];
  mappingChanges: Mapping[];
};
const mappingKey = (m: Mapping) =>
  `${m.publicIp}:${m.port}/${m.protocol}/${m.started}`;
const baselines = new Map<
  string,
  { subscribers: Map<string, Subscriber>; mappings: Map<string, Mapping> }
>();
export function pack(s: Workspace): PackedWorkspace {
  const key = `${s.id}/${s.created}`;
  let baseline = baselines.get(key);
  if (!baseline) {
    const base = seed(s.created, s.id);
    baseline = {
      subscribers: new Map(base.subscribers.map((sub) => [sub.id, sub])),
      mappings: new Map(base.mappings.map((m) => [mappingKey(m), m])),
    };
    if (baselines.size >= 2) baselines.delete(baselines.keys().next().value!);
    baselines.set(key, baseline);
  }
  const originals = baseline.subscribers,
    mappings = baseline.mappings;
  const { subscribers, mappings: allMappings, ...metadata } = s;
  return {
    ...metadata,
    compact: true,
    subscriberChanges: subscribers.filter((sub) => {
      const original = originals.get(sub.id);
      return (
        !original ||
        (Object.keys(original) as (keyof Subscriber)[]).some(
          (key) => key !== "gateway" && original[key] !== sub[key],
        )
      );
    }),
    mappingChanges: allMappings.filter((m) => {
      const original = mappings.get(mappingKey(m));
      return (
        !original ||
        (Object.keys(original) as (keyof Mapping)[]).some(
          (key) => original[key] !== m[key],
        )
      );
    }),
  };
}
export function unpack(value: PackedWorkspace): Workspace {
  if (
    !value ||
    value.schema !== 2 ||
    value.compact !== true ||
    typeof value.id !== "string" ||
    !Number.isFinite(value.created) ||
    !Array.isArray(value.subscriberChanges) ||
    value.subscriberChanges.length > MAX_SUBSCRIBERS ||
    !Array.isArray(value.mappingChanges) ||
    value.mappingChanges.length > 20000 ||
    !Array.isArray(value.events) ||
    value.events.length > 100 ||
    !Array.isArray(value.jobs) ||
    value.jobs.length > 20 ||
    !Array.isArray(value.completed)
  )
    throw new DemoError("VALIDATION", "Invalid stored workspace.");
  const base = seed(value.created, value.id);
  value = {
    ...value,
    providers: value.providers ?? base.providers,
    profiles: value.profiles.map((p) => ({
      ...p,
      provider: p.provider ?? "examplenet",
    })),
    subscriberChanges: value.subscriberChanges.map((sub) => ({
      ...sub,
      provider: sub.provider ?? "examplenet",
    })),
  };
  if (
    !Array.isArray(value.providers) ||
    value.providers.length < 1 ||
    value.providers.length > 100 ||
    value.profiles.length > 300 ||
    new Set(value.providers.map((p) => p.id)).size !== value.providers.length ||
    new Set(value.profiles.map((p) => p.id)).size !== value.profiles.length ||
    value.providers.some(
      (p) =>
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        p.name.trim().length < 2 ||
        p.name.length > 64,
    ) ||
    value.profiles.some(
      (p) => !value.providers.some((provider) => provider.id === p.provider),
    )
  )
    throw new DemoError(
      "VALIDATION",
      "Invalid provider or service profile state.",
    );
  const changes = new Map(value.subscriberChanges.map((sub) => [sub.id, sub]));
  const known = new Set(base.subscribers.map((sub) => sub.id));
  const subscribers = [
    ...value.subscriberChanges.filter((sub) => !known.has(sub.id)),
    ...base.subscribers.map((sub) => changes.get(sub.id) || sub),
  ];
  if (
    subscribers.length > MAX_SUBSCRIBERS ||
    subscribers.some(
      (sub) =>
        !value.profiles.some(
          (p) => p.id === sub.profile && p.provider === sub.provider,
        ) ||
        typeof sub.name !== "string" ||
        typeof sub.mac !== "string" ||
        typeof sub.ipv6Address !== "string" ||
        !["cgnat", "direct", "static"].includes(sub.addressMode),
    )
  )
    throw new DemoError("VALIDATION", "Invalid subscriber state.");
  for (const sub of subscribers)
    if (sub.status === "online") sub.gateway = value.active;
  const mappingChanges = new Map(
    value.mappingChanges.map((m) => [mappingKey(m), m]),
  );
  const knownMappings = new Set(base.mappings.map(mappingKey));
  const mappings = [
    ...base.mappings.map((m) => mappingChanges.get(mappingKey(m)) || m),
    ...value.mappingChanges.filter((m) => !knownMappings.has(mappingKey(m))),
  ];
  const {
    compact,
    subscriberChanges,
    mappingChanges: ignored,
    ...metadata
  } = value;
  return { ...metadata, subscribers, mappings };
}
export function load(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): Workspace {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw && raw.length < 1000000) {
      const s = unpack(JSON.parse(raw));
      return { ...s, expires: now + TTL };
    }
  } catch {
    /* A corrupt or unavailable browser store creates a fresh, in-memory workspace. */
  }
  const s = seed(now);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(pack(s)));
  } catch {
    /* In-memory fallback is explicit in the UI. */
  }
  return s;
}
export const statusLabel: Record<Status, string> = {
  online: "Connected",
  suspended: "Suspended",
  "auth-rejected": "Auth rejected",
  "vlan-mismatch": "VLAN mismatch",
  "pool-exhausted": "Pool exhausted",
};
export const scenarios = [
  {
    id: "first",
    title: "Connect a subscriber",
    description:
      "Create a service, assign Fibre 500, and follow a successful session.",
    area: "subscribers",
    time: "1 min",
  },
  {
    id: "password",
    title: "Investigate a RADIUS rejection",
    description: "Trace Jordan Avery’s failed login and reset authentication.",
    area: "diagnostics",
    time: "1 min",
  },
  {
    id: "vlan",
    title: "Fix a circuit VLAN",
    description:
      "Find a handoff mismatch, review the change, and recover service.",
    area: "diagnostics",
    time: "1 min",
  },
  {
    id: "pool",
    title: "Resolve pool exhaustion",
    description: "Expand capacity without interrupting existing subscribers.",
    area: "cgnat",
    time: "1 min",
  },
  {
    id: "package",
    title: "Change a service package",
    description: "Apply a profile and inspect the CoA and audit trail.",
    area: "subscribers",
    time: "1 min",
  },
  {
    id: "suspension",
    title: "Suspend and restore a service",
    description: "Explore policy enforcement for both IPv4 and IPv6.",
    area: "subscribers",
    time: "1 min",
  },
  {
    id: "failover",
    title: "Manage gateway failover",
    description: "Review cluster health and promote the standby gateway.",
    area: "operations",
    time: "1 min",
  },
  {
    id: "mapping",
    title: "Look up a NAT mapping",
    description: "Attribute a public tuple to its subscriber session.",
    area: "cgnat",
    time: "1 min",
  },
  {
    id: "upgrade",
    title: "Stage an appliance upgrade",
    description:
      "Review preflight checks, backup, health checks, and rollback.",
    area: "operations",
    time: "1 min",
  },
];
export function lookup(
  s: Workspace,
  ip: string,
  port: number,
  protocol: string,
  at: number,
): Mapping[] {
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isFinite(at)
  )
    throw new DemoError(
      "VALIDATION",
      "Enter a valid port (1–65535) and timestamp.",
    );
  return s.mappings.filter(
    (m) =>
      m.publicIp === ip &&
      m.port === port &&
      m.protocol === protocol &&
      Date.parse(m.started) <= at &&
      (!m.ended || Date.parse(m.ended) > at),
  );
}
