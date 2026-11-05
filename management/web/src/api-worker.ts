import { webcrypto } from "node:crypto";
import {
  apply,
  DemoError,
  parseAction,
  seed,
  tick,
  pack,
  unpack,
  querySubscribers,
} from "./simulator";
Object.defineProperty(globalThis, "crypto", { value: webcrypto });
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 1000000) throw Error("Input limit exceeded");
}
try {
  const request = JSON.parse(raw);
  const now = Date.now();
  const source =
    request.operation === "seed"
      ? null
      : request.state?.schema === 2
        ? unpack(request.state)
        : seed(now);
  if (request.operation === "list") {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        page: querySubscribers(
          source!,
          String(request.query || ""),
          Number(request.offset) || 0,
          Number(request.limit) || 10,
          String(request.status || "all"),
          String(request.mode || "all"),
          String(request.provider || "all"),
          String(request.connectionType || "all"),
        ),
      }),
    );
  } else {
    const state =
      request.operation === "seed"
        ? seed(now)
        : request.operation === "tick"
          ? tick(source!, now)
          : request.operation === "apply"
            ? apply(
                source!,
                parseAction(request.action),
                request.expectedRevision,
                now,
              )
            : null;
    if (!state)
      throw new DemoError("VALIDATION", "Unsupported simulator operation.");
    process.stdout.write(JSON.stringify({ ok: true, state: pack(state) }));
  }
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
