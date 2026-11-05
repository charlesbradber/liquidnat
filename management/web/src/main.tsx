import { Dashboard } from "./Dashboard";
import { diagnose, diagnosticBundle } from "./diagnostics";
import { RadiusSettings, defaultRadius } from "./RadiusSettings";
import { NetworkPanel } from "./NetworkPanel";
import { initialNetwork, routeLookup } from "./network";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  Download,
  Droplets,
  ExternalLink,
  FileClock,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  TriangleAlert,
  Upload,
  Users,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import {
  Action,
  apply,
  DemoError,
  Event,
  load,
  lookup,
  Profile,
  scenarios,
  seed,
  Status,
  statusLabel,
  STORAGE_KEY,
  Subscriber,
  tick,
  Workspace,
  AddressMode,
  addressModeLabel,
  matchesSubscriber,
  querySubscribers,
  subscriberIp,
  pack,
} from "./simulator";
import { ProviderManagement, ProfileEditor } from "./ProviderManagement";
import "./style.css";
import "./providers.css";
import "./search-addressing.css";
import "./manager-theme.css";
import { HttpDemoBackend } from "./backend";

type Area =
  | "overview"
  | "subscribers"
  | "profiles"
  | "providers"
  | "radius"
  | "network"
  | "cgnat"
  | "operations"
  | "diagnostics"
  | "administration";
