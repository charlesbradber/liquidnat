export type Status =
  | "online"
  | "suspended"
  | "auth-rejected"
  | "vlan-mismatch"
  | "pool-exhausted";
export type Profile = {
  id: string;
  name: string;
  down: number;
  up: number;
  price: number;
  nat: string;
};
export type Subscriber = {
  id: string;
  name: string;
  username: string;
  circuit: string;
  ip: string;
  ipv6: string;
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
export type Workspace = {
  schema: 1;
  id: string;
  created: number;
  expires: number;
  revision: number;
  active: string;
  version: string;
  subscribers: Subscriber[];
  profiles: Profile[];
  events: Event[];
  jobs: Job[];
  mappings: Mapping[];
  completed: string[];
  poolCapacity: number;
  poolUsed: number;
  backupAt: string | null;
  mfa: boolean;
  retention: number;
};
export type Action =
  | { type: "create"; name: string; username: string; profile: string }
  | { type: "profile"; id: string; profile: string }
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
export const MAX_SUBSCRIBERS = 250;
export const STORAGE_KEY = "liquidnat-demo-v1";
const iso = (now: number) => new Date(now).toISOString();
export const uid = () => crypto.randomUUID();
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
      id: "home100",
      name: "Essential 100",
      down: 100,
      up: 20,
      price: 25,
      nat: "Shared IPv4 + IPv6",
    },
    {
      id: "home500",
      name: "Fibre 500",
      down: 500,
      up: 100,
      price: 39,
      nat: "Shared IPv4 + IPv6",
    },
    {
      id: "home1000",
      name: "Gigabit",
      down: 1000,
      up: 200,
      price: 55,
      nat: "Shared IPv4 + IPv6",
    },
  ];
  const subscribers: Subscriber[] = Array.from({ length: 128 }, (_, i) => ({
    id: `sub-${String(i + 1).padStart(4, "0")}`,
    name: `${first[i % 12]} ${last[Math.floor(i / 12) % 11]}`,
    username: `subscriber${String(i + 1).padStart(3, "0")}@example.net`,
    circuit: `LN-${String(i + 1).padStart(5, "0")}`,
    ip: `100.64.0.${i + 10}`,
    ipv6: `2001:db8:100:${((i + 1) * 256).toString(16)}::/56`,
    profile: profiles[i % 3].id,
    status: "online",
    vlan: 200,
    expectedVlan: 200,
    since: iso(now - (i + 1) * 270000),
    gateway: "gateway-01",
  }));
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
  });
  return {
    schema: 1,
    id,
    created: now,
    expires: now + TTL,
    revision: 1,
    active: "gateway-01",
    version: "0.2.0-demo",
    subscribers,
    profiles,
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
    poolCapacity: 128,
    poolUsed: 128,
    backupAt: null,
    mfa: false,
    retention: 30,
    mappings: [
      {
        publicIp: "203.0.113.10",
        port: 40012,
        protocol: "TCP",
        subscriber: "sub-0001",
        privateIp: "100.64.0.10",
        privatePort: 52140,
        started: iso(now - 3600000),
        ended: null,
      },
      {
        publicIp: "203.0.113.10",
        port: 40013,
        protocol: "UDP",
        subscriber: "sub-0002",
        privateIp: "100.64.0.11",
        privatePort: 51820,
        started: iso(now - 1800000),
        ended: null,
      },
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
      "Your demo session expired. Reset the workspace to start again.",
    );
  if (source.revision !== expectedRevision)
    throw new DemoError(
      "REVISION_CONFLICT",
      "The configuration changed. Review it again before applying.",
    );
  const s = structuredClone(source);
  const find = (id: string) => {
    const sub = s.subscribers.find((x) => x.id === id);
    if (!sub)
      throw new DemoError(
        "NOT_FOUND",
        "Subscriber not found in this workspace.",
      );
    return sub;
  };
  const profile = (id: string) => {
    const p = s.profiles.find((x) => x.id === id);
    if (!p)
      throw new DemoError("INVALID_PROFILE", "Choose a valid service profile.");
    return p;
  };
  if (action.type === "create") {
    if (s.subscribers.length >= MAX_SUBSCRIBERS)
      throw new DemoError(
        "CAPACITY",
        "This demo is limited to 250 subscribers.",
      );
    if (!/^[a-zA-Z0-9 .'-]{2,64}$/.test(action.name.trim()))
      throw new DemoError(
        "VALIDATION",
        "Enter a name using 2–64 letters, spaces, apostrophes or hyphens.",
      );
    if (!/^[a-zA-Z0-9._-]{2,48}@example\.net$/.test(action.username))
      throw new DemoError(
        "VALIDATION",
        "Use a unique username at example.net.",
      );
    if (
      s.subscribers.some(
        (x) => x.username.toLowerCase() === action.username.toLowerCase(),
      )
    )
      throw new DemoError("DUPLICATE", "That username is already in use.");
    profile(action.profile);
    const i = s.subscribers.length + 1;
    s.subscribers.unshift({
      id: `sub-${String(i).padStart(4, "0")}`,
      name: action.name.trim(),
      username: action.username.toLowerCase(),
      circuit: `LN-${String(i).padStart(5, "0")}`,
      ip: `100.64.1.${i - 128}`,
      ipv6: `2001:db8:200:${((i - 128) * 256).toString(16)}::/56`,
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
      `${action.name.trim()} · policy revision ${s.revision + 1} · simulated Access-Accept.`,
      now,
    );
  } else if (action.type === "profile") {
    const sub = find(action.id),
      p = profile(action.profile);
    sub.profile = p.id;
    complete(s, "package");
    event(
      s,
      "Policy",
      "Service profile applied",
      `${sub.name} → ${p.name} (${p.down}/${p.up} Mb/s). Simulated CoA acknowledged; session retained.`,
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
      sub.ip = "100.64.0.135";
      complete(s, "password");
      event(
        s,
        "RADIUS",
        "Authentication recovered",
        `${sub.name} · simulated credential reset and Access-Accept. No actual password stored.`,
        now,
      );
    } else {
      if (sub.status !== "vlan-mismatch")
        throw new DemoError("INVALID_STATE", "No VLAN mismatch to resolve.");
      sub.vlan = sub.expectedVlan;
      sub.status = "online";
      sub.ip = "100.64.0.136";
      complete(s, "vlan");
      event(
        s,
        "Network",
        "Circuit VLAN corrected",
        `${sub.circuit} → VLAN ${sub.expectedVlan}; simulated session re-established.`,
        now,
      );
    }
  } else if (action.type === "expand-pool") {
    if (s.poolCapacity >= 256)
      throw new DemoError(
        "INVALID_STATE",
        "The demo pool has already been expanded.",
      );
    s.poolCapacity = 256;
    for (const sub of s.subscribers)
      if (sub.status === "pool-exhausted") {
        sub.status = "online";
        sub.ip = "100.64.0.137";
      }
    complete(s, "pool");
    event(
      s,
      "CGNAT",
      "Pool capacity expanded",
      "Subscriber admission capacity 128 → 256. Existing mappings retained.",
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
    if (action.type === "upgrade" && s.version === "0.2.1-demo")
      throw new DemoError(
        "INVALID_STATE",
        "The demo is already on this version.",
      );
    const detail =
      action.type === "failover"
        ? "Fencing → standby promotion → session reconciliation"
        : action.type === "upgrade"
          ? "Preflight → backup → stage image → health checks"
          : "Snapshot desired configuration and demo workspace";
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
      `${detail}. Training simulation only.`,
      now,
      "info",
    );
  } else if (action.type === "rollback") {
    if (s.version !== "0.2.1-demo")
      throw new DemoError(
        "INVALID_STATE",
        "There is no demo upgrade to roll back.",
      );
    s.version = "0.2.0-demo";
    event(
      s,
      "Operations",
      "Upgrade rolled back",
      "Previous demo version restored. No appliance image was modified.",
      now,
    );
  } else if (action.type === "mapping-viewed") {
    complete(s, "mapping");
    event(
      s,
      "CGNAT",
      "Mapping attribution inspected",
      "Fictional tuple lookup completed in this demo workspace.",
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
      "Demo settings saved",
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
  if (type === "create")
    return {
      type,
      name: text("name"),
      username: text("username", 64),
      profile: text("profile"),
    };
  if (type === "profile")
    return { type, id: text("id"), profile: text("profile") };
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
        s.version = "0.2.1-demo";
        s.backupAt = iso(now);
        complete(s, "upgrade");
      }
      if (j.type === "backup") s.backupAt = iso(now);
      event(
        s,
        "Operations",
        `${j.type} completed`,
        j.type === "failover"
          ? `${s.active} is active. Simulated timeline; actual flow/session survival is unmeasured.`
          : j.type === "upgrade"
            ? "Demo version 0.2.1 staged and healthy. Rollback is available."
            : "Demo configuration snapshot ready to export.",
        now,
      );
    }
  s.revision++;
  return s;
}
export function load(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): Workspace {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw && raw.length < 500000) {
      const s = JSON.parse(raw);
      if (
        s.schema === 1 &&
        typeof s.id === "string" &&
        s.expires > now &&
        Array.isArray(s.subscribers) &&
        s.subscribers.length <= MAX_SUBSCRIBERS &&
        Array.isArray(s.profiles) &&
        Array.isArray(s.events) &&
        Array.isArray(s.jobs) &&
        Array.isArray(s.completed)
      )
        return s;
    }
  } catch {
    /* A corrupt or unavailable browser store creates a fresh, in-memory workspace. */
  }
  const s = seed(now);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(s));
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
    title: "Connect your first subscriber",
    description:
      "Create a service, assign Fibre 500, and follow a successful session.",
    area: "subscribers",
    time: "1 min",
  },
  {
    id: "password",
    title: "Investigate a RADIUS rejection",
    description:
      "Trace Jordan Avery’s failed login and reset demo credentials.",
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
    description:
      "Apply a profile and inspect the simulated CoA and audit trail.",
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
    title: "Practice a gateway failover",
    description: "Watch a labelled training timeline and standby promotion.",
    area: "operations",
    time: "1 min",
  },
  {
    id: "mapping",
    title: "Look up a NAT mapping",
    description:
      "Attribute a fictional public tuple to its subscriber session.",
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
      (!m.ended || Date.parse(m.ended) >= at),
  );
}
