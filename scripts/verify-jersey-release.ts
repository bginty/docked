// Release evidence only: public catalogue, collector health and authentication.
// Does not execute member, wallet, pack or competition commands.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase, ownerRuntimeDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { nflResource } from "../src/server/nflverse-bundle";

async function main() {
  const root = "docs/qa/jersey-refinement/release";
  const mode = process.argv[2];
  assert.ok(mode === "inspect" || mode === "refresh");
  const sql = ownerDatabase();
  let source: any;
  try {
    source = await sql.begin("read only", async tx => {
      await tx`set local statement_timeout='5s'`;
      const [row] = await tx`select c.resource,c.next_attempt,c.checked_at,c.error_code,r.id raw_id,r.body->>'projectionVersion' projection_version from sports_feed.postgame_cache c left join sports_feed.raw_revisions r on r.id=c.raw_id where c.resource=${nflResource("rosters",2026)}`;
      const jobs = await tx`select jobname,schedule,active from cron.job where jobname='docked-nfl-rosters'`;
      return { row, jobs };
    });
  } finally { await sql.end(); }
  assert.ok(source.row, "Expected roster cache resource");
  assert.equal(source.jobs.length, 1);
  assert.equal(source.jobs[0].active, true);
  const { token } = JSON.parse(readFileSync("private-data/nfl-worker/secrets.json", "utf8"));
  const { anon } = JSON.parse(readFileSync("private-data/nfl-worker/anon.json", "utf8"));
  const endpoint = `https://${projectRef}.supabase.co/functions/v1/nfl-postgame`;
  const missing = await fetch(endpoint + "?task=rosters", { method: "POST" });
  assert.equal(missing.status, 401);
  const denied = await fetch(endpoint + "?task=rosters", { method: "POST", headers: { Authorization: "Bearer " + anon } });
  assert.equal(denied.status, 403);
  // Validates the dedicated token without starting collection or reconciliation.
  const authorized = await fetch(endpoint + "?task=invalid", { method: "POST", headers: { Authorization: "Bearer " + anon, "x-docked-worker": token } });
  assert.equal(authorized.status, 400);
  let refresh: unknown = "Not requested; existing scheduled collection retained";
  if (mode === "refresh") {
    if (Date.now() >= Date.parse(source.row.next_attempt)) {
      const r = await fetch(endpoint + "?task=rosters", { method: "POST", headers: { Authorization: "Bearer " + anon, "x-docked-worker": token }, signal: AbortSignal.timeout(145000) });
      assert.equal(r.status, 200);
      refresh = await r.json();
    } else refresh = "Cooldown preserved; next scheduled roster collection will fetch projection v2";
  }
  const runtime = ownerRuntimeDatabase();
  let catalogue: unknown;
  try {
    catalogue = await runtime.begin("read only", async tx => {
      await tx`set local statement_timeout='5s'`;
      const start = Date.now();
      const rows = await tx`select c.name,c.team,j.verified_jersey_number from credits_sandbox.current_player_status c left join credits_sandbox.current_player_jerseys j on j.id=c.id`;
      const names = new Set(["Aaron Rodgers", "Michael Burton", "Ameer Abdullah", "Davante Adams", "Brandin Cooks"]);
      return { rows: rows.length, withNumbers: rows.filter(r => r.verified_jersey_number !== null).length, queryMs: Date.now() - start, examples: rows.filter(r => names.has(r.name)) };
    });
  } finally { await runtime.end(); }
  const raw = JSON.parse(readFileSync(root + "/secret-scan-raw.json", "utf8"));
  const prior = JSON.parse(readFileSync("docs/qa/private-beta-release/secret-review.json", "utf8"));
  assert.deepEqual(raw.findings.map((x: any) => x.file).sort(), [...prior.reviewed.map((x: any) => x.file), prior.capability.file].sort());
  for (const item of prior.reviewed) assert.equal(createHash("sha256").update(readFileSync(item.file)).digest("hex"), item.sha256, "Reviewed fixture changed: " + item.file);
  const report = { at: new Date().toISOString(), projectRef, source, authentication: { missingJwt: 401, missingWorkerToken: 403, authorizedInvalidTask: 400 }, refresh, catalogue, secrets: { rawStatus: raw.status, existingFindings: raw.findings.length, newFindingPaths: [], reviewedFixtureHashesUnchanged: true, capability: "Remains untracked and excluded from committed web-only export; not used. Prior documented remote validity remains unverified." }, memberCommands: 0, schemaChanges: 0 };
  writeFileSync(root + "/collector-" + mode + ".json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
void main();
