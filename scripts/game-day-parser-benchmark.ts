import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { parseStatisticsCsv } from "../src/core/postgame-nflverse";
const source = execFileSync(
  "git",
  ["show", "HEAD:src/core/postgame-nflverse.ts"],
  { encoding: "utf8" },
);
const fn = source.slice(
  source.indexOf("export function parseStatisticsCsv"),
  source.indexOf("\nfunction integer"),
);
mkdirSync("tmp", { recursive: true });
writeFileSync(
  "tmp/game-day-before-parser.cjs",
  transformSync(
    fn.replace("export function", "function") +
      "\nexports.parseStatisticsCsv = parseStatisticsCsv;",
    { loader: "ts", format: "cjs" },
  ).code,
);
const exports: Record<string, typeof parseStatisticsCsv> = createRequire(
  import.meta.url,
)("../tmp/game-day-before-parser.cjs");
const headers = Array.from({ length: 400 }, (_, i) => "field" + i);
const row = headers
  .map((_, i) => (i % 9 === 0 ? '"quoted, value"' : String(i)))
  .join(",");
const csv = headers.join(",") + "\n" + Array(18000).fill(row).join("\n");
const profile = {
  columns: headers.slice(0, 34),
  maxChars: 128_000_000,
  maxRows: 100000,
  maxColumns: 450,
};
const timings: Record<string, number> = {};
let previous: unknown;
for (const [label, parse] of [
  ["before", exports.parseStatisticsCsv],
  ["after", parseStatisticsCsv],
] as const) {
  const start = performance.now();
  const result = parse(csv, profile);
  timings[label] = Math.round(performance.now() - start);
  if (previous) assert.deepEqual(result, previous);
  else previous = result;
}
mkdirSync("docs/qa/game-day", { recursive: true });
const report = {
  scope:
    "Local synthetic 18,000-row, 400-column source. Equal projected records. Not a hosted Edge CPU measurement.",
  bytes: csv.length,
  timings,
};
writeFileSync(
  "docs/qa/game-day/parser-performance.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
