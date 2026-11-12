/** Isolated retained restore only. No TCP connection or Production credentials. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { digest } from "../src/core/scoring-engine";
import {
  reviewedInventorySql,
  custodyQuery,
  tableListQuery,
  checksumQuery,
} from "./lib/reviewed-inventory";

const target = "docked-commercial-restore-20261112d";
const migration =
  "supabase/migrations/20261113002000_preserved_commercial_collection_read.sql";
let stage = "isolation";
async function run(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.stdin.on("error", () => {});
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve(out) : reject(new Error(err)),
    );
    p.stdin.end(input);
  });
}
async function sql(query: string, role = "postgres") {
  assert(["postgres", "bootstrap_admin"].includes(role));
  const result = await run(
    [
      "exec",
      "-i",
      target,
      "psql",
      "-X",
      "-q",
      "-h",
      "/restore",
      "-U",
      role,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    query,
  );
  return result
    .split("\n")
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
async function capture() {
  const [tables] = await sql(tableListQuery);
  const values = await sql(
    `begin isolation level repeatable read read only;${tables.map(checksumQuery).join(";\n")};${custodyQuery};commit;`,
  );
  return {
    tables: Object.fromEntries(
      values
        .slice(0, tables.length)
        .map((v) => [v.table, { count: v.count, hash: v.hash }]),
    ),
    custody: values[tables.length],
  };
}
async function main() {
  assert.equal(process.argv[2], "--isolated-restored");
  const [container] = JSON.parse(await run(["inspect", target]));
  assert.equal(container.HostConfig.NetworkMode, "none");
  assert.equal(container.State.Running, true);
  assert(
    Object.values(container.NetworkSettings.Ports ?? {}).every(
      (p) => !p || (Array.isArray(p) && p.length === 0),
    ),
  );
  stage = "local inventory baseline";
  const plan = JSON.parse(
    readFileSync(
      "private-data/v31-card-research-20261111/complete-proposal.private.json",
      "utf8",
    ),
  );
  const [beforeInventory] = await sql(
    "select jsonb_build_object('definitions',(select count(*) from commercial_billing.definitions),'cards',(select count(*) from commercial_billing.cards))",
  );
  const resumed = process.argv.includes("--resume-isolated");
  assert.equal(beforeInventory.definitions, resumed ? 6540 : 0);
  assert.equal(beforeInventory.cards, 0);
  // The snapshot predates the completed import. Reconstruct its exact committed
  // baseline once in this disconnected restore; no Production import is repeated.
  if (resumed)
    await sql(
      `begin;${readFileSync("docs/qa/v31-revenue-launch-20261113/collection-rollback.sql", "utf8")}commit;`,
    );
  else await sql(`begin;${reviewedInventorySql(plan)}commit;`);
  const before = await capture();
  assert.equal(digest(before.custody), plan.protectedCustodyDigest);
  const [original] = await sql(
    "select jsonb_build_object('definition',pg_get_functiondef('commercial_billing.member_record(text)'::regprocedure),'acl',(select proacl from pg_proc where oid='commercial_billing.member_record(text)'::regprocedure))",
  );
  const rollback =
    original.definition +
    ";\nrevoke all on function commercial_billing.member_record(text) from public,anon,authenticated,service_role,docked_beta_app,docked_commercial_app;\ngrant execute on function commercial_billing.member_record(text) to docked_app;\ndrop function commercial_billing.preserved_collection_rows(uuid,text);\n";
  if (resumed)
    assert.equal(
      readFileSync(
        "docs/qa/v31-revenue-launch-20261113/collection-rollback.sql",
        "utf8",
      ),
      rollback,
    );
  else
    writeFileSync(
      "docs/qa/v31-revenue-launch-20261113/collection-rollback.sql",
      rollback,
      { flag: "wx" },
    );
  stage = "new read-only migration";
  const bytes = readFileSync(migration, "utf8");
  const start = performance.now();
  await sql(
    `begin;set local lock_timeout='3s';set local statement_timeout='60s';${bytes}commit;`,
  );
  const migrationMs = Math.round(performance.now() - start);
  await sql(`begin;${bytes}commit;`);
  stage = "historical owner parity";
  const oldSource = readFileSync(
    "supabase/migrations/20261023022240_owned_collection_read.sql",
    "utf8",
  ).replaceAll("\r\n", "\n");
  const ctes = oldSource
    .slice(
      oldSource.indexOf(" with ledger as materialized"),
      oldSource.indexOf(",\n summary as ("),
    )
    .trim();
  assert(
    ctes.endsWith(
      "owned as materialized(select * from beta_rows union all select * from legacy_rows)",
    ),
  );
  const [owners] = await sql(
    "with owners as(select c.value->>'owner' id from credits_sandbox.state s,jsonb_each(s.document#>'{commerce,cards}')c where s.id union select owner_id::text from beta_fantasy.cards) select coalesce(jsonb_agg(id order by id),'[]') from owners where id ~ '^[a-f0-9-]{36}$'",
  );
  let visible = 0;
  const perSport: Record<string, number> = { nfl: 0, afl: 0, nrl: 0 };
  const timings: number[] = [];
  for (const owner of owners) {
    assert.match(owner, /^[a-f0-9-]{36}$/);
    for (const sport of Object.keys(perSport)) {
      // Extract the deployed historical query verbatim; only bind its local
      // variables. Compare IDs/rarity/serial without exporting owner data.
      const prior = ctes
        .replace(/\bu\b/g, `'${owner}'::uuid`)
        .replace(/\bsport_id\b/g, `'${sport}'`);
      const [expected] = await sql(
        `${prior} select coalesce(jsonb_agg(jsonb_build_object('id',id,'rarity',tier,'serial',serial) order by id),'[]') from owned;`,
      );
      const t = performance.now();
      const [actual] = await sql(
        `set role docked_commercial_app;select coalesce(jsonb_agg(jsonb_build_object('id',id,'rarity',rarity,'serial',serial) order by id),'[]') from commercial_billing.preserved_collection_rows('${owner}','${sport}');reset role;`,
        "bootstrap_admin",
      );
      timings.push(Math.round(performance.now() - t));
      assert.equal(
        digest(actual),
        digest(expected),
        "Existing opened collection changed",
      );
      assert.equal(new Set(actual.map((r: any) => r.id)).size, actual.length);
      visible += actual.length;
      perSport[sport] += actual.length;
    }
  }
  const [permissions] = await sql(
    `select jsonb_build_object('denied',not exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app'])r where has_function_privilege(r,'commercial_billing.preserved_collection_rows(uuid,text)','execute')),'serverAllowed',has_function_privilege('docked_commercial_app','commercial_billing.preserved_collection_rows(uuid,text)','execute'),'nbaRows',(select count(*) from commercial_billing.preserved_collection_rows('${owners[0]}','basketball')),'nullOwnerRows',(select count(*) from commercial_billing.preserved_collection_rows(null,'nfl')))`,
  );
  assert.equal(permissions.denied, true);
  assert.equal(permissions.serverAllowed, true);
  assert.equal(permissions.nbaRows, 0);
  assert.equal(permissions.nullOwnerRows, 0);
  const after = await capture();
  assert.deepEqual(after, before, "Read migration mutated protected data");
  stage = "rollback and forward recovery";
  await sql(`begin;${rollback}commit;`);
  const [recovered] = await sql(
    "select jsonb_build_object('definition',pg_get_functiondef('commercial_billing.member_record(text)'::regprocedure),'acl',(select proacl from pg_proc where oid='commercial_billing.member_record(text)'::regprocedure))",
  );
  assert.deepEqual(recovered, original);
  await sql(`begin;${bytes}commit;`);
  assert.deepEqual(await capture(), before);
  const report = {
    at: new Date().toISOString(),
    environment: "network-isolated-restored-production",
    target,
    productionWrites: 0,
    originalSnapshotPredatesImport: true,
    localBaselineDefinitions: 6540,
    lifetimeConsumed: 888,
    custodyRecords: before.custody.length,
    custodyDigest: digest(before.custody),
    migration,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    migrationMs,
    protectedTablesUnchanged: Object.keys(before.tables).length,
    ownersChecked: owners.length,
    visibleOpenedCards: visible,
    visibleBySport: perSport,
    retiredAndSealedCustodyPreserved: true,
    priorHistoricalProjectionMatches: true,
    permissions,
    rollbackAndForwardRecoveryPassed: true,
    reapplicationPassed: true,
    localDockerQueryMaximumMs: Math.max(...timings),
    timingIncludesDockerStartup: true,
    hostedAcceptance: false,
  };
  writeFileSync(
    "docs/qa/v31-revenue-launch-20261113/collection-restored.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify(report));
}
main().catch((error) => {
  writeFileSync(
    "private-data/v31-revenue-launch-20261113/collection-restore-error.private.txt",
    String(error),
  );
  console.error(
    `Isolated collection rehearsal failed at ${stage}; private diagnostic retained. No Production connection.`,
  );
  process.exitCode = 1;
});
