// Preserve a compact, reproducible acceptance report without Playwright trace internals.
import { readFile, writeFile } from "node:fs/promises";
const report = JSON.parse(await readFile("test-results/browser-results.json", "utf8"));
const cases = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
    const result = test.results.at(-1);
    cases.push({ file: spec.file, title: spec.title, expectedStatus: test.expectedStatus, status: result?.status, durationMs: result?.duration, attempts: test.results.length });
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
const summary = {
  recordedAt: new Date().toISOString(),
  buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
  scope: "Real anonymous local-preview routes and clearly labelled isolated DEMO client interaction fixtures. No real authenticated Supabase session, provider data or external delivery was simulated on application routes.",
  stats: report.stats,
  cases,
};
const filename = process.argv[2] ?? "browser-results.json";
if (!/^[a-z0-9-]+\.json$/.test(filename)) throw new Error("Use a simple JSON report filename");
await writeFile(`docs/qa/phase3/after/${filename}`, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ stats: summary.stats, cases: cases.length, buildId: summary.buildId }));
