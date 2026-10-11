// Additive read only. No changes to accounts, allocations, gates or scheduled jobs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
assert.equal(process.argv[2], "--apply");
const name = "20261011060614_pack_opening_receipt.sql";
const source = readFileSync("supabase/migrations/" + name, "utf8").replaceAll(
  "\r\n",
  "\n",
);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const db = ownerDatabase();
try {
  await db.begin(async (tx) => {
    const version = name.slice(0, 14);
    const existing =
      await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
    if (existing.length)
      assert.equal(
        hash(existing[0].statements[0].replaceAll("\r\n", "\n")),
        hash(source),
      );
    else {
      await tx.unsafe(source);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},'pack_opening_receipt',${[source]})`;
    }
    for (const role of ["anon", "authenticated", "docked_app"])
      assert.equal(
        (
          await tx`select has_function_privilege(${role},'beta_fantasy.my_nfl_pack_receipt()','execute') allowed`
        )[0].allowed,
        false,
      );
    assert.equal(
      (
        await tx`select has_function_privilege('docked_beta_app','beta_fantasy.my_nfl_pack_receipt()','execute') allowed`
      )[0].allowed,
      true,
    );
  });
  // Real runtime role + anonymous session must fail; no fake authenticated claims.
  await assert.rejects(() =>
    db.begin(async (tx) => {
      await tx`set local role docked_beta_app`;
      await tx`select beta_fantasy.my_nfl_pack_receipt()`;
    }),
  );
  const report = {
    at: new Date().toISOString(),
    projectRef,
    migration: name,
    sha256: hash(source),
    anonymousDenied: true,
    directMemberApiDenied: true,
    runtimeOnly: true,
    allocationLogicChanged: false,
  };
  mkdirSync("docs/qa/pack-opening", { recursive: true });
  writeFileSync(
    "docs/qa/pack-opening/hosted-receipt.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await db.end();
}
