import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
async function main() {
  const name = "20261013064456_nfl_seven_slot_modes.sql";
  const source = readFileSync("supabase/migrations/" + name, "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const sql = ownerDatabase();
  mkdirSync("docs/qa/seven-round", { recursive: true });
  try {
    assert.equal(projectRef, "pojoymtniryarxxunyvz");
    assert.equal(
      JSON.parse(readFileSync("docs/qa/seven-round/hosted-replay.json", "utf8"))
        .passed,
      true,
      "Rollback acceptance required",
    );
    const before = (
      await sql`select md5(document::text) hash from credits_sandbox.state where id`
    )[0].hash;
    await sql.begin(async (tx) => {
      const existing =
        await tx`select statements from supabase_migrations.schema_migrations where version=${name.slice(0, 14)}`;
      if (existing.length)
        assert.equal(
          digest(existing[0].statements[0].replaceAll("\r\n", "\n")),
          digest(source),
        );
      else {
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${name.slice(0, 14)},'nfl_seven_slot_modes',${[source]})`;
        await tx`insert into beta_private.audit_events(actor,action,subject,details) values('release-operator','seven_slot_modes_migration',${name},'{"additive":true,"grants":false,"realMoney":false}'::jsonb)`;
      }
    });
    assert.equal(
      (
        await sql`select md5(document::text) hash from credits_sandbox.state where id`
      )[0].hash,
      before,
    );
    const report = {
      at: new Date().toISOString(),
      projectRef,
      migration: name,
      walletUnchanged: true,
      passed: true,
    };
    writeFileSync(
      "docs/qa/seven-round/migration.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await sql.end();
  }
}
void main();
