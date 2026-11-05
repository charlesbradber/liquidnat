import { build } from "esbuild";
await build({
  entryPoints: ["src/api-worker.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "../api/var/simulator-worker.mjs",
});
console.log(
  "Built shared simulator worker for the PHP demo API (not a packet-engine adapter).",
);
