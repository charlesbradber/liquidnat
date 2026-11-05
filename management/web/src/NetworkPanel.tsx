import React, { useState } from "react";
import { Action, Workspace } from "./simulator";
import {
  Link,
  Route,
  initialNetwork,
  forwardingTable,
  validateNetwork,
} from "./network";
export function NetworkPanel({
  state,
  save,
}: {
  state: Workspace;
  save: (action: Action) => void;
}) {
  const config = state.network || initialNetwork();
  const [tab, setTab] = useState("interfaces");
  const [link, setLink] = useState<Link | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<{
    kind: "interface" | "route";
    id: string;
  } | null>(null);
  const commit = (next: typeof config) => {
    try {
      validateNetwork(next);
      save({ type: "network-save", config: next });
      setLink(null);
      setRoute(null);
      setRemove(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const table = forwardingTable(config);
  return (
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
      <section className="panel topology-panel">
        <div className="panel-heading">
          <div>
            <h2>Network topology</h2>
            <p>
              {state.active} · configuration revision {state.revision}
            </p>
          </div>
          <span className="badge green">
            {config.interfaces.filter((l) => l.enabled).length} links up
          </span>
        </div>
        <div className="topology">
          {config.interfaces.map((l) => (
            <React.Fragment key={l.id}>
              <button
                className="button secondary"
                onClick={() => {
                  setAdding(false);
                  setLink({ ...l });
                  setError("");
                }}
              >
                <strong>{l.id}</strong>
                <small>
                  {l.role} · {l.enabled ? "Up" : "Down"}
                </small>
              </button>
              <span className="topology-line">
                <i />
              </span>
            </React.Fragment>
          ))}
          <div className="selected">
            <strong>{state.active}</strong>
            <small>LiquidNAT Gateway</small>
          </div>
        </div>
      </section>
      {tab === "interfaces" && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Interfaces</h2>
            <button
              className="button primary"
              onClick={() => {
                setAdding(true);
                setLink({
                  id: "",
                  role: "Subscriber access",
                  address: "10.20.0.1/24",
                  mtu: 1500,
                  enabled: true,
                });
                setError("");
              }}
            >
              Add interface
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Interface",
                    "Role",
                    "Status",
                    "Address",
                    "MTU",
                    "Actions",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.interfaces.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.id}</td>
                    <td>{l.role}</td>
                    <td>
                      <span className={`badge ${l.enabled ? "green" : "grey"}`}>
                        {l.enabled ? "Up" : "Down"}
                      </span>
                    </td>
                    <td className="mono">
                      {l.address}
                      {l.ipv6 && <small>{l.ipv6}</small>}
                    </td>
                    <td>{l.mtu}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setAdding(false);
                          setLink({ ...l });
                          setError("");
                        }}
                      >
                        Edit {l.id}
                      </button>{" "}
                      <button
                        className="text-link"
                        onClick={() =>
                          commit({
                            ...config,
                            interfaces: config.interfaces.map((x) =>
                              x.id === l.id ? { ...x, enabled: !x.enabled } : x,
                            ),
                          })
                        }
                      >
                        {l.enabled ? "Disable" : "Enable"} {l.id}
                      </button>{" "}
                      <button
                        className="text-link"
                        onClick={() => {
                          setRemove({ kind: "interface", id: l.id });
                          setError("");
                        }}
                      >
                        Delete {l.id}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "routes" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Forwarding table</h2>
              <p>
                Connected routes follow interface configuration. Disabled links
                withdraw their routes.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setAdding(true);
                setRoute({
                  id: crypto.randomUUID(),
                  prefix: "",
                  via: "",
                  interface: config.interfaces[0]?.id || "",
                  metric: 10,
                });
                setError("");
              }}
            >
              Add route
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Prefix",
                    "Next hop",
                    "Protocol",
                    "Interface",
                    "Metric",
                    "State",
                    "Actions",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.prefix}</td>
                    <td>{r.via}</td>
                    <td>{r.protocol}</td>
                    <td>{r.interface}</td>
                    <td>{r.metric}</td>
                    <td>
                      <span
                        className={`badge ${r.installed ? "green" : "grey"}`}
                      >
                        {r.installed ? "Installed" : "Withdrawn"}
                      </span>
                    </td>
                    <td>
                      {r.protocol === "Static" ? (
                        <>
                          <button
                            className="text-link"
                            onClick={() => {
                              setAdding(false);
                              setRoute({ ...r });
                              setError("");
                            }}
                          >
                            Edit {r.prefix}
                          </button>{" "}
                          <button
                            className="text-link"
                            onClick={() => {
                              setRemove({ kind: "route", id: r.id });
                              setError("");
                            }}
                          >
                            Delete {r.prefix}
                          </button>
                        </>
                      ) : (
                        "Managed by interface"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!table.length && (
            <p className="callout">
              No routes configured. Add an interface to connect a network.
            </p>
          )}
        </section>
      )}
      {tab === "addressing" && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Connected networks and address pools</h2>
          </div>
          <dl className="detail-list">
            {table
              .filter((r) => r.protocol === "Connected")
              .map((r) => (
                <div key={r.id}>
                  <dt>{r.interface}</dt>
                  <dd className="mono">
                    {r.prefix} · {r.installed ? "Connected" : "Down"}
                  </dd>
                </div>
              ))}
            <div>
              <dt>IPv6 delegated aggregate</dt>
              <dd>2001:db8::/32</dd>
            </div>
            <div>
              <dt>CGNAT public pool</dt>
              <dd>203.0.113.8/29</dd>
            </div>
            <div>
              <dt>Subscriber capacity</dt>
              <dd>
                {state.poolUsed.toLocaleString()} /{" "}
                {state.poolCapacity.toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>
      )}
      {(link || route || remove) && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              link
                ? "Interface configuration"
                : route
                  ? "Route configuration"
                  : "Confirm deletion"
            }
          >
            <div className="modal-heading">
              <h2>
                {remove
                  ? "Delete configuration"
                  : link
                    ? "Interface configuration"
                    : "Route configuration"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close configuration"
                onClick={() => {
                  setLink(null);
                  setRoute(null);
                  setRemove(null);
                }}
              >
                ×
              </button>
            </div>
            {remove ? (
              <>
                <p>
                  Delete {remove.id}?{" "}
                  {remove.kind === "interface"
                    ? "Remove static routes using this interface first."
                    : "This route will be removed from the forwarding table."}
                </p>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setRemove(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button danger"
                    onClick={() =>
                      commit(
                        remove.kind === "interface"
                          ? {
                              ...config,
                              interfaces: config.interfaces.filter(
                                (x) => x.id !== remove.id,
                              ),
                            }
                          : {
                              ...config,
                              routes: config.routes.filter(
                                (x) => x.id !== remove.id,
                              ),
                            },
                      )
                    }
                  >
                    Confirm delete
                  </button>
                </div>
              </>
            ) : (
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (link)
                    commit({
                      ...config,
                      interfaces: adding
                        ? [...config.interfaces, link]
                        : config.interfaces.map((x) =>
                            x.id === link.id ? link : x,
                          ),
                    });
                  if (route)
                    commit({
                      ...config,
                      routes: adding
                        ? [...config.routes, route]
                        : config.routes.map((x) =>
                            x.id === route.id ? route : x,
                          ),
                    });
                }}
              >
                {link && (
                  <>
                    <label>
                      Interface name
                      <input
                        required
                        disabled={!adding}
                        value={link.id}
                        onChange={(e) =>
                          setLink({ ...link, id: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Role
                      <input
                        required
                        value={link.role}
                        onChange={(e) =>
                          setLink({ ...link, role: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      IPv4 address / prefix
                      <input
                        required
                        value={link.address}
                        onChange={(e) =>
                          setLink({ ...link, address: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      IPv6 address / prefix (optional)
                      <input
                        value={link.ipv6 || ""}
                        onChange={(e) =>
                          setLink({ ...link, ipv6: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      MTU
                      <input
                        type="number"
                        min="576"
                        max="9216"
                        required
                        value={link.mtu}
                        onChange={(e) =>
                          setLink({ ...link, mtu: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={link.enabled}
                        onChange={(e) =>
                          setLink({ ...link, enabled: e.target.checked })
                        }
                      />
                      Enabled
                    </label>
                  </>
                )}
                {route && (
                  <>
                    <label>
                      Destination prefix
                      <input
                        required
                        value={route.prefix}
                        onChange={(e) =>
                          setRoute({ ...route, prefix: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Next hop (or Direct)
                      <input
                        required
                        value={route.via}
                        onChange={(e) =>
                          setRoute({ ...route, via: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Outgoing interface
                      <select
                        value={route.interface}
                        onChange={(e) =>
                          setRoute({ ...route, interface: e.target.value })
                        }
                      >
                        {config.interfaces.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Metric
                      <input
                        type="number"
                        required
                        min="0"
                        max="65535"
                        value={route.metric}
                        onChange={(e) =>
                          setRoute({ ...route, metric: Number(e.target.value) })
                        }
                      />
                    </label>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setLink(null);
                      setRoute(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="button primary">Save configuration</button>
                </div>
              </form>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
