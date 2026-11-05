import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pause,
  Play,
  Server,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  addressModeLabel,
  statusLabel,
  type Subscriber,
  type Workspace,
} from "./simulator";

type Props = {
  workspace: Workspace;
  now: number;
  throughput: number;
  paused: boolean;
  chartTime: string;
  chart: ReactNode;
  onPause: () => void;
  onRange: (range: string) => void;
  onInspect: (sub: Subscriber) => void;
  onDiagnose: (sub: Subscriber) => void;
  onOperations: () => void;
  onSubscribers: () => void;
  onDiagnostics: () => void;
  onGuide: () => void;
};

function Pill({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span className={`dashboard-pill ${muted ? "muted" : ""}`}>{children}</span>
  );
}

export function Dashboard({
  workspace: s,
  now,
  throughput,
  paused,
  chartTime,
  chart,
  onPause,
  onRange,
  onInspect,
  onDiagnose,
  onOperations,
  onSubscribers,
  onDiagnostics,
  onGuide,
}: Props) {
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(0);
  const online = s.subscribers.filter((sub) => sub.status === "online").length;
  const incidents = s.subscribers.filter(
    (sub) => !["online", "suspended"].includes(sub.status),
  );
  const sessions = useMemo(
    () =>
      s.subscribers
        .map((sub) => ({ sub, at: Date.parse(sub.since) }))
        .sort((a, b) => b.at - a.at),
    [s.subscribers],
  );
  const activity = useMemo(() => {
    const cutoff =
      period === "all" ? 0 : now - (period === "hour" ? 3600000 : 86400000);
    return sessions
      .filter(
        ({ sub, at }) =>
          (filter === "all" ||
            (filter === "attention"
              ? !["online", "suspended"].includes(sub.status)
              : sub.status === filter)) &&
          at >= cutoff,
      )
      .map((item) => item.sub);
  }, [sessions, filter, period, now]);
  const pages = Math.max(1, Math.ceil(activity.length / 5));
  const current = Math.min(page, pages - 1);
  const rows = activity.slice(current * 5, current * 5 + 5);
  const metric = (
    title: string,
    value: ReactNode,
    detail: ReactNode,
    icon: ReactNode,
  ) => (
    <article className="dashboard-metric">
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
  return (
    <div className="reference-dashboard">
      <section className="dashboard-metrics" aria-label="Network summary">
        {metric(
          "Connected subscribers",
          <>
            {online.toLocaleString()}
            <small>/ {s.subscribers.length.toLocaleString()}</small>
          </>,
          <span className="positive">
            <ArrowUpRight size={14} />{" "}
            {(s.subscribers.length
              ? (online / s.subscribers.length) * 100
              : 0
            ).toFixed(2)}
            % online
          </span>,
          <Users size={21} />,
        )}
        {metric(
          "Total throughput",
          <>
            {throughput.toFixed(2)}
            <small>Gb/s</small>
          </>,
          <>
            <span className="positive">
              ↓ {(throughput * 0.88).toFixed(2)} Gb/s
            </span>
            <span className="metric-note">Simulated traffic</span>
          </>,
          <Activity size={21} />,
        )}
        {metric(
          "Gateway health",
          <>
            2<small>/ 2 healthy</small>
          </>,
          <span className="positive">
            <i className="tiny-dot" /> Active / standby · simulated
          </span>,
          <Server size={21} />,
        )}
        {metric(
          "Open incidents",
          incidents.length,
          <button
            className={incidents.length ? "warning-text" : "positive"}
            onClick={onDiagnostics}
          >
            {incidents.length ? "Needs your attention" : "No blocking faults"}
          </button>,
          <TriangleAlert size={21} />,
        )}
      </section>
      <div className="dashboard-traffic-row">
        <section className="panel dashboard-traffic">
          <div className="panel-heading">
            <div>
              <h2>
                Network traffic <span className="subtle-tag">SIMULATED</span>
              </h2>
              <p>Aggregate traffic across your gateways</p>
            </div>
            <div className="dashboard-chart-controls">
              <span>
                <i className="teal-dot" /> Downstream{" "}
                <b>{(throughput * 0.88).toFixed(2)} Gb/s</b>
              </span>
              <span>
                <i className="blue-dot" /> Upstream{" "}
                <b>{(throughput * 0.12).toFixed(2)} Gb/s</b>
              </span>
              <select
                aria-label="Traffic time range"
                value={chartTime}
                onChange={(e) => onRange(e.target.value)}
              >
                <option>15 min</option>
                <option>1 hour</option>
                <option>24 hours</option>
              </select>
              <button
                className="icon-button"
                aria-label={paused ? "Resume chart" : "Pause chart"}
                onClick={onPause}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
            </div>
          </div>
          {chart}
          <div className="dashboard-chart-caption">
            <span>
              <i className={`tiny-dot ${paused ? "grey" : ""}`} />{" "}
              {paused ? "Playback paused" : "Demo playback active"}
            </span>
            <span>Generated data · not a performance measurement</span>
          </div>
        </section>
        <section
          className="panel dashboard-incidents"
          aria-labelledby="incidents-title"
        >
          <div className="panel-heading">
            <h2 id="incidents-title">
              Incidents <span>({incidents.length} open)</span>
            </h2>
            <button className="text-link" onClick={onDiagnostics}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          {incidents.slice(0, 4).map((sub) => (
            <button
              key={sub.id}
              className="incident-row"
              onClick={() => onDiagnose(sub)}
            >
              <span className="incident-symbol">
                <TriangleAlert size={18} />
              </span>
              <span>
                <strong>
                  {
                    {
                      "vlan-mismatch": "Circuit VLAN mismatch",
                      "pool-exhausted": "Address pool at capacity",
                      "auth-rejected": "Authentication rejected",
                    }[
                      sub.status as
                        | "vlan-mismatch"
                        | "pool-exhausted"
                        | "auth-rejected"
                    ]
                  }
                </strong>
                <small>
                  {sub.circuit} · {sub.name}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!incidents.length && (
            <div className="dashboard-clear">
              <Check size={21} />
              <strong>No open incidents</strong>
              <p>All simulated subscriber prerequisites are ready.</p>
            </div>
          )}
          <div className="incident-footnote">
            Fixture evidence · select a fault to investigate
          </div>
        </section>
      </div>
      <section
        className="panel dashboard-gateways"
        aria-labelledby="gateways-title"
      >
        <div className="panel-heading">
          <h2 id="gateways-title">Gateways (2)</h2>
          <span className="subtle-tag">SIMULATED HEALTH</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Gateway</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">CPU</th>
                <th scope="col">Memory</th>
                <th scope="col">Throughput (D/U)</th>
                <th scope="col">Version</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {["gateway-01", "gateway-02"].map((node, index) => {
                const active = s.active === node;
                return (
                  <tr key={node}>
                    <td>
                      <div className="gateway-identity">
                        <span>
                          <Server size={24} />
                        </span>
                        <div>
                          <strong>{node}</strong>
                          <small>LiquidNAT Gateway · London lab</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Pill muted={!active}>
                        {active ? "Active" : "Standby"}
                      </Pill>
                    </td>
                    <td>
                      <span className="gateway-health">
                        <i className="tiny-dot" /> Healthy
                      </span>
                    </td>
                    <td>
                      <span>{active ? 24 : 6}%</span>
                      <div className="dashboard-mini-bar">
                        <i style={{ width: active ? "24%" : "6%" }} />
                      </div>
                    </td>
                    <td>
                      <span>{index === 0 ? "3.2" : "2.8"} / 16 GB</span>
                      <div className="dashboard-mini-bar">
                        <i style={{ width: index === 0 ? "20%" : "17.5%" }} />
                      </div>
                    </td>
                    <td className="mono">
                      {active
                        ? `${(throughput * 0.88).toFixed(2)} / ${(throughput * 0.12).toFixed(2)}`
                        : "0.00 / 0.00"}{" "}
                      Gb/s
                    </td>
                    <td>{s.version}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${node} operations`}
                        onClick={onOperations}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section
        className="panel dashboard-activity"
        aria-labelledby="subscriber-activity-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="subscriber-activity-title">Subscriber activity</h2>
            <p>Latest fictional session records in your workspace</p>
          </div>
          <div className="inline-controls">
            <select
              aria-label="Filter subscriber activity"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All sessions</option>
              <option value="online">Connected</option>
              <option value="attention">Needs attention</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              aria-label="Subscriber activity period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All times</option>
              <option value="day">Last 24 hours</option>
              <option value="hour">Last hour</option>
            </select>
            <button className="text-link" onClick={onSubscribers}>
              View all <ArrowRight size={13} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Session time ↓</th>
                <th scope="col">Subscriber</th>
                <th scope="col">State</th>
                <th scope="col">Details</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((sub) => {
                const policy = s.profiles.find((p) => p.id === sub.profile)!;
                return (
                  <tr key={sub.id}>
                    <td>
                      <time
                        dateTime={sub.since}
                        title={new Date(sub.since).toLocaleString("en-GB")}
                      >
                        {new Date(sub.since).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    </td>
                    <td>
                      <button
                        className="activity-person"
                        onClick={() => onInspect(sub)}
                      >
                        <span className="avatar">
                          {sub.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{sub.name}</strong>
                        <small>{sub.username}</small>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`dashboard-pill ${sub.status === "online" ? "" : "attention"}`}
                      >
                        <i className="tiny-dot" />
                        {statusLabel[sub.status]}
                      </span>
                    </td>
                    <td>
                      IP {sub.ip} · {addressModeLabel[sub.addressMode]} ·{" "}
                      {policy.name} ({policy.down} / {policy.up} Mb/s)
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${sub.name}`}
                        onClick={() => onInspect(sub)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="dashboard-clear">
              <Users size={22} />
              <strong>No sessions match these filters</strong>
              <p>Choose another state or time period.</p>
            </div>
          )}
        </div>
        <div className="dashboard-pagination">
          <span>
            Showing {activity.length ? current * 5 + 1 : 0}–
            {Math.min((current + 1) * 5, activity.length)} of{" "}
            {activity.length.toLocaleString()} subscribers
          </span>
          <div>
            <button
              aria-label="Previous activity page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span aria-live="polite">
              Page {current + 1} of {pages.toLocaleString()}
            </span>
            <button
              aria-label="Next activity page"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      <div className="dashboard-guide">
        <span>
          <strong>{s.completed.length} of 9 scenarios completed</strong> ·
          Explore service changes and recovery in your isolated workspace.
        </span>
        <button className="text-link" onClick={onGuide}>
          Open demo guide <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
