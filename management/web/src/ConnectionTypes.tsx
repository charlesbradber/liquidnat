import React from "react";
import {
  Action,
  Workspace,
  ConnectionType,
  connectionTypeLabel,
  radiusAccessLabel,
} from "./simulator";
export function ConnectionTypes({
  state,
  review,
}: {
  state: Workspace;
  review: (action: Action, title: string, rows: [string, string][]) => void;
}) {
  return (
    <section className="panel provider-management">
      <h2>Network connection types</h2>
      <p>
        Choose the default access type for each network provider. New
        subscribers inherit this default and can override it. Existing
        subscribers retain their configured type. RADIUS access and accounting
        remain simulated.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Network provider</th>
              <th>Default connection type</th>
              <th>PPPoE subscribers</th>
              <th>DHCP subscribers</th>
              <th>RADIUS access identity</th>
            </tr>
          </thead>
          <tbody>
            {state.providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.name}</td>
                <td>
                  <select
                    aria-label={`Connection type for ${provider.name}`}
                    value={provider.connectionType}
                    onChange={(e) => {
                      const connectionType = e.target.value as ConnectionType;
                      review(
                        {
                          type: "save-provider",
                          id: provider.id,
                          name: provider.name,
                          connectionType,
                        },
                        "Review network connection type",
                        [
                          ["Network provider", provider.name],
                          [
                            "Default connection type",
                            `${connectionTypeLabel[provider.connectionType]} → ${connectionTypeLabel[connectionType]}`,
                          ],
                          [
                            "Existing subscribers",
                            "Keep their configured connection types",
                          ],
                        ],
                      );
                    }}
                  >
                    <option value="pppoe">PPPoE</option>
                    <option value="dhcp">DHCP</option>
                  </select>
                </td>
                <td>
                  {state.subscribers
                    .filter(
                      (s) =>
                        s.provider === provider.id &&
                        s.connectionType === "pppoe",
                    )
                    .length.toLocaleString()}
                </td>
                <td>
                  {state.subscribers
                    .filter(
                      (s) =>
                        s.provider === provider.id &&
                        s.connectionType === "dhcp",
                    )
                    .length.toLocaleString()}
                </td>
                <td>{radiusAccessLabel[provider.connectionType]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        PPPoE uses a PPP session and RADIUS username. DHCP uses IPoE lease
        identity from the MAC address and circuit; it does not imply a PPP
        login.
      </p>
    </section>
  );
}
