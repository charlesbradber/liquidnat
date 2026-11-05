import React, { useState } from "react";
import { Action } from "./simulator";
export type RadiusConfig = {
  primary: string;
  secondary: string;
  realm: string;
  clientNetwork: string;
  accountingInterval: number;
};
export const defaultRadius: RadiusConfig = {
  primary: "radius-01.liquidnet.internal",
  secondary: "radius-02.liquidnet.internal",
  realm: "liquidnet.net",
  clientNetwork: "192.0.2.0/24",
  accountingInterval: 300,
};
export function RadiusSettings({
  config,
  review,
}: {
  config: RadiusConfig;
  review: (action: Action, title: string, rows: [string, string][]) => void;
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(config);
  return (
    <>
      <button
        className="button secondary inset"
        onClick={() => {
          setValue(config);
          setEditing(true);
        }}
      >
        Edit RADIUS configuration
      </button>
      {editing && (
        <form
          className="form-grid inset"
          onSubmit={(e) => {
            e.preventDefault();
            review(
              { type: "radius-save", config: value },
              "Review RADIUS configuration",
              [
                ["Primary", value.primary],
                ["Secondary", value.secondary],
                ["Realm", value.realm],
                ["Client network", value.clientNetwork],
                ["Accounting interval", `${value.accountingInterval} seconds`],
              ],
            );
            setEditing(false);
          }}
        >
          {(
            [
              ["primary", "Primary server"],
              ["secondary", "Secondary server"],
              ["realm", "Subscriber realm"],
              ["clientNetwork", "Client network prefix"],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                required
                maxLength={253}
                value={value[field]}
                onChange={(e) =>
                  setValue({ ...value, [field]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Accounting interval (seconds)
            <input
              type="number"
              required
              min="60"
              max="3600"
              value={value.accountingInterval}
              onChange={(e) =>
                setValue({
                  ...value,
                  accountingInterval: Number(e.target.value),
                })
              }
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button className="button primary">Review configuration</button>
          </div>
        </form>
      )}
    </>
  );
}
