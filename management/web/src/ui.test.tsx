// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { App } from "./main";
import { seed, pack } from "./simulator";
beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});
describe("Manager interactions", () => {
  it("keeps the reference activity table bounded and resets pagination when filters change", () => {
    render(<App />);
    const activity = within(
      screen.getByRole("region", { name: "Subscriber activity" }),
    );
    expect(activity.getAllByRole("row")).toHaveLength(6);
    expect(activity.getByText("Alex Bennett")).toBeTruthy();
    fireEvent.click(
      activity.getByRole("button", { name: "Next activity page" }),
    );
    expect(activity.queryByText("Alex Bennett")).toBeNull();
    expect(activity.getByText(/Page 2 of/)).toBeTruthy();
    fireEvent.change(
      activity.getByRole("combobox", { name: "Filter subscriber activity" }),
      { target: { value: "attention" } },
    );
    expect(activity.getAllByRole("row")).toHaveLength(4);
    expect(activity.getByText("Jordan Avery")).toBeTruthy();
    expect(activity.getByText("Page 1 of 1")).toBeTruthy();
    fireEvent.change(
      activity.getByRole("combobox", { name: "Subscriber activity period" }),
      { target: { value: "hour" } },
    );
    expect(activity.getByText("No sessions match these filters")).toBeTruthy();
    expect(
      (
        activity.getByRole("button", {
          name: "Next activity page",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("links a dashboard incident to its diagnostic recovery and reflects the result on the overview", () => {
    render(<App />);
    const incidents = within(screen.getByRole("region", { name: /Incidents/ }));
    fireEvent.click(
      incidents.getByRole("button", { name: /Circuit VLAN mismatch/ }),
    );
    expect(screen.getByText("The handoff VLAN does not match")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Review VLAN correction/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(
      screen.getByRole("region", { name: "Incidents (2 open)" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Gateways (2)" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Open gateway-02 operations" }),
    );
    expect(screen.getByRole("heading", { name: "Operations" })).toBeTruthy();
  });
  it("uses the same redesigned overview when the PHP adapter supplies the workspace", async () => {
    const workspace = seed();
    window.history.replaceState({}, "", "/?backend=php");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrf: "test-csrf", workspace: pack(workspace) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("region", { name: "Gateways (2)" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/demo/api/v1/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(
      screen.getByRole("region", { name: "Subscriber activity" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
  it("reviews and creates a custom service profile", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Service profiles" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create service profile" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Profile name" }), {
      target: { value: "Fibre 2500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Review profile/ }));
    expect(
      screen.getByText("Unchanged; assign the new profile separately"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect(screen.getByRole("heading", { name: "Fibre 2500" })).toBeTruthy();
    expect(screen.getAllByText("0 assigned subscribers")).toHaveLength(1);
  });
  it("finds a subscriber using the top search and switches CGNAT to a static IPv4", () => {
    render(<App />);
    const search = screen.getByRole("combobox", {
      name: "Search all subscribers",
    });
    fireEvent.change(search, {
      target: { value: "subscriber001@liquidnet.net" },
    });
    expect(
      within(
        screen.getByRole("listbox", { name: "Subscriber search results" }),
      ).getAllByRole("option"),
    ).toHaveLength(1);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Change IPv4 mode" }));
    fireEvent.click(screen.getByRole("radio", { name: /Static IPv4/ }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Static IPv4 address" }),
      { target: { value: "192.0.2.50" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Review addressing change/ }),
    );
    expect(screen.getByText("CGNAT → Static IPv4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    fireEvent.change(search, { target: { value: "192.0.2.50" } });
    fireEvent.click(
      within(
        screen.getByRole("listbox", { name: "Subscriber search results" }),
      ).getByRole("option"),
    );
    expect(screen.getByText("Static IPv4 · NAT bypass")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "View NAT mappings" }),
    ).toBeNull();
  });
  it("bounds top-search suggestions and lists even with 12k subscribers", () => {
    render(<App />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Search all subscribers" }),
      { target: { value: "subscriber" } },
    );
    expect(
      within(
        screen.getByRole("listbox", { name: "Subscriber search results" }),
      ).getAllByRole("option"),
    ).toHaveLength(6);
    fireEvent.click(
      screen.getByRole("button", { name: /View all 12,864 matches/ }),
    );
    expect(screen.getByText(/of 12864 subscribers/)).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter IPv4 mode" }),
      { target: { value: "static" } },
    );
    expect(screen.getByText(/of 1286 subscribers/)).toBeTruthy();
  });
  it("creates a subscriber only after a change preview, then filters and suspends it", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Network overview" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add subscriber" }));
    fireEvent.change(screen.getByLabelText("Subscriber name"), {
      target: { value: "Demo Person" },
    });
    fireEvent.change(screen.getByLabelText("RADIUS username"), {
      target: { value: "demo.person" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Review subscriber/ }));
    expect(
      screen.getByRole("heading", { name: "Review new subscriber" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    fireEvent.click(screen.getByRole("button", { name: /Subscribers/ }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search subscribers" }),
      { target: { value: "demo.person" } },
    );
    expect(screen.getByText("Demo Person")).toBeTruthy();
    expect(screen.getByText(/of 1 subscribers/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Demo Person" }));
    fireEvent.click(screen.getByRole("button", { name: "Suspend service" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect(
      screen.getByText("Suspended", { selector: "span.badge" }),
    ).toBeTruthy();
  });
  it("recovers a seeded RADIUS rejection using diagnostics", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Diagnostics/ }));
    expect(screen.getByText("Credentials were rejected")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Review credential reset/ }),
    );
    expect(screen.getByText("None collected or changed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect(screen.getByText("The subscriber session is healthy")).toBeTruthy();
  });
  it("opens the tour, navigates a scenario, and resets only the current workspace", () => {
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Quick actions" })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button").length).toBe(10);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Resolve pool exhaustion/ }),
    );
    expect(screen.getByRole("heading", { name: "CGNAT" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Review capacity increase" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect(screen.getByRole("button", { name: "Pool expanded" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset workspace" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset workspace",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Network overview" }),
    ).toBeTruthy();
    expect(screen.getByText("3 services need attention")).toBeTruthy();
  });
  it("shows session storage status and has working network tabs", () => {
    render(<App />);
    expect(
      screen.getByText("Changes are saved for this browser session."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Network" }));
    fireEvent.click(screen.getByRole("button", { name: "Routes" }));
    expect(
      screen.getByRole("heading", { name: "Forwarding table" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Addressing" }));
    expect(screen.getByText("2001:db8::/32")).toBeTruthy();
  });
});

it("adds a provider, builds its catalogue, and creates and transfers subscribers", () => {
  const view = render(<App />);
  const nav = (name: string) =>
    fireEvent.click(
      screen.getAllByRole("button", {
        name: new RegExp("^" + name + "(?:\\s|$)"),
      })[0],
    );
  const apply = () =>
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
  nav("Network providers");
  fireEvent.change(screen.getByLabelText("Provider name"), {
    target: { value: "City Fibre" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review new provider" }));
  apply();
  expect(screen.getByRole("button", { name: "Edit City Fibre" })).toBeTruthy();
  nav("Service profiles");
  fireEvent.change(screen.getByLabelText("Catalogue profile name"), {
    target: { value: "City 200" },
  });
  const providerSelect = screen.getByLabelText(
    "Profile network provider",
  ) as HTMLSelectElement;
  const providerId = Array.from(providerSelect.options).find(
    (o) => o.text === "City Fibre",
  )!.value;
  fireEvent.change(providerSelect, { target: { value: providerId } });
  fireEvent.click(
    screen.getByRole("button", { name: "Review service profile" }),
  );
  apply();
  nav("Subscribers");
  fireEvent.click(screen.getByRole("button", { name: "Add subscriber" }));
  fireEvent.change(screen.getByLabelText("Subscriber name"), {
    target: { value: "Alex Morgan" },
  });
  fireEvent.change(screen.getByLabelText("RADIUS username"), {
    target: { value: "city.alex" },
  });
  fireEvent.change(screen.getByLabelText("Network provider"), {
    target: { value: providerId },
  });
  expect(
    within(screen.getByLabelText("Service profile")).getAllByRole("option"),
  ).toHaveLength(1);
  expect(
    within(screen.getByLabelText("Service profile")).getByRole("option")
      .textContent,
  ).toContain("City 200");
  fireEvent.click(screen.getByRole("button", { name: /Review subscriber/ }));
  apply();
  fireEvent.change(screen.getByLabelText("Filter network provider"), {
    target: { value: providerId },
  });
  expect(screen.getByText(/of 1 subscribers/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View Alex Morgan" }));
  fireEvent.click(screen.getByRole("button", { name: "Change profile" }));
  fireEvent.change(screen.getByLabelText("Network provider"), {
    target: { value: "examplenet" },
  });
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: /Review change/ }));
  apply();
  expect(screen.getByText("No subscribers found")).toBeTruthy();
  view.unmount();
  render(<App />);
  nav("Network providers");
  expect(screen.getByRole("button", { name: "Edit City Fibre" })).toBeTruthy();
});

it("edits an interface, refreshes the session and withdraws its connected route", () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Network" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit mgmt0" }));
  fireEvent.change(screen.getByLabelText("IPv4 address / prefix"), {
    target: { value: "10.77.0.1/24" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(screen.getByText("10.77.0.1/24")).toBeTruthy();
  view.unmount();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Network" }));
  expect(screen.getByText("10.77.0.1/24")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Disable mgmt0" }));
  fireEvent.click(screen.getByRole("button", { name: "Routes" }));
  const row = screen.getByText("10.77.0.0/24").closest("tr")!;
  expect(within(row).getByText("Withdrawn")).toBeTruthy();
});
