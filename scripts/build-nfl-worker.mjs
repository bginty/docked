import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
await build({
  entryPoints: ["src/server/nfl-collection-worker.ts"],
  outfile: "supabase/functions/nfl-postgame/worker.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  external: ["postgres"],
  minify: true,
});
writeFileSync(
  "supabase/functions/nfl-postgame/ca.ts",
  "export const ca=" +
    JSON.stringify(readFileSync("certs/supabase-prod-ca-2021.crt", "utf8")) +
    ";\n",
);
console.log("Worker bundled; only public CA, no credentials");
