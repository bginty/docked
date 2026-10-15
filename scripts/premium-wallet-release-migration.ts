// Owner-authorised existing admitted beta release. No member commands or grants.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
async function main() {
  const apply = process.argv[2] === "--apply";
  assert.ok(apply || process.argv[2] === "--inspect");
  const jerseyHotfix = process.argv[3] === "--jersey-hotfix";
  const files = jerseyHotfix ? ["20261015102845_jersey_projection_single_pass.sql"] : [
    "20261015055109_manual_credit_redemption.sql",
    "20261015080107_verified_jersey_presentation.sql",
  ];
  const sql = ownerDatabase();
  const hash = (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const out = jerseyHotfix ? "docs/qa/signin-recovery" : "docs/qa/private-beta-release",
    vault = jerseyHotfix ? "private-data/signin-recovery" : "private-data/private-beta-release";
  mkdirSync(out, { recursive: true });
  mkdirSync(vault, { recursive: true });
  try {
    const report = await sql.begin(async (tx) => {
      if (jerseyHotfix) await tx`set local lock_timeout='5s'`;
      await tx`select pg_advisory_xact_lock(71820342)`;
      await tx`lock table credits_sandbox.state in share row exclusive mode`;
      const tables = [
        "credits_sandbox.state",
        "credits_sandbox.journal",
        "credits_sandbox.lines",
        "credits_sandbox.history",
        "credits_sandbox.card_instances",
        "credits_sandbox.card_definitions",
        "beta_fantasy.cards",
        "beta_fantasy.entries",
        "beta_fantasy.entry_revisions",
        "beta_fantasy.slot_locks",
        "beta_fantasy.swaps",
      ];
      const snapshot: Record<string, unknown[]> = {};
      for (const table of tables)
        snapshot[table] = await tx.unsafe("select * from " + table);
      const before = hash(snapshot);
      const incompatible =
        await tx`select 1 from credits_sandbox.state where document->'redemption' is not null and document->'redemption'<>'null'::jsonb or exists(select 1 from jsonb_each(coalesce(document->'lots','{}')) x where x.value ? 'cashEligibility')`;
      assert.equal(
        incompatible.length,
        0,
        "Existing financial classification requires review",
      );
      const path = vault + "/before-" + before + ".json";
      try {
        writeFileSync(
          path,
          JSON.stringify({
            projectRef,
            at: new Date().toISOString(),
            snapshot,
          }),
          { flag: "wx", mode: 0o600 },
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
      assert.equal(
        hash(JSON.parse(readFileSync(path, "utf8")).snapshot),
        before,
      );
      const migrations = [];
      for (const file of files) {
        const source = readFileSync(
            "supabase/migrations/" + file,
            "utf8",
          ).replaceAll("\r\n", "\n"),
          version = file.slice(0, 14);
        const old =
          await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
        if (old.length)
          assert.equal(old[0].statements[0].replaceAll("\r\n", "\n"), source);
        else if (apply) {
          await tx.unsafe(source);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${file.slice(15, -4)},${[source]})`;
        }
        migrations.push({
          file,
          sha256: hash(source),
          alreadyApplied: !!old.length,
        });
      }
      for (const table of tables)
        assert.equal(
          hash(await tx.unsafe("select * from " + table)),
          hash(snapshot[table]),
          "Member data changed: " + table,
        );
      if (apply)
        for (const role of ["anon", "authenticated", "service_role"]) {
          assert.equal(
            (
              await tx`select has_table_privilege(${role},'credits_sandbox.redemption_staff','select') allowed`
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await tx`select has_table_privilege(${role},'credits_sandbox.current_player_jerseys','select') allowed`
            )[0].allowed,
            false,
          );
        }
      return {
        passed: true,
        applied: apply,
        projectRef,
        migrations,
        backup: {
          path,
          sha256: before,
          verifiedReadable: true,
          tables: tables.length,
          scope:
            "Affected ledger/inventory/team data; not full Auth/storage disaster recovery",
        },
        memberDataUnchanged: true,
        redemptionActivated: false,
      };
    });
    writeFileSync(
      out + "/migration-" + (apply ? "applied" : "inspection") + ".json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } catch (e) {
    console.error(
      JSON.stringify({
        passed: false,
        code: (e as { code?: string }).code ?? "ASSERTION",
        message:
          e instanceof assert.AssertionError
            ? e.message
            : "Migration failure; inspect securely",
      }),
    );
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
void main();
