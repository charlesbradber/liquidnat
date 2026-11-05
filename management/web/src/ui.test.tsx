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
    expect(screen.getByText("2001:db8:100::/48")).toBeTruthy();
  });
});
