import React, { useState } from "react";
import {
  Action,
  Workspace,
  Profile,
  Provider,
  ConnectionType,
  connectionTypeLabel,
} from "./simulator";

type Review = (action: Action, title: string, rows: [string, string][]) => void;
export function ProviderManagement({
  state,
  review,
}: {
  state: Workspace;
  review: Review;
}) {
  const [editing, setEditing] = useState<Provider | null>(null);
  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState<ConnectionType>("pppoe");
  return (
    <section className="panel provider-management">
      <h2>{editing ? "Edit network provider" : "Add network provider"}</h2>
      <p>Manage subscribers and service profiles by network provider.</p>
      <form
        className="provider-form"
        onSubmit={(e) => {
          e.preventDefault();
          review(
            {
              type: "save-provider",
              ...(editing ? { id: editing.id } : {}),
              name,
              connectionType,
            },
            "Review network provider",
            [
              ["Network provider", name],
              ["Default connection type", connectionTypeLabel[connectionType]],
              [
                "Existing subscribers",
                "Keep their configured connection types",
              ],
            ],
          );
        }}
      >
        <label>
          Provider name
          <input
            required
            minLength={2}
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. City Fibre"
          />
        </label>
        <label>
          Default connection type
          <select
            value={connectionType}
            onChange={(e) =>
              setConnectionType(e.target.value as ConnectionType)
            }
          >
            <option value="pppoe">PPPoE</option>
            <option value="dhcp">DHCP</option>
          </select>
        </label>
        <button className="button primary">
          {editing ? "Review provider update" : "Review new provider"}
        </button>
        {editing && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            Cancel editing
          </button>
        )}
      </form>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Network provider</th>
              <th>Default connection type</th>
              <th>Subscribers</th>
              <th>Service profiles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.providers.map((p) => {
              const subscribers = state.subscribers.filter(
                (s) => s.provider === p.id,
              ).length;
              const profiles = state.profiles.filter(
                (s) => s.provider === p.id,
              ).length;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{connectionTypeLabel[p.connectionType]}</td>
                  <td>{subscribers.toLocaleString()}</td>
                  <td>{profiles}</td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setEditing(p);
                        setName(p.name);
                        setConnectionType(p.connectionType);
                      }}
                    >
                      Edit {p.name}
                    </button>{" "}
                    <button
                      className="button secondary small"
                      disabled={
                        !!subscribers ||
                        !!profiles ||
                        state.providers.length === 1
                      }
                      title="Only empty providers can be deleted; keep at least one provider."
                      onClick={() =>
                        review(
                          { type: "delete-provider", id: p.id },
                          "Delete network provider",
                          [["Network provider", p.name]],
                        )
                      }
                    >
                      Delete {p.name}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Move subscribers and remove unused profiles before deleting a provider.
      </p>
    </section>
  );
}
export function ProfileEditor({
  state,
  review,
}: {
  state: Workspace;
  review: Review;
}) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(state.providers[0].id);
  const [down, setDown] = useState(100);
  const [up, setUp] = useState(20);
  const [price, setPrice] = useState(25);
  function edit(p: Profile) {
    setEditing(p);
    setName(p.name);
    setProvider(p.provider);
    setDown(p.down);
    setUp(p.up);
    setPrice(p.price);
  }
  return (
    <section className="panel provider-management">
      <h2>{editing ? "Edit service profile" : "Add service profile"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          review(
            {
              type: "save-profile",
              ...(editing ? { id: editing.id } : {}),
              name,
              provider,
              down,
              up,
              price,
            },
            "Review service profile",
            [
              ["Service profile", name],
              [
                "Network provider",
                state.providers.find((p) => p.id === provider)!.name,
              ],
              ["Speed", `${down}/${up} Mb/s`],
              ["Monthly price", `£${price}`],
            ],
          );
        }}
      >
        <div className="form-grid">
          <label>
            Catalogue profile name
            <input
              required
              minLength={2}
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Profile network provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {state.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Download (Mb/s)
            <input
              required
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={down}
              onChange={(e) => setDown(Number(e.target.value))}
            />
          </label>
          <label>
            Upload (Mb/s)
            <input
              required
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={up}
              onChange={(e) => setUp(Number(e.target.value))}
            />
          </label>
          <label>
            Monthly price (£)
            <input
              required
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="button primary">Review service profile</button>
          {editing && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              Cancel editing
            </button>
          )}
        </div>
      </form>
      <div className="provider-profile-list">
        {state.profiles.map((p) => (
          <div key={p.id}>
            <span>
              {p.name} ·{" "}
              {
                state.providers.find((provider) => provider.id === p.provider)
                  ?.name
              }
            </span>
            <button className="button secondary small" onClick={() => edit(p)}>
              Edit {p.name}
            </button>
            <button
              className="button secondary small"
              disabled={state.subscribers.some((s) => s.profile === p.id)}
              title="Only unassigned profiles can be deleted."
              onClick={() =>
                review(
                  { type: "delete-profile", id: p.id },
                  "Delete service profile",
                  [["Service profile", p.name]],
                )
              }
            >
              Delete {p.name}
            </button>
          </div>
        ))}
      </div>
      <p>
        Move assigned subscribers before deleting a profile or changing its
        provider.
      </p>
    </section>
  );
}