type Modal = {
  kind:
    | "preview"
    | "create"
    | "create-profile"
    | "profile"
    | "subscriber"
    | "addressing"
    | "tour"
    | "reset"
    | "settings"
    | "about";
  title: string;
  description?: string;
  action?: Action;
  sub?: Subscriber;
  rows?: [string, string][];
  expectedRevision?: number;
};
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "providers", label: "Network providers", icon: Globe2 },
  { id: "profiles", label: "Service profiles", icon: Gauge },
  { id: "radius", label: "RADIUS", icon: ShieldCheck },
  { id: "network", label: "Network", icon: Network },
  { id: "cgnat", label: "CGNAT", icon: GitBranch },
  { id: "operations", label: "Operations", icon: HardDrive },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "administration", label: "Administration", icon: Settings2 },
] as const;
const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const Icon = ({
  icon: Component,
  size = 18,
  ...props
}: {
  icon: React.ElementType;
  size?: number;
  [key: string]: unknown;
}) => <Component size={size} strokeWidth={1.7} {...props} />;
function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <CheckCircle2 size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function DownloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const remote = useRef(
    new URLSearchParams(window.location.search).get("backend") === "php"
      ? new HttpDemoBackend()
      : null,
  );
  const [backendReady, setBackendReady] = useState(!remote.current);
  useEffect(() => {
    if (remote.current)
      remote.current
        .session()
        .then((s) => {
          setState(s);
          setBackendReady(true);
        })
        .catch((e) => setToast(e.message));
  }, []);
  useEffect(() => {
    if (!remote.current || !backendReady) return;
    const timer = setInterval(() => {
      remote.current
        ?.session()
        .then(setState)
        .catch((e) => setToast(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [backendReady]);
  const [state, setState] = useState<Workspace>(() => {
    try {
      return load(sessionStorage);
    } catch {
      return seed();
    }
  });
  const radius = state.radius || defaultRadius;
  const [area, setArea] = useState<Area>("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(-1);
  const searchRef = useRef<HTMLFormElement>(null);
  const [addressChoice, setAddressChoice] = useState<AddressMode>("cgnat");
  const [staticInput, setStaticInput] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [chartTime, setChartTime] = useState("1 hour");
  const [selectedDiagnostic, setSelectedDiagnostic] = useState("sub-0126");
  const [tab, setTab] = useState("");
  const [mapIp, setMapIp] = useState("203.0.113.10");
  const [mapPort, setMapPort] = useState("40012");
  const [mapProtocol, setMapProtocol] = useState("TCP");
  const [mapAt, setMapAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [mappingResults, setMappingResults] = useState<ReturnType<
    typeof lookup
  > | null>(null);
  const [planName, setPlanName] = useState("");
  const [planDown, setPlanDown] = useState("2500");
  const [planUp, setPlanUp] = useState("1000");
  const [createName, setCreateName] = useState("");
  const [createUser, setCreateUser] = useState("");
  const [createProvider, setCreateProvider] = useState(state.providers[0].id);
  const [profileProvider, setProfileProvider] = useState(state.providers[0].id);
  const [providerFilter, setProviderFilter] = useState("all");
  const [createProfile, setCreateProfile] = useState("home500");
  const [profileChoice, setProfileChoice] = useState("home500");
  useEffect(() => {
    const provider = state.providers.some((p) => p.id === createProvider)
      ? createProvider
      : state.providers[0].id;
    if (provider !== createProvider) setCreateProvider(provider);
    if (
      !state.profiles.some(
        (p) => p.id === createProfile && p.provider === provider,
      )
    )
      setCreateProfile(
        state.profiles.find((p) => p.provider === provider)?.id || "",
      );
    if (
      providerFilter !== "all" &&
      !state.providers.some((p) => p.id === providerFilter)
    )
      setProviderFilter("all");
  }, [
    state.providers,
    state.profiles,
    createProvider,
    createProfile,
    providerFilter,
  ]);
  const [formError, setFormError] = useState("");
  const [mfa, setMfa] = useState(state.mfa);
  const [retention, setRetention] = useState(state.retention);
  const [routeIp, setRouteIp] = useState("198.51.100.10");
  const [routeResult, setRouteResult] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try {
      if (!remote.current)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pack(state)));
    } catch {
      setStorageAvailable(false);
    }
  }, [state]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (!remote.current) setState((s) => tick(s, now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPage(0);
  }, [query, filter, modeFilter]);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button,[role="dialog"] input,[role="dialog"] select,[role="dialog"] a',
          ),
        ).filter((x) => !x.hasAttribute("disabled"));
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [modal?.kind]);
  const go = (target: Area) => {
    setArea(target);
    setTab("");
    setMobile(false);
    setQuery("");
    setFilter("all");
    setModeFilter("all");
    setPage(0);
  };
  const notify = (message: string) => setToast(message);
  const execute = async (action: Action, expectedRevision = state.revision) => {
    try {
      const next = remote.current
        ? await remote.current.mutate(
            { ...state, revision: expectedRevision },
            action,
          )
        : apply(
            { ...state, expires: Date.now() + 7200000 },
            action,
            expectedRevision,
          );
      setState(next);
      setModal(null);
      setFormError("");
      notify(
        action.type === "create"
          ? "Subscriber created and connected."
          : "Configuration saved. Audit history updated.",
      );
    } catch (e) {
      setFormError((e as Error).message);
      notify((e as Error).message);
    }
  };
  const preview = (
    action: Action,
    title: string,
    rows: [string, string][] = [],
  ) => {
    try {
      apply(
        { ...state, expires: Date.now() + 7200000 },
        action,
        state.revision,
      );
    } catch (error) {
      setFormError((error as Error).message);
      notify((error as Error).message);
      return;
    }
    setFormError("");
    setModal({
      kind: "preview",
      title,
      action,
      rows,
      expectedRevision: state.revision,
      description: "Review the proposed configuration before applying it.",
    });
  };
  const profile = (sub: Subscriber) =>
    state.profiles.find((p) => p.id === sub.profile)!;
  const online = useMemo(
    () => state.subscribers.filter((s) => s.status === "online").length,
    [state],
  );
  const issues = useMemo(
    () =>
      state.subscribers.filter(
        (s) => !["online", "suspended"].includes(s.status),
      ),
    [state],
  );
  const visible = useMemo(
    () =>
      state.subscribers.filter(
        (s) =>
          (filter === "all" ||
            (filter === "issues"
              ? !["online", "suspended"].includes(s.status)
              : s.status === filter)) &&
          (providerFilter === "all" || s.provider === providerFilter) &&
          matchesSubscriber(s, query) &&
          (modeFilter === "all" || s.addressMode === modeFilter),
      ),
    [state, query, filter, modeFilter, providerFilter],
  );
  const globalMatches = useMemo(
    () =>
      globalQuery.trim()
        ? querySubscribers(state, globalQuery, 0, 6)
        : { items: [], total: 0 },
    [state, globalQuery],
  );
  const addressCounts = useMemo(
    () => ({
      cgnat: state.subscribers.filter((s) => s.addressMode === "cgnat").length,
      direct: state.subscribers.filter((s) => s.addressMode === "direct")
        .length,
      static: state.subscribers.filter((s) => s.addressMode === "static")
        .length,
    }),
    [state],
  );
  const shown = visible.slice(page * 10, page * 10 + 10);
  const running = state.jobs.find((j) => j.status === "running");
  const currentScenario = (id: string) => scenarios.find((s) => s.id === id)!;
  function startScenario(id: string) {
    const s = currentScenario(id);
    go(s.area as Area);
    setModal(null);
    if (id === "first") {
      setCreateName("");
      setCreateUser("");
      setCreateProfile("home500");
      setModal({ kind: "create", title: "Create a subscriber" });
    }
    if (id === "password") setSelectedDiagnostic("sub-0126");
    if (id === "vlan") setSelectedDiagnostic("sub-0127");
    if (id === "package" || id === "suspension") {
      setQuery("subscriber001");
      notify(
        id === "package"
          ? "Open Alex Bennett, then choose Change profile."
          : "Open Alex Bennett to suspend and restore the service.",
      );
    }
    if (id === "mapping")
      notify(
        "Search the prefilled public tuple. The timestamp is interpreted in UTC.",
      );
  }
  function inspect(sub: Subscriber) {
    setModal({ kind: "subscriber", title: sub.name, sub });
  }
  function showProfile(sub: Subscriber) {
    setProfileProvider(sub.provider);
    setProfileChoice(sub.profile);
    setModal({ kind: "profile", title: "Change service profile", sub });
  }
  function showAddressing(sub: Subscriber) {
    setAddressChoice(sub.addressMode);
    setStaticInput(
      sub.addressMode === "static"
        ? sub.ip
        : subscriberIp(Number(sub.id.slice(4)) - 1, "static"),
    );
    setFormError("");
    setModal({ kind: "addressing", title: "Change IPv4 addressing", sub });
  }
  function searchAll() {
    go("subscribers");
    setQuery(globalQuery.trim());
    setSearchOpen(false);
  }
  function diagnostic(sub: Subscriber) {
    setSelectedDiagnostic(sub.id);
    go("diagnostics");
    setModal(null);
  }
  function lookupMapping(e: React.FormEvent) {
    e.preventDefault();
    try {
      const results = lookup(
        state,
        mapIp,
        Number(mapPort),
        mapProtocol,
        Date.parse(mapAt + "Z"),
      );
      setMappingResults(results);
      if (results.length && !state.completed.includes("mapping"))
        execute({ type: "mapping-viewed" });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const chosen =
    state.subscribers.find((s) => s.id === selectedDiagnostic) ||
    state.subscribers[0];
  const chartClock = useRef(clock);
  if (!paused) chartClock.current = clock;
  const throughput = 86.42 + Math.sin(chartClock.current / 23000) * 3.24;

  function TrafficChart() {
    const xs = Array.from({ length: 73 }, (_, i) => i);
    const range =
      chartTime === "24 hours" ? 0.6 : chartTime === "15 min" ? 1.6 : 1;
    const sample = (i: number) =>
      Math.sin(i * 0.27 * range) * 0.65 + Math.cos(i * 0.61) * 0.2;
    const downstream = xs.map((i) => [
      (i / 72) * 640,
      152 -
        (Math.max(
          1,
          Math.min(115, throughput * 0.88 + (sample(i) - sample(72)) * 24),
        ) /
          120) *
          144,
    ]);
    const upstream = xs.map((i) => [
      (i / 72) * 640,
      152 -
        (Math.max(
          1,
          throughput * 0.12 + (Math.sin(i * 0.25) - Math.sin(72 * 0.25)) * 3,
        ) /
          120) *
          144,
    ]);
    const curve = (points: number[][]) => {
      let path = `M${points[0].join(",")}`;
      for (let i = 1; i < points.length - 1; i++) {
        const point = points[i],
          next = points[i + 1];
        path += ` Q${point.join(",")} ${(point[0] + next[0]) / 2},${(point[1] + next[1]) / 2}`;
      }
      return path + ` T${points[points.length - 1].join(",")}`;
    };
    const rangeMinutes =
      chartTime === "24 hours" ? 1440 : chartTime === "15 min" ? 15 : 60;
    return (
      <div
        className="traffic-chart"
        role="img"
        aria-label={`Downstream and upstream traffic over ${chartTime}`}
      >
        <div className="traffic-y-axis" aria-hidden="true">
          {[120, 90, 60, 30, 0].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
        <svg
          className="traffic-plot-svg"
          viewBox="0 0 640 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ad95" stopOpacity=".23" />
              <stop offset="100%" stopColor="#00ad95" stopOpacity=".025" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              x2="640"
              y1={8 + i * 36}
              y2={8 + i * 36}
              stroke="#e2e7ed"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={`${curve(downstream)} L640,152 L0,152 Z`}
            fill="url(#traffic-fill)"
          />
          <path
            d={curve(downstream)}
            fill="none"
            stroke="#00ad95"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={curve(upstream)}
            fill="none"
            stroke="#279ed1"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="traffic-axis-unit" aria-hidden="true">
          Gb/s
        </div>
        <div className="traffic-x-axis" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>
              {new Date(
                chartClock.current - (6 - i) * rangeMinutes * 10000,
              ).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ))}
        </div>
      </div>
    );
  }
  function EventList({
    events = state.events.slice(0, 5),
  }: {
    events?: Event[];
  }) {
    return (
      <div className="event-list">
        {events.length ? (
          events.map((e) => (
            <div className="event" key={e.id}>
              <span className={`event-symbol ${e.level}`}>
                <Icon
                  icon={
                    e.level === "warning"
                      ? TriangleAlert
                      : e.level === "success"
                        ? Check
                        : FileClock
                  }
                  size={15}
                />
              </span>
              <div>
                <strong>{e.title}</strong>
                <p>{e.detail}</p>
              </div>
              <time>{formatTime(e.at)}</time>
            </div>
          ))
        ) : (
          <Empty
            title="No events yet"
            detail="Configuration changes and operation results will appear here."
          />
        )}
      </div>
    );
  }
  function SubscriberTable({ compact = false }: { compact?: boolean }) {
    const rows = compact ? state.subscribers.slice(0, 5) : shown;
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Status</th>
              <th>IPv4 / mode</th>
              <th>Network provider</th>
              <th>Service profile</th>
              {!compact && <th>Circuit / VLAN</th>}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => inspect(s)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") inspect(s);
                }}
              >
                <td>
                  <div className="person">
                    <span className="avatar">{initials(s.name)}</span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>{s.username}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <Badge
                    tone={
                      s.status === "online"
                        ? "green"
                        : s.status === "suspended"
                          ? "grey"
                          : "amber"
                    }
                  >
                    {statusLabel[s.status]}
                  </Badge>
                </td>
                <td className="mono">
                  {s.ip}
                  <small>{addressModeLabel[s.addressMode]}</small>
                </td>
                <td>
                  {state.providers.find((p) => p.id === s.provider)?.name}
                </td>
                <td>
                  {profile(s).name}
                  <small>
                    {profile(s).down} / {profile(s).up} Mb/s
                  </small>
                </td>
                {!compact && (
                  <td className="mono">
                    {s.circuit}
                    <small>VLAN {s.vlan}</small>
                  </td>
                )}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      inspect(s);
                    }}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title="No subscribers found"
            detail="Try another name, IP address, circuit or status filter."
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">
            <Droplets size={23} />
          </span>
          <span>
            Liquid<span className="brand-light">NAT</span>
            <small>MANAGER</small>
          </span>
        </a>
        <button
          className="workspace-switch"
          onClick={() =>
            setModal({ kind: "about", title: "Workspace details" })
          }
        >
          <span className="workspace-icon">E</span>
          <span>
            LiquidNet<small>Network operations</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {nav.slice(0, 6).map((n) => (
            <button
              key={n.id}
              aria-current={area === n.id ? "page" : undefined}
              className={area === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <Icon icon={n.icon} />
              <span>{n.label}</span>
              {n.id === "subscribers" && (
                <small>{state.subscribers.length.toLocaleString()}</small>
              )}
            </button>
          ))}
          <p className="nav-label">MANAGE</p>
          {nav.slice(6).map((n) => (
            <button
              key={n.id}
              aria-current={area === n.id ? "page" : undefined}
              className={area === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <Icon icon={n.icon} />
              <span>{n.label}</span>
              {n.id === "diagnostics" && issues.length > 0 && (
                <span className="nav-count">{issues.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tour-mini">
            <span>
              <Sparkles size={16} /> Network actions
            </span>
            <p>Common subscriber and gateway tasks.</p>
            <button
              onClick={() =>
                setModal({
                  kind: "tour",
                  title: "Quick actions",
                  description: "Open a subscriber, network or gateway task.",
                })
              }
            >
              Open quick actions <ArrowRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-help"
            onClick={() =>
              setModal({ kind: "about", title: "About LiquidNAT" })
            }
          >
            <CircleHelp size={17} /> Help & documentation{" "}
            <ExternalLink size={13} />
          </button>
          <div className="operator">
            <span className="operator-avatar">DE</span>
            <span>
              Network administrator<small>Workspace administrator</small>
            </span>
            <Badge tone="dark">v0.2</Badge>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspaces</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-workspace">LiquidNet</span>
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === area)?.label}</strong>
          </div>
          <form
            className="global-search"
            ref={searchRef}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              searchAll();
            }}
          >
            <Search size={17} />
            <input
              role="combobox"
              aria-label="Search all subscribers"
              aria-expanded={searchOpen && !!globalQuery.trim()}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                searchIndex >= 0 ? `global-result-${searchIndex}` : undefined
              }
              placeholder="Search name, RADIUS, IPv4, IPv6, MAC…"
              value={globalQuery}
              autoComplete="off"
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setGlobalQuery(e.target.value);
                setSearchOpen(true);
                setSearchIndex(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchOpen(true);
                  setSearchIndex((i) =>
                    Math.min(i + 1, globalMatches.items.length - 1),
                  );
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchIndex((i) => Math.max(-1, i - 1));
                }
                if (
                  e.key === "Enter" &&
                  searchOpen &&
                  searchIndex >= 0 &&
                  globalMatches.items[searchIndex]
                ) {
                  e.preventDefault();
                  inspect(globalMatches.items[searchIndex]);
                  setSearchOpen(false);
                }
              }}
            />
            {globalQuery && (
              <button
                type="button"
                className="icon-button"
                aria-label="Clear global search"
                onClick={() => {
                  setGlobalQuery("");
                  setSearchIndex(-1);
                }}
              >
                <X size={14} />
              </button>
            )}
            {searchOpen && globalQuery.trim() && (
              <div className="global-search-popover">
                <div className="global-search-summary">
                  {globalMatches.total.toLocaleString()} matching subscribers{" "}
                  <small>
                    Search across all{" "}
                    {state.subscribers.length.toLocaleString()} services
                  </small>
                </div>
                <div
                  id="global-search-results"
                  role="listbox"
                  aria-label="Subscriber search results"
                >
                  {globalMatches.items.map((sub, index) => (
                    <button
                      id={`global-result-${index}`}
                      role="option"
                      aria-selected={searchIndex === index}
                      type="button"
                      key={sub.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        inspect(sub);
                        setSearchOpen(false);
                      }}
                    >
                      <span className="avatar">{initials(sub.name)}</span>
                      <span className="search-result-copy">
                        <strong>
                          {sub.name}{" "}
                          <span>{addressModeLabel[sub.addressMode]}</span>
                        </strong>
                        <small>{sub.username}</small>
                        <small className="mono">
                          {sub.ip} · {sub.mac}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!globalMatches.total && (
                    <div className="search-no-results">
                      No matches. Try a RADIUS username, name, IP address,
                      prefix, circuit, or MAC.
                    </div>
                  )}
                </div>
                {globalMatches.total > 0 && (
                  <button type="submit" className="search-view-all">
                    View all {globalMatches.total.toLocaleString()} matches{" "}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </form>
          <div className="topbar-actions">
            <span className="system-status">
              <i /> Management systems operational
            </span>
            <button
              className="icon-button"
              title="Open quick actions"
              aria-label="Open quick actions"
              onClick={() => setModal({ kind: "tour", title: "Quick actions" })}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="notification-button icon-button"
              title="View events"
              aria-label="View recent events"
              onClick={() => {
                go("operations");
                setTab("events");
              }}
            >
              <Bell size={19} />
              {issues.length > 0 && <i />}
            </button>
            <span className="top-avatar">DE</span>
          </div>
        </header>
        <div className="demo-strip">
          <span>
            <span className="demo-tag">
              <Sparkles size={12} /> CONFIGURATION SAVED
            </span>
            <span>Changes are saved for this browser session.</span>
          </span>
          <button
            onClick={() =>
              setModal({
                kind: "reset",
                title: "Reset your workspace?",
                description:
                  "Restore the initial configuration for this browser session.",
              })
            }
          >
            <RefreshCw size={13} /> Reset workspace
          </button>
        </div>
        {!backendReady && (
          <div className="notice">Connecting to the management API…</div>
        )}
        {!storageAvailable && (
          <div className="notice">
            Browser storage is unavailable. This workspace will reset when the
            page reloads.
          </div>
        )}
        <main inert={!backendReady}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                LIQUIDNET · NETWORK OPERATIONS <span>/</span> LIQUIDNAT MANAGER
              </div>
              <h1>
                {area === "overview"
                  ? "Network overview"
                  : nav.find((n) => n.id === area)?.label}
              </h1>
              <p>
                {
                  {
                    overview:
                      "A clear view of your network, subscribers, gateways and operational health.",
                    subscribers:
                      "Manage access, investigate sessions, and keep your customers connected.",
                    providers:
                      "Manage network providers and their service catalogues.",
                    profiles:
                      "Consistent service policies, from authentication to the packet engine.",
                    radius:
                      "Follow authentication decisions and accounting across your network.",
                    network: "Interfaces, routes, and addressing in one place.",
                    cgnat:
                      "Keep track of capacity. Find the subscriber behind a public tuple.",
                    operations:
                      "Make changes with confidence and a clear route back.",
                    diagnostics:
                      "Follow the evidence from subscriber to upstream.",
                    administration:
                      "Access policies and audit history for your workspace.",
                  }[area]
                }
              </p>
            </div>
            <div className="heading-actions">
              {area === "overview" ? (
                <>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setModal({
                        kind: "tour",
                        title: "Quick actions",
                      })
                    }
                  >
                    <Play size={15} /> Quick actions
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      setCreateName("");
                      setCreateUser("");
                      setFormError("");
                      setModal({
                        kind: "create",
                        title: "Create a subscriber",
                      });
                    }}
                  >
                    <Plus size={16} /> Add subscriber
                  </button>
                </>
              ) : area === "subscribers" ? (
                <button
                  className="button primary"
                  onClick={() => {
                    setCreateName("");
                    setCreateUser("");
                    setFormError("");
                    setModal({ kind: "create", title: "Create a subscriber" });
                  }}
                >
                  <Plus size={16} /> Add subscriber
                </button>
              ) : (
                <Badge tone="grey">Revision {state.revision}</Badge>
              )}
            </div>
          </div>

          {area === "overview" && (
            <Dashboard
              workspace={state}
              now={clock}
              throughput={throughput}
              paused={paused}
              chartTime={chartTime}
              chart={<TrafficChart />}
              onPause={() => setPaused(!paused)}
              onRange={setChartTime}
              onInspect={inspect}
              onDiagnose={diagnostic}
              onOperations={() => go("operations")}
              onSubscribers={() => go("subscribers")}
              onDiagnostics={() => go("diagnostics")}
              onGuide={() => setModal({ kind: "tour", title: "Quick actions" })}
            />
          )}

          {area === "subscribers" && (
            <>
              <div className="summary-strip">
                <span>
                  <i className="tiny-dot" />
                  {online} connected
                </span>
                <span>
                  <i className="tiny-dot amber" />
                  {issues.length} need attention
                </span>
                <span>
                  {
                    state.subscribers.filter((s) => s.status === "suspended")
                      .length
                  }{" "}
                  suspended
                </span>
                <span className="right">All subscriber services</span>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search-field">
                    <Search size={17} />
                    <input
                      placeholder="Search name, RADIUS username, IP, or MAC…"
                      aria-label="Search subscribers"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="inline-controls">
                    <ListFilter size={16} />
                    <select
                      aria-label="Filter IPv4 mode"
                      value={modeFilter}
                      onChange={(e) => setModeFilter(e.target.value)}
                    >
                      <option value="all">All IPv4 modes</option>
                      <option value="cgnat">CGNAT</option>
                      <option value="direct">Direct IPv4</option>
                      <option value="static">Static IPv4</option>
                    </select>
                    <select
                      aria-label="Filter network provider"
                      value={providerFilter}
                      onChange={(e) => {
                        setProviderFilter(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="all">All network providers</option>
                      {state.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter subscriber status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="online">Connected</option>
                      <option value="issues">Needs attention</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        DownloadJson(
                          visible.slice(0, 250),
                          "liquidnat-subscribers.json",
                        )
                      }
                    >
                      <Download size={14} />{" "}
                      {visible.length > 250 ? "Export first 250" : "Export"}
                    </button>
                  </div>
                </div>
                <SubscriberTable />
                <div className="pagination">
                  <span>
                    Showing {visible.length ? page * 10 + 1 : 0}–
                    {Math.min(page * 10 + 10, visible.length)} of{" "}
                    {visible.length} subscribers
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      disabled={page === 0}
                      aria-label="Previous page"
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <span>
                      Page {page + 1} of{" "}
                      {Math.max(1, Math.ceil(visible.length / 10))}
                    </span>
                    <button
                      className="icon-button"
                      disabled={(page + 1) * 10 >= visible.length}
                      aria-label="Next page"
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {area === "providers" && (
            <ProviderManagement
              key={state.revision}
              state={state}
              review={preview}
            />
          )}

          {area === "profiles" && (
            <>
              <div className="notice">
                <Gauge size={17} /> Choose a profile to assign its speed and
                access policies to a subscriber.
              </div>
              <div className="modal-actions">
                <button
                  className="button primary"
                  disabled={state.profiles.length >= 300}
                  onClick={() => {
                    setPlanName("");
                    setPlanDown("2500");
                    setPlanUp("1000");
                    setFormError("");
                    setModal({
                      kind: "create-profile",
                      title: "Create service profile",
                    });
                  }}
                >
                  <Plus size={16} /> Create service profile
                </button>
              </div>
              <ProfileEditor
                key={state.revision}
                state={state}
                review={preview}
              />
              <div className="profile-grid">
                {state.profiles.map((p) => (
                  <section className="panel profile-card" key={p.id}>
                    <div className="profile-symbol">
                      <Zap size={23} />
                    </div>
                    <span className="eyebrow">
                      {
                        state.providers.find(
                          (provider) => provider.id === p.provider,
                        )?.name
                      }
                    </span>
                    <h2>{p.name}</h2>
                    <div className="profile-speed">
                      {p.down}
                      <span>Mb/s download</span>
                    </div>
                    <div className="profile-upload">
                      <Upload size={15} />
                      {p.up} Mb/s upload
                    </div>
                    <ul>
                      <li>
                        <Check size={15} />
                        Dual-stack IPv4 + IPv6
                      </li>
                      <li>
                        <Check size={15} />
                        CGNAT, direct or static IPv4
                      </li>
                      <li>
                        <Check size={15} />
                        Interim accounting · 5 minutes
                      </li>
                      <li>
                        <Check size={15} />
                        Dynamic profile change via CoA
                      </li>
                    </ul>
                    <div className="profile-count">
                      {
                        state.subscribers.filter((s) => s.profile === p.id)
                          .length
                      }{" "}
                      assigned subscribers
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => {
                        go("subscribers");
                        notify(
                          "Open a subscriber and select Change profile to apply " +
                            p.name +
                            ".",
                        );
                      }}
                    >
                      Assign to subscriber <ArrowRight size={14} />
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}

          {area === "radius" && (
            <>
              <div className="metrics-grid three">
                <Metric
                  label="Authentication acceptance"
                  value={((online / state.subscribers.length) * 100).toFixed(1)}
                  unit="%"
                  icon={ShieldCheck}
                  footer="Current subscriber session states"
                />
                <Metric
                  label="Integrated RADIUS"
                  value="2"
                  unit="replicas"
                  icon={Server}
                  footer="Primary and secondary replicas"
                />
                <Metric
                  label="Pending credential failures"
                  value={String(
                    state.subscribers.filter(
                      (s) => s.status === "auth-rejected",
                    ).length,
                  )}
                  icon={TriangleAlert}
                  footer="Rejects remain blocked until resolved"
                />
              </div>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Authentication requests</h2>
                      <p>Authentication decisions and policy status</p>
                    </div>
                    <Badge>Integrated</Badge>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Subscriber</th>
                          <th>Decision</th>
                          <th>Reason</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...state.subscribers.filter(
                            (s) => s.id === "sub-0126",
                          ),
                          ...state.subscribers.slice(0, 5),
                        ].map((s) => (
                          <tr key={s.id}>
                            <td>
                              <strong>{s.name}</strong>
                              <small>{s.username}</small>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  s.status === "auth-rejected"
                                    ? "amber"
                                    : "green"
                                }
                              >
                                {s.status === "auth-rejected"
                                  ? "Access-Reject"
                                  : "Access-Accept"}
                              </Badge>
                            </td>
                            <td>
                              {s.status === "auth-rejected"
                                ? "Invalid credentials"
                                : "Valid cached policy"}
                            </td>
                            <td>
                              <button
                                className="text-link"
                                onClick={() => diagnostic(s)}
                              >
                                Trace <ArrowRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>RADIUS configuration</h2>
                      <p>LiquidNAT RADIUS · integrated authentication</p>
                    </div>
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Primary</dt>
                      <dd>{radius.primary}</dd>
                    </div>
                    <div>
                      <dt>Secondary</dt>
                      <dd>{radius.secondary}</dd>
                    </div>
                    <div>
                      <dt>Realm</dt>
                      <dd className="mono">{radius.realm}</dd>
                    </div>
                    <div>
                      <dt>Client network</dt>
                      <dd className="mono">{radius.clientNetwork}</dd>
                    </div>
                    <div>
                      <dt>New sessions during outage</dt>
                      <dd>Reject · fail closed</dd>
                    </div>
                    <div>
                      <dt>Accounting interval</dt>
                      <dd>{radius.accountingInterval} seconds</dd>
                    </div>
                  </dl>
                  <RadiusSettings config={radius} review={preview} />
                  <div className="callout">
                    <LockKeyhole size={18} />
                    <p>
                      Authentication requests use the configured realm and
                      subscriber policy.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          {area === "network" && <NetworkPanel state={state} save={execute} />}

          {area === "cgnat" && (
            <>
              <div className="metrics-grid three">
                <Metric
                  label="CGNAT subscribers"
                  value={addressCounts.cgnat.toLocaleString()}
                  icon={GitBranch}
                  footer="Shared IPv4 · searchable session mappings"
                />
                <Metric
                  label="Direct IPv4 subscribers"
                  value={addressCounts.direct.toLocaleString()}
                  icon={Globe2}
                  footer="Routed IPv4 · no NAT translation"
                />
                <Metric
                  label="Static IPv4 subscribers"
                  value={addressCounts.static.toLocaleString()}
                  icon={LockKeyhole}
                  footer="Reserved IPv4 · no NAT translation"
                />
              </div>
              <div className="notice">
                <Users size={17} />
                Choose any subscriber to inspect CGNAT mappings or change their
                IPv4 mode.
                <button className="text-link" onClick={() => go("subscribers")}>
                  Browse subscribers <ArrowRight size={13} />
                </button>
              </div>
              <div className="two-columns">
                <section className="panel pool-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Shared IPv4 pool</h2>
                      <p>203.0.113.8/29 · documentation addresses</p>
                    </div>
                    <Badge
                      tone={
                        state.poolUsed >= state.poolCapacity ? "amber" : "green"
                      }
                    >
                      {state.poolUsed >= state.poolCapacity
                        ? "At capacity"
                        : "Available"}
                    </Badge>
                  </div>
                  <div className="pool-number">
                    {state.poolUsed}
                    <span>/ {state.poolCapacity} admission slots</span>
                    <strong>
                      {Math.round((state.poolUsed / state.poolCapacity) * 100)}%
                    </strong>
                  </div>
                  <div
                    className={`progress-track ${state.poolUsed >= state.poolCapacity ? "orange" : ""}`}
                  >
                    <i
                      style={{
                        width: `${(state.poolUsed / state.poolCapacity) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="muted">
                    Admission capacity controls how many subscriber services can
                    use the shared IPv4 pool.
                  </p>
                  <button
                    className="button secondary"
                    disabled={state.poolExpanded}
                    onClick={() =>
                      preview({ type: "expand-pool" }, "Expand pool capacity", [
                        [
                          "Capacity",
                          `${state.poolCapacity.toLocaleString()} → 16,384 admission slots`,
                        ],
                        ["Existing mappings", "Retained"],
                        [
                          "Affected subscriber",
                          "Quinn Taylor · admission resumes",
                        ],
                        ["Restart required", "No"],
                      ])
                    }
                  >
                    <Plus size={15} />
                    {state.poolExpanded
                      ? "Pool expanded"
                      : "Review capacity increase"}
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Traceability</h2>
                      <p>Seeded mapping journal</p>
                    </div>
                    <FileClock size={20} />
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Active mappings</dt>
                      <dd>{state.mappings.length}</dd>
                    </div>
                    <div>
                      <dt>Journal status</dt>
                      <dd>
                        <Badge>Mappings available</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Retention preference</dt>
                      <dd>{state.retention} days</dd>
                    </div>
                    <div>
                      <dt>Attribution fields</dt>
                      <dd>Public tuple + protocol + time</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>NAT mapping lookup</h2>
                    <p>
                      Find a subscriber by public address, port, protocol and
                      timestamp.
                    </p>
                  </div>
                  <span className="subtle-tag">CURRENT</span>
                </div>
                <form className="mapping-form" onSubmit={lookupMapping}>
                  <label>
                    Public IPv4
                    <input
                      required
                      value={mapIp}
                      onChange={(e) => setMapIp(e.target.value)}
                    />
                  </label>
                  <label>
                    Public port
                    <input
                      required
                      type="number"
                      min="1"
                      max="65535"
                      value={mapPort}
                      onChange={(e) => setMapPort(e.target.value)}
                    />
                  </label>
                  <label>
                    Protocol
                    <select
                      value={mapProtocol}
                      onChange={(e) => setMapProtocol(e.target.value)}
                    >
                      <option>TCP</option>
                      <option>UDP</option>
                    </select>
                  </label>
                  <label>
                    Timestamp (UTC)
                    <input
                      required
                      type="datetime-local"
                      value={mapAt}
                      onChange={(e) => setMapAt(e.target.value)}
                    />
                  </label>
                  <button className="button primary" type="submit">
                    <Search size={15} /> Find mapping
                  </button>
                </form>
                {mappingResults !== null &&
                  (mappingResults.length ? (
                    <div className="mapping-results">
                      {mappingResults.map((m) => {
                        const sub = state.subscribers.find(
                          (s) => s.id === m.subscriber,
                        )!;
                        return (
                          <div key={m.port}>
                            <div className="success-heading">
                              <CheckCircle2 size={18} />
                              <strong>
                                Mapping found · subscriber attribution
                              </strong>
                            </div>
                            <dl className="detail-list horizontal">
                              <div>
                                <dt>Subscriber</dt>
                                <dd>{sub.name}</dd>
                              </div>
                              <div>
                                <dt>Private connection</dt>
                                <dd className="mono">
                                  {m.privateIp}:{m.privatePort}
                                </dd>
                              </div>
                              <div>
                                <dt>Session</dt>
                                <dd className="mono">session-{sub.id}</dd>
                              </div>
                              <div>
                                <dt>Valid from</dt>
                                <dd>
                                  {new Date(m.started).toLocaleString("en-GB")}
                                </dd>
                              </div>
                            </dl>
                            <button
                              className="text-link"
                              onClick={() => inspect(sub)}
                            >
                              View subscriber <ArrowRight size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty
                      title="No matching mapping"
                      detail="Try 203.0.113.10 : 40012 / TCP at the current time. No match is not proof that traffic never existed."
                    />
                  ))}
              </section>
            </>
          )}

          {area === "operations" && (
            <>
              <div className="tabs">
                {["gateways", "changes", "events"].map((t) => (
                  <button
                    key={t}
                    className={(tab || "gateways") === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                    {t === "changes" && running && <i className="tiny-dot" />}
                  </button>
                ))}
              </div>
              {(!tab || tab === "gateways") && (
                <>
                  <div className="notice">
                    <Sparkles size={17} /> Gateway operations include
                    preparation, application and verification. Review the
                    cluster state before starting a job.
                  </div>
                  <div className="two-columns">
                    <section className="panel operation-card">
                      <div className="operation-icon">
                        <Server size={26} />
                      </div>
                      <h2>Gateway resilience</h2>
                      <p>
                        Explore a controlled active / standby transition and
                        inspect the operation history.
                      </p>
                      <dl className="detail-list">
                        <div>
                          <dt>Active gateway</dt>
                          <dd>{state.active}</dd>
                        </div>
                        <div>
                          <dt>Standby gateway</dt>
                          <dd>
                            {state.active === "gateway-01"
                              ? "gateway-02"
                              : "gateway-01"}
                          </dd>
                        </div>
                        <div>
                          <dt>Fencing</dt>
                          <dd>Synchronized</dd>
                        </div>
                      </dl>
                      <button
                        className="button secondary"
                        disabled={!!running}
                        onClick={() =>
                          preview(
                            { type: "failover" },
                            "Practice a gateway failover",
                            [
                              ["Scope", "Gateway cluster"],
                              [
                                "Next active",
                                state.active === "gateway-01"
                                  ? "gateway-02"
                                  : "gateway-01",
                              ],
                              [
                                "Traffic continuity",
                                "Unmeasured · no real packets",
                              ],
                              [
                                "Timeline",
                                "Fencing → promotion → reconciliation",
                              ],
                            ],
                          )
                        }
                      >
                        <RefreshCw size={15} /> Start failover
                      </button>
                    </section>
                    <section className="panel operation-card">
                      <div className="operation-icon">
                        <ArrowDownToLine size={26} />
                      </div>
                      <h2>Updates & recovery</h2>
                      <p>
                        Preview a staged update, retain a backup, and try the
                        rollback path.
                      </p>
                      <dl className="detail-list">
                        <div>
                          <dt>Current version</dt>
                          <dd className="mono">{state.version}</dd>
                        </div>
                        <div>
                          <dt>Available version</dt>
                          <dd className="mono">0.2.1</dd>
                        </div>
                        <div>
                          <dt>Last configuration backup</dt>
                          <dd>
                            {state.backupAt
                              ? formatTime(state.backupAt)
                              : "Not created yet"}
                          </dd>
                        </div>
                      </dl>
                      <div className="button-row">
                        <button
                          className="button primary"
                          disabled={!!running || state.version === "0.2.1"}
                          onClick={() =>
                            preview({ type: "upgrade" }, "Review upgrade", [
                              ["Target version", "0.2.1"],
                              ["Preflight", "Compatible gateway profile"],
                              ["Backup", "Created before activation"],
                              ["Rollback", "Restore 0.2.0"],
                              ["Real appliance changes", "None"],
                            ])
                          }
                        >
                          <ArrowDownToLine size={15} /> Preview upgrade
                        </button>
                        {state.version === "0.2.1" && (
                          <button
                            className="button secondary"
                            onClick={() =>
                              preview(
                                { type: "rollback" },
                                "Roll back version",
                                [
                                  ["Version", "0.2.1 → 0.2.0"],
                                  ["Configuration", "Retained"],
                                ],
                              )
                            }
                          >
                            Roll back
                          </button>
                        )}
                      </div>
                    </section>
                  </div>
                  <section className="panel backup-row">
                    <div>
                      <h2>Configuration backup</h2>
                      <p>
                        Export the current configuration. No credentials or
                        private network configuration are included.
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        disabled={!!running}
                        onClick={() => execute({ type: "backup" })}
                      >
                        <Database size={15} /> Create configuration backup
                      </button>
                      <button
                        className="button secondary"
                        disabled={!state.backupAt}
                        onClick={() =>
                          DownloadJson(
                            {
                              product: "LiquidNAT Manager",
                              simulation: true,
                              ...state,
                            },
                            "liquidnat-backup.json",
                          )
                        }
                      >
                        <Download size={15} /> Export backup
                      </button>
                    </div>
                  </section>
                  {state.jobs.length > 0 && (
                    <JobPanel jobs={state.jobs} now={clock} />
                  )}
                </>
              )}
              {tab === "changes" && (
                <>
                  <JobPanel jobs={state.jobs} now={clock} />
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Configuration history</h2>
                      <span className="muted">
                        Current revision {state.revision}
                      </span>
                    </div>
                    <EventList
                      events={state.events.filter((e) => e.level !== "warning")}
                    />
                  </section>
                </>
              )}
              {tab === "events" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Workspace event log</h2>
                      <p>Most recent 100 audit entries</p>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        DownloadJson(state.events, "liquidnat-events.json")
                      }
                    >
                      <Download size={14} />{" "}
                      {visible.length > 250 ? "Export first 250" : "Export"}
                    </button>
                  </div>
                  <EventList events={state.events} />
                </section>
              )}
            </>
          )}

          {area === "diagnostics" && (
            <>
              <div className="diagnostic-selector panel">
                <div>
                  <Activity size={20} />
                  <label htmlFor="diagnostic-sub">Subscriber journey</label>
                </div>
                <select
                  id="diagnostic-sub"
                  value={chosen.id}
                  onChange={(e) => setSelectedDiagnostic(e.target.value)}
                >
                  {[
                    ...state.subscribers.filter((s) => s.status !== "online"),
                    ...state.subscribers.filter(
                      (s, index) =>
                        s.status === "online" &&
                        (s.id === chosen.id || index < 30),
                    ),
                  ].map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.circuit}
                    </option>
                  ))}
                </select>
                <Badge tone={chosen.status === "online" ? "green" : "amber"}>
                  {statusLabel[chosen.status]}
                </Badge>
              </div>
              <div className="two-columns diagnostic-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Connection journey</h2>
                      <p>{chosen.username} · session evidence chain</p>
                    </div>
                  </div>
                  <div className="journey">
                    {diagnose(state, chosen).map((step, i) => (
                      <div
                        className={`journey-step ${step.state}`}
                        key={step.title}
                      >
                        <span>
                          {step.state === "failed" ? (
                            <TriangleAlert size={17} />
                          ) : step.state === "passed" ? (
                            <Check size={17} />
                          ) : (
                            <Clock3 size={17} />
                          )}
                        </span>
                        <div>
                          <small>
                            STEP {i + 1} · {step.state.toUpperCase()}
                          </small>
                          <h3>{step.title}</h3>
                          <p>{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel diagnosis">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {chosen.status === "online"
                          ? "No blocking fault detected"
                          : "Recommended next step"}
                      </h2>
                      <p>Based on the selected subscriber’s session</p>
                    </div>
                  </div>
                  <div
                    className={`diagnosis-symbol ${chosen.status === "online" ? "ok" : ""}`}
                  >
                    {chosen.status === "online" ? (
                      <ShieldCheck size={30} />
                    ) : (
                      <TriangleAlert size={30} />
                    )}
                  </div>
                  <h2>
                    {
                      {
                        online: "The subscriber session is healthy",
                        suspended: "Service is suspended",
                        "auth-rejected": "Credentials were rejected",
                        "vlan-mismatch": "The handoff VLAN does not match",
                        "pool-exhausted": "No admission capacity remains",
                      }[chosen.status]
                    }
                  </h2>
                  <p>
                    {
                      {
                        online:
                          "Authentication, addressing, and subscriber policy checks passed.",
                        suspended:
                          "The suspended policy blocks both address families. Restore the service to return to its assigned package.",
                        "auth-rejected":
                          "RADIUS returned Access-Reject. Reset authentication to retry subscriber admission.",
                        "vlan-mismatch": `The circuit arrived on VLAN ${chosen.vlan}, while the service expects VLAN ${chosen.expectedVlan}. Preview a configuration correction before applying it.`,
                        "pool-exhausted":
                          "Existing sessions keep their mappings. Expand the seeded pool capacity to allow this subscriber to connect.",
                      }[chosen.status]
                    }
                  </p>
                  {chosen.status === "auth-rejected" && (
                    <button
                      className="button primary"
                      onClick={() =>
                        preview(
                          { type: "fix-auth", id: chosen.id },
                          "Reset workspace authentication",
                          [
                            ["Subscriber", chosen.name],
                            ["Before", "Access-Reject · invalid credentials"],
                            ["After", "Access-Accept"],
                            ["Real credentials", "None collected or changed"],
                          ],
                        )
                      }
                    >
                      Review credential reset <ArrowRight size={14} />
                    </button>
                  )}
                  {chosen.status === "vlan-mismatch" && (
                    <button
                      className="button primary"
                      onClick={() =>
                        preview(
                          { type: "fix-vlan", id: chosen.id },
                          "Correct circuit VLAN",
                          [
                            ["Circuit", chosen.circuit],
                            [
                              "Service VLAN",
                              `${chosen.vlan} → ${chosen.expectedVlan}`,
                            ],
                            ["Session impact", "Reconnect"],
                            [
                              "Rollback",
                              "Reset workspace to restore configuration",
                            ],
                          ],
                        )
                      }
                    >
                      Review VLAN correction <ArrowRight size={14} />
                    </button>
                  )}
                  {chosen.status === "pool-exhausted" && (
                    <button
                      className="button primary"
                      onClick={() => go("cgnat")}
                    >
                      Inspect NAT pool <ArrowRight size={14} />
                    </button>
                  )}
                  {chosen.status === "suspended" && (
                    <button
                      className="button primary"
                      onClick={() =>
                        preview(
                          { type: "restore", id: chosen.id },
                          "Restore subscriber service",
                          [
                            ["Subscriber", chosen.name],
                            ["Policy", profile(chosen).name],
                            ["Impact", "IPv4 and IPv6 access restored"],
                          ],
                        )
                      }
                    >
                      Restore service
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() =>
                      DownloadJson(
                        diagnosticBundle(state, chosen),
                        `liquidnat-diagnostics-${chosen.id}.json`,
                      )
                    }
                  >
                    <Download size={15} /> Export subscriber evidence
                  </button>
                  <div className="diagnostic-code">
                    <Terminal size={14} />
                    {chosen.status === "online"
                      ? "SESSION_READY"
                      : `SESSION_${chosen.status.replaceAll("-", "_").toUpperCase()}`}
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Route lookup</h2>
                    <p>
                      Longest-prefix match against the current installed
                      forwarding table.
                    </p>
                  </div>
                </div>
                <form
                  className="route-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRouteResult(
                      routeLookup(state.network || initialNetwork(), routeIp),
                    );
                  }}
                >
                  <input
                    aria-label="Route lookup address"
                    value={routeIp}
                    onChange={(e) => setRouteIp(e.target.value)}
                  />
                  <button className="button secondary">
                    Look up route <ArrowRight size={14} />
                  </button>
                </form>
                {routeResult && (
                  <div className="callout">
                    <Network size={16} />
                    {routeResult}
                  </div>
                )}
              </section>
            </>
          )}

          {area === "administration" && (
            <>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Workspace access</h2>
                      <p>Network administrator · local administrator</p>
                    </div>
                    <Shield size={20} />
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Workspace ID</dt>
                      <dd className="mono truncate">
                        {state.id.slice(0, 18)}…
                      </dd>
                    </div>
                    <div>
                      <dt>Isolation</dt>
                      <dd>Current browser session</dd>
                    </div>
                    <div>
                      <dt>Session lifetime</dt>
                      <dd>Until this browser tab closes</dd>
                    </div>
                    <div>
                      <dt>MFA preference</dt>
                      <dd>{state.mfa ? "Required" : "Not required"}</dd>
                    </div>
                    <div>
                      <dt>Real API tokens / credentials</dt>
                      <dd>Disabled</dd>
                    </div>
                  </dl>
                  <button
                    className="button secondary inset"
                    onClick={() => {
                      setMfa(state.mfa);
                      setRetention(state.retention);
                      setModal({
                        kind: "settings",
                        title: "Workspace preferences",
                      });
                    }}
                  >
                    Edit preferences <Settings2 size={14} />
                  </button>
                </section>
                <section className="panel operation-card">
                  <h2>Session management</h2>
                  <p>
                    Changes are saved automatically in this browser tab.
                    Refreshing retains configuration; closing the tab starts a
                    fresh session next time.
                  </p>
                  <ul className="safety-list">
                    <li>
                      <CheckCircle2 size={16} />
                      Configured address pools
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      Session-scoped configuration storage
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      No analytics or third-party requests
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      One-click reset and JSON export
                    </li>
                  </ul>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setModal({
                        kind: "reset",
                        title: "Reset your workspace?",
                      })
                    }
                  >
                    <RefreshCw size={14} /> Reset workspace
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Audit trail</h2>
                    <p>
                      Configuration changes and operation results · revision{" "}
                      {state.revision}
                    </p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() =>
                      DownloadJson(state.events, "liquidnat-audit.json")
                    }
                  >
                    Export audit <Download size={14} />
                  </button>
                </div>
                <EventList events={state.events} />
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Droplets size={14} /> LiquidNAT Manager <b>0.2.0</b>
              <span className="footer-divider">/</span> Network operations
            </span>
            <span>Session storage active · all changes saved</span>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={`modal ${modal.kind === "tour" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <span className="eyebrow">LIQUIDNAT · CONFIGURATION</span>
              <button
                ref={closeRef}
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            <h2 id="modal-title">{modal.title}</h2>
            {modal.description && (
              <p className="modal-description">{modal.description}</p>
            )}
            {modal.kind === "create-profile" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  preview(
                    {
                      type: "create-profile",
                      name: planName,
                      provider: createProvider,
                      down: Number(planDown),
                      up: Number(planUp),
                    },
                    "Review service profile",
                    [
                      [
                        "Network provider",
                        state.providers.find((p) => p.id === createProvider)!
                          .name,
                      ],
                      ["Name", planName.trim()],
                      ["Download", `${planDown} Mb/s`],
                      ["Upload", `${planUp} Mb/s`],
                      [
                        "Existing subscribers",
                        "Unchanged; assign the new profile separately",
                      ],
                      [
                        "Policy",
                        "Service speed policy; IPv4 mode stays per subscriber",
                      ],
                    ],
                  );
                }}
              >
                <div className="form-grid">
                  <label>
                    Network provider
                    <select
                      value={createProvider}
                      onChange={(e) => setCreateProvider(e.target.value)}
                    >
                      {state.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Profile name
                    <input
                      required
                      minLength={2}
                      maxLength={48}
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="e.g. Fibre 2500"
                    />
                  </label>
                  <label>
                    Download speed (Mb/s)
                    <input
                      type="number"
                      required
                      min={1}
                      max={100000}
                      step={1}
                      value={planDown}
                      onChange={(e) => setPlanDown(e.target.value)}
                    />
                  </label>
                  <label>
                    Upload speed (Mb/s)
                    <input
                      type="number"
                      required
                      min={1}
                      max={100000}
                      step={1}
                      value={planUp}
                      onChange={(e) => setPlanUp(e.target.value)}
                    />
                  </label>
                </div>
                <p className="modal-description">
                  Create a new policy to preserve existing assignments. Speeds
                  support up to 100 Gb/s and apply to assigned subscriber
                  services.
                </p>
                {formError && <p role="alert">{formError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary">
                    Review profile <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
            {modal.kind === "create" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  preview(
                    {
                      type: "create",
                      name: createName,
                      username: `${createUser}@${radius.realm}`,
                      profile: createProfile,
                      provider: createProvider,
                    },
                    "Review new subscriber",
                    [
                      [
                        "Network provider",
                        state.providers.find((p) => p.id === createProvider)!
                          .name,
                      ],
                      ["Name", createName],
                      ["Username", `${createUser}@${radius.realm}`],
                      [
                        "Service profile",
                        state.profiles.find((p) => p.id === createProfile)!
                          .name,
                      ],
                      ["Authentication", "Access-Accept"],
                      ["Network", "Reserved lab dual-stack session"],
                      ["IPv4 mode", "Direct IPv4 · no CGNAT"],
                    ],
                  );
                }}
              >
                <div className="form-grid">
                  <label>
                    Subscriber name
                    <input
                      autoComplete="off"
                      required
                      minLength={2}
                      maxLength={64}
                      placeholder="e.g. Alex Morgan"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                    />
                  </label>
                  <label>
                    RADIUS username
                    <div className="input-suffix">
                      <input
                        aria-label="RADIUS username"
                        autoComplete="off"
                        required
                        pattern="[a-zA-Z0-9._-]{2,48}"
                        placeholder="alex.morgan"
                        value={createUser}
                        onChange={(e) => setCreateUser(e.target.value)}
                      />
                      <span>@{radius.realm}</span>
                    </div>
                  </label>
                  <label>
                    Network provider
                    <select
                      value={createProvider}
                      onChange={(e) => {
                        setCreateProvider(e.target.value);
                        setCreateProfile(
                          state.profiles.find(
                            (p) => p.provider === e.target.value,
                          )?.id || "",
                        );
                      }}
                    >
                      {state.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Service profile
                    <select
                      required
                      value={createProfile}
                      onChange={(e) => setCreateProfile(e.target.value)}
                    >
                      {!createProfile && (
                        <option value="">
                          No service profiles — add one first
                        </option>
                      )}
                      {state.profiles
                        .filter((p) => p.provider === createProvider)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.down}/{p.up} Mb/s
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="callout">
                  <ShieldCheck size={18} />
                  <p>
                    Creates a subscriber service and assigns its network policy.
                    No password or real account is needed.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={!createProfile}>
                    Review subscriber <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
            {modal.kind === "profile" && modal.sub && (
              <>
                <p className="modal-description">
                  Choose a new package for {modal.sub.name}. Review the policy
                  transition before applying.
                </p>
                <label>
                  Network provider
                  <select
                    value={profileProvider}
                    onChange={(e) => {
                      setProfileProvider(e.target.value);
                      setProfileChoice(
                        state.profiles.find(
                          (p) => p.provider === e.target.value,
                        )?.id || "",
                      );
                    }}
                  >
                    {state.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!profileChoice && (
                  <p>
                    This provider has no service profiles. Add a service profile
                    first.
                  </p>
                )}
                <div className="profile-options">
                  {state.profiles
                    .filter((p) => p.provider === profileProvider)
                    .map((p) => (
                      <label
                        className={profileChoice === p.id ? "selected" : ""}
                        key={p.id}
                      >
                        <input
                          type="radio"
                          name="profile"
                          value={p.id}
                          checked={profileChoice === p.id}
                          onChange={() => setProfileChoice(p.id)}
                        />
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.down} Mb/s down · {p.up} Mb/s up
                          </small>
                        </span>
                        <Gauge size={18} />
                      </label>
                    ))}
                </div>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    disabled={
                      !profileChoice || profileChoice === modal.sub.profile
                    }
                    onClick={() =>
                      preview(
                        {
                          type: "profile",
                          id: modal.sub!.id,
                          profile: profileChoice,
                          provider: profileProvider,
                        },
                        "Review service profile change",
                        [
                          ["Subscriber", modal.sub!.name],
                          [
                            "Network provider",
                            state.providers.find(
                              (p) => p.id === profileProvider,
                            )!.name,
                          ],
                          [
                            "Profile",
                            `${profile(modal.sub!).name} → ${state.profiles.find((p) => p.id === profileChoice)!.name}`,
                          ],
                          ["Session", "Retained · CoA"],
                          [
                            "Policy revision",
                            `${state.revision} → ${state.revision + 1}`,
                          ],
                        ],
                      )
                    }
                  >
                    Review change <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
            {modal.kind === "addressing" && modal.sub && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const sub = modal.sub!;
                  preview(
                    {
                      type: "addressing",
                      id: sub.id,
                      mode: addressChoice,
                      ...(addressChoice === "static"
                        ? { staticIp: staticInput }
                        : {}),
                    },
                    "Review IPv4 addressing change",
                    [
                      ["Subscriber", sub.name],
                      [
                        "Mode",
                        `${addressModeLabel[sub.addressMode]} → ${addressModeLabel[addressChoice]}`,
                      ],
                      [
                        "IPv4",
                        `${sub.ip} → ${addressChoice === "static" ? staticInput : subscriberIp(Number(sub.id.slice(4)) - 1, addressChoice)}`,
                      ],
                      [
                        "CGNAT",
                        addressChoice === "cgnat"
                          ? "New mapping allocated"
                          : "Bypassed · old NAT mappings closed",
                      ],
                      [
                        "Session impact",
                        "Current IPv4 reconnect; old IPv4 flows end",
                      ],
                      ["IPv6", "WAN address and delegated prefix retained"],
                    ],
                  );
                }}
              >
                <p className="modal-description">
                  Choose how {modal.sub.name} reaches the IPv4 internet. Direct
                  and static services bypass CGNAT.
                </p>
                <div className="address-mode-options">
                  {(["cgnat", "direct", "static"] as AddressMode[]).map(
                    (mode) => (
                      <label
                        className={addressChoice === mode ? "selected" : ""}
                        key={mode}
                      >
                        <input
                          type="radio"
                          name="address-mode"
                          value={mode}
                          checked={addressChoice === mode}
                          onChange={() => setAddressChoice(mode)}
                        />
                        <span>
                          <strong>{addressModeLabel[mode]}</strong>
                          <small>
                            {mode === "cgnat"
                              ? "Shared address · subscriber NAT attribution"
                              : mode === "direct"
                                ? "Automatic routed IPv4 · no translation"
                                : "Reserved routed IPv4 · enter a specific address"}
                          </small>
                        </span>
                      </label>
                    ),
                  )}
                </div>
                {addressChoice === "static" && (
                  <label className="static-ip-field">
                    Static IPv4 address
                    <input
                      aria-label="Static IPv4 address"
                      required
                      placeholder="198.18.0.11"
                      value={staticInput}
                      onChange={(e) => setStaticInput(e.target.value)}
                      maxLength={32}
                    />
                    <small>
                      Reserved lab ranges only. Address ownership is checked
                      before apply.
                    </small>
                  </label>
                )}
                <div className="callout">
                  <Globe2 size={17} />
                  <p>
                    Direct services use reserved benchmark addresses
                    (198.18.0.0/15), not real publicly routed IPs. Switching
                    mode ends existing IPv4 flows; IPv6 stays assigned.
                  </p>
                </div>
                {addressChoice === "cgnat" &&
                  modal.sub.addressMode !== "cgnat" &&
                  state.poolUsed >= state.poolCapacity && (
                    <div className="notice">
                      The CGNAT pool is full.{" "}
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setModal(null);
                          go("cgnat");
                        }}
                      >
                        Expand capacity first <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                {formError && (
                  <p className="error-text" role="alert">
                    {formError}
                  </p>
                )}
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary">
                    Review addressing change <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
            {modal.kind === "preview" && (
              <>
                <div className="change-status">
                  <ShieldCheck size={19} />
                  <span>
                    Configuration validation passed{" "}
                    <small>
                      Expected configuration revision: {modal.expectedRevision}
                    </small>
                  </span>
                  <Badge>Ready to apply</Badge>
                </div>
                <dl className="detail-list preview-list">
                  {modal.rows?.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="callout">
                  <Sparkles size={17} />
                  <p>
                    The configuration revision and audit history will update
                    when you apply this change.
                  </p>
                </div>
                {formError && (
                  <p className="error-text" role="alert">
                    {formError}
                  </p>
                )}
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      execute(modal.action!, modal.expectedRevision)
                    }
                  >
                    <Check size={15} /> Apply change
                  </button>
                </div>
              </>
            )}
            {modal.kind === "subscriber" && modal.sub && (
              <>
                <div className="subscriber-modal-heading">
                  <span className="avatar large">
                    {initials(modal.sub.name)}
                  </span>
                  <div>
                    <strong>{modal.sub.username}</strong>
                    <p>{modal.sub.circuit}</p>
                  </div>
                  <Badge
                    tone={modal.sub.status === "online" ? "green" : "amber"}
                  >
                    {statusLabel[modal.sub.status]}
                  </Badge>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Service profile</dt>
                    <dd>
                      {profile(modal.sub).name} · {profile(modal.sub).down}/
                      {profile(modal.sub).up} Mb/s
                    </dd>
                  </div>
                  <div>
                    <dt>IPv4 mode</dt>
                    <dd>
                      {addressModeLabel[modal.sub.addressMode]}
                      {modal.sub.addressMode !== "cgnat" && " · NAT bypass"}
                    </dd>
                  </div>
                  <div>
                    <dt>MAC address</dt>
                    <dd className="mono">{modal.sub.mac}</dd>
                  </div>
                  <div>
                    <dt>IPv6 WAN address</dt>
                    <dd className="mono">{modal.sub.ipv6Address}</dd>
                  </div>
                  <div>
                    <dt>IPv4 address</dt>
                    <dd className="mono">{modal.sub.ip}</dd>
                  </div>
                  <div>
                    <dt>IPv6 prefix</dt>
                    <dd className="mono">{modal.sub.ipv6}</dd>
                  </div>
                  <div>
                    <dt>Gateway</dt>
                    <dd>
                      {modal.sub.status === "online"
                        ? state.active
                        : "Awaiting admission"}
                    </dd>
                  </div>
                  <div>
                    <dt>Network provider</dt>
                    <dd>
                      {
                        state.providers.find(
                          (p) => p.id === modal.sub!.provider,
                        )?.name
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Access VLAN</dt>
                    <dd>{modal.sub.vlan}</dd>
                  </div>
                  <div>
                    <dt>Session ID</dt>
                    <dd className="mono">session-{modal.sub.id}</dd>
                  </div>
                </dl>
                <div className="modal-actions wrap">
                  <button
                    className="button secondary"
                    onClick={() => showAddressing(modal.sub!)}
                  >
                    <Globe2 size={15} />
                    Change IPv4 mode
                  </button>
                  {modal.sub.addressMode === "cgnat" && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        const mappings = state.mappings.filter(
                          (m) => m.subscriber === modal.sub!.id && !m.ended,
                        );
                        const mapping = mappings[0];
                        go("cgnat");
                        setModal(null);
                        if (mapping) {
                          setMapIp(mapping.publicIp);
                          setMapPort(String(mapping.port));
                          setMapProtocol(mapping.protocol);
                          setMapAt(new Date().toISOString().slice(0, 16));
                          setMappingResults(mappings);
                        } else {
                          setMappingResults([]);
                          notify("No active NAT mappings for this subscriber.");
                        }
                      }}
                    >
                      <GitBranch size={15} />
                      View NAT mappings
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => diagnostic(modal.sub!)}
                  >
                    <Activity size={15} /> Diagnose
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => showProfile(modal.sub!)}
                  >
                    Change profile
                  </button>
                  {modal.sub.status === "online" && (
                    <button
                      className="button danger"
                      onClick={() =>
                        preview(
                          { type: "suspend", id: modal.sub!.id },
                          "Suspend subscriber service",
                          [
                            ["Subscriber", modal.sub!.name],
                            ["Policy", "Suspended · block IPv4 and IPv6"],
                            ["Restoration", "Restore from subscriber details"],
                          ],
                        )
                      }
                    >
                      Suspend service
                    </button>
                  )}
                  {modal.sub.status === "suspended" && (
                    <button
                      className="button primary"
                      onClick={() =>
                        preview(
                          { type: "restore", id: modal.sub!.id },
                          "Restore subscriber service",
                          [
                            ["Subscriber", modal.sub!.name],
                            ["Profile", profile(modal.sub!).name],
                          ],
                        )
                      }
                    >
                      Restore service
                    </button>
                  )}
                </div>
              </>
            )}
            {modal.kind === "tour" && (
              <>
                <p className="modal-description">
                  Choose an operational workflow. Changes are saved for this
                  browser session.
                </p>
                <div className="scenario-list">
                  {scenarios.map((s, i) => (
                    <button key={s.id} onClick={() => startScenario(s.id)}>
                      <span className="scenario-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.description}</small>
                      </span>

                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.kind === "reset" && (
              <>
                <div className="callout">
                  <RefreshCw size={18} />
                  <p>
                    Configuration changes and operation history in this session
                    will be cleared. Other visitors are unaffected.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Keep exploring
                  </button>
                  <button
                    className="button primary"
                    onClick={async () => {
                      try {
                        setState(
                          remote.current
                            ? await remote.current.mutate(state, "reset")
                            : seed(),
                        );
                        setMappingResults(null);
                        setModal(null);
                        go("overview");
                        notify("Initial configuration restored.");
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Reset workspace
                  </button>
                </div>
              </>
            )}
            {modal.kind === "settings" && (
              <>
                <div className="form-grid">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={mfa}
                      onChange={(e) => setMfa(e.target.checked)}
                    />
                    <span>
                      Require MFA for administrators
                      <small>
                        Require enrollment at the next administrator sign-in.
                      </small>
                    </span>
                  </label>
                  <label>
                    Event retention
                    <select
                      value={retention}
                      onChange={(e) => setRetention(Number(e.target.value))}
                    >
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </label>
                </div>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      preview(
                        { type: "settings", mfa, retention },
                        "Review workspace preferences",
                        [
                          ["MFA policy", mfa ? "Required" : "Not required"],
                          ["Retention", `${retention} days`],
                        ],
                      )
                    }
                  >
                    Review preferences
                  </button>
                </div>
              </>
            )}
            {modal.kind === "about" && (
              <>
                <p className="modal-description">
                  LiquidNAT Manager · Gateway and RADIUS administration
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Version</dt>
                    <dd>{state.version}</dd>
                  </div>
                  <div>
                    <dt>Active gateway</dt>
                    <dd>{state.active}</dd>
                  </div>
                  <div>
                    <dt>Configuration revision</dt>
                    <dd>{state.revision}</dd>
                  </div>
                  <div>
                    <dt>Storage</dt>
                    <dd>
                      Browser session · changes survive page refresh and reset
                      when the tab is closed.
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  icon,
  footer,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  footer: React.ReactNode;
}) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon icon={icon} size={18} />
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-footer">{footer}</div>
    </article>
  );
}
function JobPanel({ jobs, now }: { jobs: Workspace["jobs"]; now: number }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Operation jobs</h2>
          <p>Recent operation history</p>
        </div>
        <span className="subtle-tag">CURRENT</span>
      </div>
      {!jobs.length ? (
        <Empty
          title="No operations yet"
          detail="Start a failover, upgrade, or backup to explore a job timeline."
        />
      ) : (
        jobs.map((j) => (
          <div className="job" key={j.id}>
            <div>
              <strong>{j.type[0].toUpperCase() + j.type.slice(1)}</strong>
              <Badge tone={j.status === "completed" ? "green" : "blue"}>
                {j.status}
              </Badge>
            </div>
            <p>{j.detail}</p>
            <div className="job-stages">
              {["Prepare", "Stage", "Apply", "Verify"].map((step, i) => (
                <span
                  key={step}
                  className={
                    j.status === "completed" ||
                    (now - j.started) / (j.due - j.started) > i / 4
                      ? "done"
                      : ""
                  }
                >
                  <CheckCircle2 size={14} />
                  {step}
                </span>
              ))}
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${j.status === "completed" ? 100 : Math.max(3, Math.min(99, ((now - j.started) / (j.due - j.started)) * 100))}%`,
                }}
              />
            </div>
            <small>
              {j.status === "completed"
                ? "Operation completed. Configuration verified."
                : "Operation in progress…"}
            </small>
          </div>
        ))
      )}
    </section>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
