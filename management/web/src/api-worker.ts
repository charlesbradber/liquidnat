import { webcrypto } from "node:crypto";
import { apply, DemoError, parseAction, seed, tick } from "./simulator";
Object.defineProperty(globalThis, "crypto", { value: webcrypto });
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 1000000) throw Error("Input limit exceeded");
}
try {
  const request = JSON.parse(raw);
  const now = Date.now();
  const state =
    request.operation === "seed"
      ? seed(now)
      : request.operation === "tick"
        ? tick(request.state, now)
        : request.operation === "apply"
          ? apply(
              request.state,
              parseAction(request.action),
              request.expectedRevision,
              now,
            )
          : null;
  if (!state)
    throw new DemoError("VALIDATION", "Unsupported simulator operation.");
  process.stdout.write(JSON.stringify({ ok: true, state }));
} catch (e) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: {
        code: e instanceof DemoError ? e.code : "VALIDATION",
        message: e instanceof Error ? e.message : "Invalid request",
      },
    }),
  );
}
