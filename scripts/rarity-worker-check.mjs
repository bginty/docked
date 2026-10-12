import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const { token } = JSON.parse(
  readFileSync("private-data/nfl-worker/secrets.json"),
);
const { anon } = JSON.parse(readFileSync("private-data/nfl-worker/anon.json"));
const url =
  "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/nfl-postgame?task=reconcile";
const denied = await fetch(url, {
  method: "POST",
  headers: { Authorization: "Bearer " + anon },
});
assert.equal(denied.status, 403);
const r = await fetch(url, {
  method: "POST",
  headers: { Authorization: "Bearer " + anon, "x-docked-worker": token },
  signal: AbortSignal.timeout(145000),
});
const body = await r.json();
assert.equal(r.status, 200);
const report = {
  at: new Date().toISOString(),
  unauthorised: denied.status,
  status: r.status,
  body,
  scope:
    "Authenticated reconciliation only. No forced source download or claim of completed future round.",
};
writeFileSync(
  "docs/qa/rarity-round/worker.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
