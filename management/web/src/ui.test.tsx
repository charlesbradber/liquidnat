// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { App } from "./main";
beforeEach(() => {
  sessionStorage.clear();
});
afterEach(cleanup);
describe("Manager interactions", () => {
  it("finds a subscriber using the top search and switches CGNAT to a static IPv4", () => {
    render(<App />);
    const search = screen.getByRole("combobox", {
      name: "Search all subscribers",
    });
    fireEvent.change(search, {
      target: { value: "subscriber001@example.net" },
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
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
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
    fireEvent.change(screen.getByLabelText("Demo username"), {
      target: { value: "demo.person" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Review subscriber/ }));
    expect(
      screen.getByRole("heading", { name: "Review new subscriber" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
    fireEvent.click(screen.getByRole("button", { name: /Subscribers/ }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search subscribers" }),
      { target: { value: "demo.person" } },
    );
    expect(screen.getByText("Demo Person")).toBeTruthy();
    expect(screen.getByText(/of 1 subscribers/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Demo Person" }));
    fireEvent.click(screen.getByRole("button", { name: "Suspend service" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
    expect(screen.getByText("The demo session is healthy")).toBeTruthy();
  });
  it("opens the tour, navigates a scenario, and resets only the current workspace", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Explore demo" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button").length).toBe(10);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Resolve pool exhaustion/ }),
    );
    expect(screen.getByRole("heading", { name: "CGNAT" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Review capacity increase" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
    expect(screen.getByRole("button", { name: "Pool expanded" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset workspace" }));
    expect(
      screen.getByRole("heading", { name: "Network overview" }),
    ).toBeTruthy();
    expect(screen.getByText("0 of 9 scenarios completed")).toBeTruthy();
  });
  it("keeps simulation labelling visible and has working network tabs", () => {
    render(<App />);
    expect(
      screen.getByText(
        "This is your playground. All network data and actions are simulated.",
      ),
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
      screen.getAllByRole("button", { name: new RegExp("^" + name) })[0],
    );
  const apply = () =>
    fireEvent.click(screen.getByRole("button", { name: "Apply demo change" }));
  nav("Network providers");
  fireEvent.change(screen.getByLabelText("Provider name"), {
    target: { value: "City Fibre" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review new provider" }));
  apply();
  expect(screen.getByRole("button", { name: "Edit City Fibre" })).toBeTruthy();
  nav("Subscribers");
  fireEvent.click(screen.getByRole("button", { name: "Add subscriber" }));
  const emptyProviderSelect = screen.getByLabelText(
    "Network provider",
  ) as HTMLSelectElement;
  const emptyProviderId = Array.from(emptyProviderSelect.options).find(
    (o) => o.text === "City Fibre",
  )!.value;
  fireEvent.change(emptyProviderSelect, { target: { value: emptyProviderId } });
  expect(
    (
      screen.getByRole("button", {
        name: /Review subscriber/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    screen.getByRole("option", { name: /No service profiles/ }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  nav("Service profiles");
  fireEvent.change(screen.getByLabelText("Profile name"), {
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
  fireEvent.change(screen.getByLabelText("Demo username"), {
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
