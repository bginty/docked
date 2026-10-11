// Bounded operational repair, exact existing isolated Docked role only.
// No credentials, grants, schema, account or holding changes; no service upgrade.
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
assert.equal(process.argv[2], "--apply-reviewed-16");
const db = ownerDatabase();
try {
  const [before] =
    await db`select rolconnlimit,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname='docked_beta_app'`;
  assert.equal(
    before.rolconnlimit,
    8,
    "Reconcile an already changed budget; do not repeat",
  );
  assert.equal(before.rolsuper, false);
  assert.equal(before.rolbypassrls, false);
  const [{ max_connections: max }] = await db`show max_connections`;
  assert.ok(Number(max) >= 60);
  const [{ others }] =
    await db`select count(*)::int others from pg_stat_activity where usename is distinct from 'docked_beta_app'`;
  assert.ok(
    Number(max) - 16 - others >= 20,
    "Preserve at least twenty currently unused slots beyond the full beta budget",
  );
  await db.begin(async (tx) => {
    await tx`alter role docked_beta_app connection limit 16`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values('owner-authorised-operator','beta_connection_budget_repair','docked_beta_app','{"reason":"Observed SQLSTATE53300 during admitted-member refresh; eight idle beta pool connections exhaust former cap. Bounded sixteen within existing sixty-slot capacity; no grants or service tier changed.","previous":8,"resulting":16,"rollback":"ALTER ROLE docked_beta_app CONNECTION LIMIT 8"}'::jsonb)`;
  });
  const [after] =
    await db`select rolconnlimit,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname='docked_beta_app'`;
  assert.deepEqual(after, { ...before, rolconnlimit: 16 });
  mkdirSync("docs/qa/android-v19", { recursive: true });
  const report = {
    at: new Date().toISOString(),
    before,
    after,
    maxConnections: Number(max),
    otherConnections: others,
    additionalCost: 0,
    noGrantsChanged: true,
    noSessionsTerminated: true,
    scope: "Docked isolated beta role; connection resource budget only",
    rollback:
      "ALTER ROLE docked_beta_app CONNECTION LIMIT 8; investigate saturation before rollback",
  };
  writeFileSync(
    "docs/qa/android-v19/connection-budget.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await db.end();
}
