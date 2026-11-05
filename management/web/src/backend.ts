import { Action, Workspace, unpack } from "./simulator";
/** Same-origin simulator adapter. No configurable destinations or production controls. */
export class HttpDemoBackend {
  private csrf = "";
  async session(): Promise<Workspace> {
    const response = await fetch("/demo/api/v1/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw Error(body.error?.message || "Demo API unavailable.");
    this.csrf = body.csrf;
    return unpack(body.workspace);
  }
  async mutate(state: Workspace, action: Action | "reset"): Promise<Workspace> {
    const response = await fetch(
      `/demo/api/v1/${action === "reset" ? "reset" : "actions"}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-CSRF": this.csrf,
          "If-Match": String(state.revision),
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(action === "reset" ? {} : action),
      },
    );
    const body = await response.json();
    if (!response.ok)
      throw Error(body.error?.message || "Demo change rejected.");
    return unpack(body.workspace);
  }
}
