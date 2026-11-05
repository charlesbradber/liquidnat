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
import "./style.css";
import "./search-addressing.css";
import { HttpDemoBackend } from "./backend";

type Area =
  | "overview"
  | "subscribers"
  | "profiles"
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
  const [tab, setTab] = useState("interfaces");
  const [mapIp, setMapIp] = useState("203.0.113.10");
  const [mapPort, setMapPort] = useState("40012");
  const [mapProtocol, setMapProtocol] = useState("TCP");
  const [mapAt, setMapAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [mappingResults, setMappingResults] = useState<ReturnType<
    typeof lookup
  > | null>(null);
  const [createName, setCreateName] = useState("");
  const [createUser, setCreateUser] = useState("");
  const [createProfile, setCreateProfile] = useState("home500");
  const [profileChoice, setProfileChoice] = useState("home500");
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
    setMobile(false);
    setQuery("");
    setFilter("all");
    setModeFilter("all");
    setPage(0);
    setTab(target === "network" ? "interfaces" : "");
  };
  const notify = (message: string) => setToast(message);
  const execute = async (action: Action, expectedRevision = state.revision) => {
    try {
      const next = remote.current
        ? await remote.current.mutate(
            { ...state, revision: expectedRevision },
            action,
          )
        : apply(state, action, expectedRevision);
      setState(next);
      setModal(null);
      setFormError("");
      notify(
        action.type === "create"
          ? "Subscriber created and connected in your demo workspace."
          : "Demo change applied. Audit history updated.",
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
      apply(state, action, state.revision);
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
      description:
        "Review the proposed change before applying it to your isolated demo workspace.",
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
          matchesSubscriber(s, query) &&
          (modeFilter === "all" || s.addressMode === modeFilter),
      ),
    [state, query, filter, modeFilter],
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
          : "Open Alex Bennett to suspend and restore the demo service.",
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
  const minutes = Math.max(0, Math.ceil((state.expires - clock) / 60000));

  function TrafficChart() {
    const xs = Array.from({ length: 49 }, (_, i) => i);
    const range =
      chartTime === "24 hours" ? 0.6 : chartTime === "15 min" ? 1.6 : 1;
    const points = xs
      .map(
        (i) =>
          `${40 + i * 12.9},${155 - (38 + Math.sin(i * 0.41 * range) * 18 + Math.cos(i * 0.93) * 9 + i * 0.9)}`,
      )
      .join(" ");
    const upload = xs
      .map(
        (i) =>
          `${40 + i * 12.9},${167 - (20 + Math.sin(i * 0.38) * 7 + i * 0.23)}`,
      )
      .join(" ");
    return (
      <svg
        className="traffic-chart"
        viewBox="0 0 690 208"
        role="img"
        aria-label={`Simulated downstream and upstream traffic over ${chartTime}`}
      >
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#13a99e" stopOpacity=".2" />
            <stop offset="100%" stopColor="#13a99e" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="40"
              x2="674"
              y1={20 + i * 38}
              y2={20 + i * 38}
              stroke="#edf0f3"
              strokeDasharray="3 4"
            />
            <text x="3" y={24 + i * 38}>
              {120 - i * 30}G
            </text>
          </g>
        ))}
        <polygon points={`40,172 ${points} 660,172`} fill="url(#fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#119c90"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polyline
          points={upload}
          fill="none"
          stroke="#879ec0"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {["09:00", "09:10", "09:20", "09:30", "09:40", "09:50", "10:00"].map(
          (x, i) => (
            <text key={x} x={40 + i * 103} y="201">
              {x}
            </text>
          ),
        )}
      </svg>
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
            detail="Changes and scenario results will appear here."
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
            setModal({ kind: "about", title: "Your demo workspace" })
          }
        >
          <span className="workspace-icon">E</span>
          <span>
            ExampleNet<small>Isolated demo workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.slice(0, 6).map((n) => (
            <button
              key={n.id}
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
              <Sparkles size={16} /> A little guidance?
            </span>
            <p>Explore the platform in a few minutes.</p>
            <button
              onClick={() =>
                setModal({
                  kind: "tour",
                  title: "Your network playground",
                  description:
                    "Nine guided scenarios. No hardware, credentials, or real traffic required.",
                })
              }
            >
              Open demo guide <ArrowRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-help"
            onClick={() =>
              setModal({ kind: "about", title: "About this demo" })
            }
          >
            <CircleHelp size={17} /> Help & documentation{" "}
            <ExternalLink size={13} />
          </button>
          <div className="operator">
            <span className="operator-avatar">DE</span>
            <span>
              Demo engineer<small>Workspace administrator</small>
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
            <span>Workspace</span>
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
              <i /> All demo systems operational
            </span>
            <button
              className="icon-button"
              title="Open demo guide"
              aria-label="Open demo guide"
              onClick={() =>
                setModal({ kind: "tour", title: "Your network playground" })
              }
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
              <Sparkles size={12} /> INTERACTIVE DEMO
            </span>
            <span>
              This is your playground. All network data and actions are
              simulated.
            </span>
          </span>
          <button
            onClick={() =>
              setModal({
                kind: "reset",
                title: "Reset your workspace?",
                description:
                  "Restore the original fictional subscribers, events, pools, and scenarios. This only affects your current browser session.",
              })
            }
          >
            <RefreshCw size={13} /> Reset demo
          </button>
        </div>
        {!backendReady && (
          <div className="notice">
            Connecting to the PHP demo API… If unavailable, open the
            browser-only demo without ?backend=php.
          </div>
        )}
        {!storageAvailable && (
          <div className="notice">
            Browser storage is unavailable. This workspace will reset when the
            page reloads.
          </div>
        )}
        {minutes === 0 && (
          <div className="notice error">
            This demo session has expired. Use Reset demo to start a new
            isolated workspace.
          </div>
        )}
        <main inert={!backendReady}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                EXAMPLENET · DEMO LAB <span>/</span> LIQUIDNAT MANAGER
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
                      "A clear view of your network. A simpler way to run it.",
                    subscribers:
                      "Manage access, investigate sessions, and keep your customers connected.",
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
                      "Access policies and audit history for your demo workspace.",
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
                        title: "Your network playground",
                      })
                    }
                  >
                    <Play size={15} /> Explore demo
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
            <>
              <section className="metrics-grid">
                <Metric
                  label="Connected subscribers"
                  value={online.toLocaleString()}
                  unit={`/ ${state.subscribers.length}`}
                  icon={Users}
                  footer={
                    <>
                      <span className="positive">
                        <ArrowUpRight size={13} />{" "}
                        {state.completed.includes("first")
                          ? "+1 new connection"
                          : "97.7% online"}
                      </span>
                      <span>across 2 gateways</span>
                    </>
                  }
                />
                <Metric
                  label="Total throughput"
                  value={throughput.toFixed(2)}
                  unit="Gb/s"
                  icon={Activity}
                  footer={
                    <>
                      <span className="positive">
                        <ArrowDownLeft size={13} />{" "}
                        {(throughput * 0.88).toFixed(2)} down
                      </span>
                      <span>
                        <ArrowUpRight size={13} />{" "}
                        {(throughput * 0.12).toFixed(2)} up
                      </span>
                    </>
                  }
                />
                <Metric
                  label="Gateway health"
                  value="2"
                  unit="/ 2 healthy"
                  icon={Server}
                  footer={
                    <>
                      <span className="positive">
                        <i className="tiny-dot" /> Active / standby
                      </span>
                      <span>Simulated HA</span>
                    </>
                  }
                />
                <Metric
                  label="Open incidents"
                  value={String(issues.length)}
                  icon={Shield}
                  footer={
                    <>
                      <span
                        className={issues.length ? "warning-text" : "positive"}
                      >
                        {issues.length ? "Needs your attention" : "All clear"}
                      </span>
                      <button
                        className="text-link"
                        onClick={() => go("diagnostics")}
                      >
                        Investigate <ArrowRight size={12} />
                      </button>
                    </>
                  }
                />
              </section>
              <div className="overview-middle">
                <section className="panel traffic-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Network traffic{" "}
                        <span className="subtle-tag">SIMULATED</span>
                      </h2>
                      <p>Aggregate traffic across your gateways</p>
                    </div>
                    <div className="inline-controls">
                      <button
                        className="icon-button"
                        aria-label={paused ? "Resume chart" : "Pause chart"}
                        onClick={() => setPaused(!paused)}
                      >
                        {paused ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                      <select
                        aria-label="Traffic time range"
                        value={chartTime}
                        onChange={(e) => setChartTime(e.target.value)}
                      >
                        <option>15 min</option>
                        <option>1 hour</option>
                        <option>24 hours</option>
                      </select>
                    </div>
                  </div>
                  <div className="chart-key">
                    <span>
                      <i className="teal-dot" />
                      Downstream{" "}
                      <strong>{(throughput * 0.88).toFixed(2)} Gb/s</strong>
                    </span>
                    <span>
                      <i className="blue-dot" />
                      Upstream{" "}
                      <strong>{(throughput * 0.12).toFixed(2)} Gb/s</strong>
                    </span>
                  </div>
                  <TrafficChart />
                  <div className="chart-footer">
                    <span>
                      <i className={`tiny-dot ${paused ? "grey" : ""}`} />
                      {paused ? "Playback paused" : "Demo playback active"}
                    </span>
                    <span>Generated data · not a performance measurement</span>
                  </div>
                </section>
                <section className="panel gateway-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Gateway pair</h2>
                      <p>London lab · active / standby</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Gateway operations"
                      onClick={() => go("operations")}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                  {["gateway-01", "gateway-02"].map((node, i) => (
                    <div className="gateway-card" key={node}>
                      <div className="node-icon">
                        <Server size={22} />
                        <i />
                      </div>
                      <div className="node-info">
                        <strong>{node}</strong>
                        <span>LiquidNAT Gateway · {state.version}</span>
                      </div>
                      <Badge tone={state.active === node ? "green" : "grey"}>
                        {state.active === node ? "Active" : "Standby"}
                      </Badge>
                      <div className="node-metrics">
                        <span>
                          CPU{" "}
                          <strong>
                            {state.active === node ? "24%" : "6%"}
                          </strong>
                          <b>
                            <i
                              style={{
                                width: state.active === node ? "24%" : "6%",
                              }}
                            />
                          </b>
                        </span>
                        <span>
                          Memory{" "}
                          <strong>
                            {i === 0 ? "3.2" : "2.8"} <small>/ 16 GB</small>
                          </strong>
                          <b>
                            <i style={{ width: "20%" }} />
                          </b>
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="replication">
                    <ShieldCheck size={16} />
                    <span>
                      State replication <strong>In sync</strong>
                    </span>
                    <span>Simulated</span>
                  </div>
                  <button
                    className="panel-footer-link"
                    onClick={() => go("operations")}
                  >
                    View gateway operations <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <div className="overview-lower">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p>The latest events in your workspace</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => {
                        go("operations");
                        setTab("events");
                      }}
                    >
                      View all <ArrowRight size={13} />
                    </button>
                  </div>
                  <EventList />
                </section>
                <section className="guide-card">
                  <div className="guide-icon">
                    <Waypoints size={23} />
                  </div>
                  <span className="eyebrow">GET HANDS-ON</span>
                  <h2>Go beyond the dashboard.</h2>
                  <p>
                    Connect a subscriber. Follow an authentication failure.
                    Practice a gateway failover.
                  </p>
                  <div className="guide-progress">
                    <span>
                      {state.completed.length} of 9 scenarios completed
                    </span>
                    <b>{Math.round((state.completed.length / 9) * 100)}%</b>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${(state.completed.length / 9) * 100}%`,
                      }}
                    />
                  </div>
                  <button
                    className="button"
                    onClick={() =>
                      setModal({
                        kind: "tour",
                        title: "Your network playground",
                        description:
                          "A guided tour of everyday network operations. Choose any scenario to begin.",
                      })
                    }
                  >
                    Start exploring <ArrowRight size={16} />
                  </button>
                  <small>About 5–10 minutes. Reset whenever you like.</small>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Subscriber snapshot</h2>
                    <p>Fictional services, ready to explore</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => go("subscribers")}
                  >
                    All subscribers <ArrowRight size={13} />
                  </button>
                </div>
                <SubscriberTable compact />
              </section>
            </>
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
                <span className="right">Fictional subscriber data only</span>
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
                          "liquidnat-demo-subscribers.json",
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

          {area === "profiles" && (
            <>
              <div className="notice">
                <Gauge size={17} /> Choose a profile to assign it to a
                subscriber. Speed policies and CoA are simulated; no real
                traffic is shaped.
              </div>
              <div className="profile-grid">
                {state.profiles.map((p) => (
                  <section className="panel profile-card" key={p.id}>
                    <div className="profile-symbol">
                      <Zap size={23} />
                    </div>
                    <span className="eyebrow">RESIDENTIAL FIBRE</span>
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
                  footer="Calculated from demo subscriber states"
                />
                <Metric
                  label="Integrated RADIUS"
                  value="2"
                  unit="replicas"
                  icon={Server}
                  footer="Simulation · no live RADIUS endpoints"
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
                      <p>
                        Reproducible fixture decisions · no passwords stored
                      </p>
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
                      <p>LiquidNAT RADIUS · demo service boundary</p>
                    </div>
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Primary</dt>
                      <dd>radius-01.demo.internal</dd>
                    </div>
                    <div>
                      <dt>Secondary</dt>
                      <dd>radius-02.demo.internal</dd>
                    </div>
                    <div>
                      <dt>Realm</dt>
                      <dd className="mono">example.net</dd>
                    </div>
                    <div>
                      <dt>Client network</dt>
                      <dd className="mono">192.0.2.0/24</dd>
                    </div>
                    <div>
                      <dt>New sessions during outage</dt>
                      <dd>Reject · fail closed</dd>
                    </div>
                    <div>
                      <dt>Shared secret</dt>
                      <dd>Not used by this simulation</dd>
                    </div>
                  </dl>
                  <div className="callout">
                    <LockKeyhole size={18} />
                    <p>
                      This demo cannot contact RADIUS servers, accept
                      credentials, or authenticate a real subscriber.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          {area === "network" && (
            <>
              <div className="tabs">
                {["interfaces", "routes", "addressing"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {tab === "interfaces" && (
                <>
                  <section className="panel topology-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Reference topology</h2>
                        <p>Isolated fictional handoff · simulation</p>
                      </div>
                      <Badge>All links up</Badge>
                    </div>
                    <div className="topology">
                      <div>
                        <Users />
                        <strong>Subscriber access</strong>
                        <small>VLAN 200 · QinQ capable</small>
                      </div>
                      <span className="topology-line">
                        <i />
                      </span>
                      <div className="selected">
                        <Droplets />
                        <strong>{state.active}</strong>
                        <small>LiquidNAT Gateway</small>
                      </div>
                      <span className="topology-line">
                        <i />
                      </span>
                      <div>
                        <Globe2 />
                        <strong>Upstream</strong>
                        <small>Documentation network</small>
                      </div>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Interfaces</h2>
                      <span className="muted">Simulated link telemetry</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Interface</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Address</th>
                          <th>MTU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "access0.200",
                            "Subscriber access",
                            "100.64.0.1/24",
                            "1492",
                          ],
                          ["upstream0", "Upstream", "198.51.100.2/30", "1500"],
                          ["mgmt0", "Management", "192.0.2.10/24", "1500"],
                          [
                            "replica0",
                            "HA replication",
                            "192.0.2.129/30",
                            "1500",
                          ],
                        ].map((row) => (
                          <tr key={row[0]}>
                            <td className="mono">{row[0]}</td>
                            <td>{row[1]}</td>
                            <td>
                              <Badge>Up</Badge>
                            </td>
                            <td className="mono">{row[2]}</td>
                            <td>{row[3]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              {tab === "routes" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Forwarding table</h2>
                      <p>
                        Desired and observed revision {state.revision} ·
                        simulated reconciliation
                      </p>
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Prefix</th>
                        <th>Next hop</th>
                        <th>Protocol</th>
                        <th>Interface</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["0.0.0.0/0", "198.51.100.1", "Static", "upstream0"],
                        ["::/0", "2001:db8:ffff::1", "Static", "upstream0"],
                        ["100.64.0.0/24", "Direct", "Connected", "access0.200"],
                        [
                          "2001:db8::/32",
                          "Direct",
                          "Subscriber",
                          "access0.200",
                        ],
                      ].map((r) => (
                        <tr key={r[0]}>
                          {r.map((x) => (
                            <td key={x} className="mono">
                              {x}
                            </td>
                          ))}
                          <td>
                            <Badge>Installed</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="callout">
                    <Network size={17} />
                    <p>
                      These fixtures demonstrate route visibility. The real C++
                      engine’s static forwarding lab is separate; this GUI does
                      not program it.
                    </p>
                  </div>
                </section>
              )}
              {tab === "addressing" && (
                <div className="two-columns">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Address pools</h2>
                    </div>
                    <dl className="detail-list">
                      <div>
                        <dt>Subscriber IPv4</dt>
                        <dd className="mono">100.64.0.0/16</dd>
                      </div>
                      <div>
                        <dt>IPv6 delegated aggregate</dt>
                        <dd className="mono">2001:db8::/32</dd>
                      </div>
                      <div>
                        <dt>CGNAT public pool</dt>
                        <dd className="mono">203.0.113.8/29</dd>
                      </div>
                      <div>
                        <dt>Pool admission capacity</dt>
                        <dd>{state.poolCapacity} simulated subscribers</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Access handoff</h2>
                    </div>
                    <dl className="detail-list">
                      <div>
                        <dt>Expected service VLAN</dt>
                        <dd>200</dd>
                      </div>
                      <div>
                        <dt>VLAN mismatch incidents</dt>
                        <dd>
                          {
                            state.subscribers.filter(
                              (s) => s.status === "vlan-mismatch",
                            ).length
                          }
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="button secondary inset"
                      onClick={() => {
                        setSelectedDiagnostic("sub-0127");
                        go("diagnostics");
                      }}
                    >
                      Inspect circuit VLAN <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
              )}
            </>
          )}

          {area === "cgnat" && (
            <>
              <div className="metrics-grid three">
                <Metric
                  label="CGNAT subscribers"
                  value={addressCounts.cgnat.toLocaleString()}
                  icon={GitBranch}
                  footer="Shared IPv4 · searchable fictional mappings"
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
                    This is a seeded capacity scenario, not measured NAT port
                    occupancy.
                  </p>
                  <button
                    className="button secondary"
                    disabled={state.poolExpanded}
                    onClick={() =>
                      preview(
                        { type: "expand-pool" },
                        "Expand demo pool capacity",
                        [
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
                        ],
                      )
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
                      <dt>Fictional mappings</dt>
                      <dd>{state.mappings.length}</dd>
                    </div>
                    <div>
                      <dt>Journal status</dt>
                      <dd>
                        <Badge>Fixture available</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Retention preference</dt>
                      <dd>{state.retention} days · simulated</dd>
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
                      Find the fictional subscriber behind a public connection.
                      The example tuple is ready to search.
                    </p>
                  </div>
                  <span className="subtle-tag">SIMULATED</span>
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
                                Mapping found · fictional attribution
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
                                <dd className="mono">demo-{sub.id}</dd>
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
                    <Sparkles size={17} /> Training environment: failover and
                    upgrades animate a simulated timeline. They do not test
                    appliance reliability or packet continuity.
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
                          <dd>Training fixture only</dd>
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
                              ["Scope", "This demo workspace only"],
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
                        <RefreshCw size={15} /> Simulate failover
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
                          <dt>Current demo version</dt>
                          <dd className="mono">{state.version}</dd>
                        </div>
                        <div>
                          <dt>Available version</dt>
                          <dd className="mono">0.2.1-demo</dd>
                        </div>
                        <div>
                          <dt>Last demo backup</dt>
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
                          disabled={!!running || state.version === "0.2.1-demo"}
                          onClick={() =>
                            preview(
                              { type: "upgrade" },
                              "Preview demo upgrade",
                              [
                                ["Target version", "0.2.1-demo"],
                                ["Preflight", "Compatible fixture profile"],
                                ["Backup", "Created before activation"],
                                ["Rollback", "Restore 0.2.0-demo"],
                                ["Real appliance changes", "None"],
                              ],
                            )
                          }
                        >
                          <ArrowDownToLine size={15} /> Preview upgrade
                        </button>
                        {state.version === "0.2.1-demo" && (
                          <button
                            className="button secondary"
                            onClick={() =>
                              preview(
                                { type: "rollback" },
                                "Roll back demo version",
                                [
                                  ["Version", "0.2.1-demo → 0.2.0-demo"],
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
                        Export fictional workspace state. No credentials or real
                        network configuration are included.
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        disabled={!!running}
                        onClick={() => execute({ type: "backup" })}
                      >
                        <Database size={15} /> Create demo backup
                      </button>
                      <button
                        className="button secondary"
                        disabled={!state.backupAt}
                        onClick={() =>
                          DownloadJson(
                            {
                              product: "LiquidNAT demo",
                              simulation: true,
                              ...state,
                            },
                            "liquidnat-demo-backup.json",
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
                      <p>Most recent 100 entries · fictional records</p>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        DownloadJson(state.events, "liquidnat-demo-events.json")
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
                      <p>{chosen.username} · simulated evidence chain</p>
                    </div>
                  </div>
                  <div className="journey">
                    {[
                      {
                        title: "Circuit & access handoff",
                        detail: `${chosen.circuit} · received VLAN ${chosen.vlan} · expected ${chosen.expectedVlan}`,
                        failed: chosen.status === "vlan-mismatch",
                      },
                      {
                        title: "RADIUS authentication",
                        detail:
                          chosen.status === "auth-rejected"
                            ? "Access-Reject · reason: invalid credentials"
                            : "Access-Accept · realm example.net",
                        failed: chosen.status === "auth-rejected",
                      },
                      {
                        title: "Address allocation & NAT",
                        detail:
                          chosen.status === "pool-exhausted"
                            ? "Admission blocked · pool is at capacity"
                            : `${chosen.ip} · dual-stack policy installed`,
                        failed: chosen.status === "pool-exhausted",
                      },
                      {
                        title: "Service policy",
                        detail:
                          chosen.status === "suspended"
                            ? "Suspended policy · IPv4 and IPv6 access blocked"
                            : `${profile(chosen).name} · ${profile(chosen).down}/${profile(chosen).up} Mb/s`,
                        failed: chosen.status === "suspended",
                      },
                      {
                        title: "Forwarding readiness",
                        detail:
                          chosen.status === "online"
                            ? `${chosen.gateway} · static upstream route available`
                            : "Waiting for the earlier issue to be resolved",
                        failed: chosen.status !== "online",
                      },
                    ].map((step, i) => (
                      <div
                        className={`journey-step ${step.failed ? "failed" : ""}`}
                        key={step.title}
                      >
                        <span>
                          {step.failed ? (
                            <TriangleAlert size={17} />
                          ) : (
                            <Check size={17} />
                          )}
                        </span>
                        <div>
                          <small>STEP {i + 1}</small>
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
                      <p>Based on the selected subscriber’s fixture</p>
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
                        online: "The demo session is healthy",
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
                          "Authentication, addressing, and policy are ready in this simulation. This is not a live end-to-end traffic test.",
                        suspended:
                          "The suspended policy blocks both address families. Restore the service to return to its assigned package.",
                        "auth-rejected":
                          "RADIUS returned Access-Reject, not a timeout. Reset the synthetic credential state to demonstrate recovery. No real password is collected.",
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
                          "Reset demo authentication",
                          [
                            ["Subscriber", chosen.name],
                            ["Before", "Access-Reject · invalid credentials"],
                            ["After", "Simulated Access-Accept"],
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
                            ["Session impact", "Simulated reconnect"],
                            ["Rollback", "Reset workspace to restore fixture"],
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
                  <div className="diagnostic-code">
                    <Terminal size={14} />
                    {chosen.status === "online"
                      ? "DEMO_SESSION_READY"
                      : `DEMO_${chosen.status.replaceAll("-", "_").toUpperCase()}`}
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Route lookup</h2>
                    <p>
                      Fixture-only longest-prefix preview, no external
                      destination is contacted.
                    </p>
                  </div>
                </div>
                <form
                  className="route-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRouteResult(
                      /^198\.51\.100\.(\d{1,3})$/.test(routeIp) &&
                        Number(routeIp.split(".").pop()) <= 255
                        ? "198.51.100.0/24 → upstream0 · static adjacency available"
                        : /^100\.64\./.test(routeIp)
                          ? "100.64.0.0/16 → subscriber access · fixture route"
                          : "No supported fixture route for this address.",
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
                      <p>Demo engineer · local administrator</p>
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
                      <dt>Expires</dt>
                      <dd>{minutes} minutes remaining</dd>
                    </div>
                    <div>
                      <dt>MFA preference</dt>
                      <dd>
                        {state.mfa
                          ? "Required (demo policy)"
                          : "Not required (demo policy)"}
                      </dd>
                    </div>
                    <div>
                      <dt>Real API tokens / credentials</dt>
                      <dd>Disabled in demo</dd>
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
                    Edit demo preferences <Settings2 size={14} />
                  </button>
                </section>
                <section className="panel operation-card">
                  <h2>Safe to explore</h2>
                  <p>
                    Your changes stay in this isolated session. There are no
                    production gateways, external callback URLs, real secrets,
                    or customer data behind this interface.
                  </p>
                  <ul className="safety-list">
                    <li>
                      <CheckCircle2 size={16} />
                      Synthetic documentation addresses
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      Bounded fixtures and two-hour lifetime
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
                    <RefreshCw size={14} /> Reset demo workspace
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Audit trail</h2>
                    <p>
                      Local changes and scenario outcomes · revision{" "}
                      {state.revision}
                    </p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() =>
                      DownloadJson(state.events, "liquidnat-demo-audit.json")
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
              <Droplets size={14} /> LiquidNAT Manager <b>0.2.0-demo</b>
              <span className="footer-divider">/</span> Simulated environment
            </span>
            <span>
              Private workspace · {minutes} min remaining <i /> No real network
              connected
            </span>
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
              <span className="eyebrow">LIQUIDNAT · DEMO WORKSPACE</span>
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
            {modal.kind === "create" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  preview(
                    {
                      type: "create",
                      name: createName,
                      username: `${createUser}@example.net`,
                      profile: createProfile,
                    },
                    "Review new subscriber",
                    [
                      ["Name", createName],
                      ["Username", `${createUser}@example.net`],
                      [
                        "Service profile",
                        state.profiles.find((p) => p.id === createProfile)!
                          .name,
                      ],
                      ["Authentication", "Simulated Access-Accept"],
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
                    Demo username
                    <div className="input-suffix">
                      <input
                        aria-label="Demo username"
                        autoComplete="off"
                        required
                        pattern="[a-zA-Z0-9._-]{2,48}"
                        placeholder="alex.morgan"
                        value={createUser}
                        onChange={(e) => setCreateUser(e.target.value)}
                      />
                      <span>@example.net</span>
                    </div>
                  </label>
                  <label>
                    Service profile
                    <select
                      value={createProfile}
                      onChange={(e) => setCreateProfile(e.target.value)}
                    >
                      {state.profiles.map((p) => (
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
                    Creates a fictional subscriber and simulated session. No
                    password or real account is needed.
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
                  <button className="button primary">
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
                <div className="profile-options">
                  {state.profiles.map((p) => (
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
                    disabled={profileChoice === modal.sub.profile}
                    onClick={() =>
                      preview(
                        {
                          type: "profile",
                          id: modal.sub!.id,
                          profile: profileChoice,
                        },
                        "Review service profile change",
                        [
                          ["Subscriber", modal.sub!.name],
                          [
                            "Profile",
                            `${profile(modal.sub!).name} → ${state.profiles.find((p) => p.id === profileChoice)!.name}`,
                          ],
                          ["Session", "Retained · simulated CoA"],
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
                          ? "New simulated mapping allocated"
                          : "Bypassed · old NAT mappings closed",
                      ],
                      [
                        "Session impact",
                        "Simulated IPv4 reconnect; old IPv4 flows end",
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
                    mode ends existing simulated IPv4 flows; IPv6 stays
                    assigned.
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
                    Demo validation passed{" "}
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
                    Only simulated state will change. The action will appear in
                    this workspace’s audit history.
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
                    <Check size={15} /> Apply demo change
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
                    <dt>Access VLAN</dt>
                    <dd>{modal.sub.vlan}</dd>
                  </div>
                  <div>
                    <dt>Demo session</dt>
                    <dd className="mono">demo-{modal.sub.id}</dd>
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
                          notify(
                            "No active demo NAT mappings for this subscriber.",
                          );
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
                  Nine real-world workflows, one safe playground. Pick any
                  scenario; your progress stays in this browser session.
                </p>
                <div className="tour-summary">
                  <span>{state.completed.length} / 9 completed</span>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${(state.completed.length / 9) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="scenario-list">
                  {scenarios.map((s, i) => (
                    <button key={s.id} onClick={() => startScenario(s.id)}>
                      <span
                        className={`scenario-number ${state.completed.includes(s.id) ? "done" : ""}`}
                      >
                        {state.completed.includes(s.id) ? (
                          <Check size={17} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.description}</small>
                      </span>
                      <span className="scenario-time">{s.time}</span>
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
                    Demo changes, scenario progress, and exported job history in
                    this session will be cleared. Other visitors are unaffected.
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
                        notify(
                          "Workspace reset. All original scenarios are ready.",
                        );
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
                      Require MFA in demo policy
                      <small>
                        Preference only; no real MFA enrollment occurs.
                      </small>
                    </span>
                  </label>
                  <label>
                    Event retention preference
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
                          [
                            "MFA policy",
                            mfa
                              ? "Required (simulated)"
                              : "Not required (simulated)",
                          ],
                          ["Retention", `${retention} days (preference only)`],
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
                  LiquidNAT Manager is the administration interface for
                  LiquidNAT Gateway and LiquidNAT RADIUS. This version is an
                  interactive simulation, not a running ISP network.
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Demo version</dt>
                    <dd>0.2.0-demo</dd>
                  </div>
                  <div>
                    <dt>Workspace lifetime</dt>
                    <dd>2 hours · {minutes} minutes remaining</dd>
                  </div>
                  <div>
                    <dt>Storage</dt>
                    <dd>
                      {remote.current
                        ? "PHP API · private SQLite workspace"
                        : "Session-scoped browser storage"}
                    </dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>Synthetic subscribers and reserved address ranges</dd>
                  </div>
                  <div>
                    <dt>Underlying engine</dt>
                    <dd>Original C++20/DPDK lab exists separately</dd>
                  </div>
                  <div>
                    <dt>Not connected</dt>
                    <dd>Real packet I/O, RADIUS, routing, billing, SSH</dd>
                  </div>
                </dl>
                <div className="callout">
                  <BookOpen size={18} />
                  <p>
                    The repository includes the engine lab, architecture
                    decisions, API contract, and reproducible test instructions.
                    No real credentials should be entered here.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    className="button primary"
                    onClick={() =>
                      setModal({
                        kind: "tour",
                        title: "Your network playground",
                      })
                    }
                  >
                    Explore the scenarios <ArrowRight size={14} />
                  </button>
                </div>
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
          <p>Bounded, simulated job history</p>
        </div>
        <span className="subtle-tag">SIMULATED</span>
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
                ? "Simulated operation complete; no hardware was changed."
                : "Demo job in progress…"}
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
