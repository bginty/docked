// Exact existing admitted beta. Additive migrations only; never member commands.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const apply = process.argv[2] === "--apply";
assert.ok(apply || process.argv[2] === "--inspect");
const out = "docs/qa/social-live-release",
  vault = "private-data/social-live-release";
mkdirSync(out, { recursive: true });
mkdirSync(vault, { recursive: true });
const files = [
  "20261015131955_premium_social_collections.sql",
  "20261015140207_premium_social_runtime_guards.sql",
];
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function main() {
  const db = ownerDatabase();
  try {
    const report = await db.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='30s'`;
      if (!apply) await tx`set transaction read only`;
      const applied =
        await tx`select version from supabase_migrations.schema_migrations order by version`;
      const missing = readdirSync("supabase/migrations").filter(
        (f) =>
          f.endsWith(".sql") &&
          !applied.some((r) => r.version === f.slice(0, 14)),
      );
      // Older isolated simulation/feed files are not part of this release. The
      // live feed was separately provisioned; do not replay CREATE SCHEMA/jobs.
      const historical = [
        "20261010092154_scoring_v1_isolated_journal.sql",
        "20261010231416_nfl_postgame_isolated_feed.sql",
        "20261010233559_nfl_beta_raw_retention.sql",
      ];
      assert.ok(
        missing.every((f) => files.includes(f) || historical.includes(f)),
        "Unexpected schema gap: " + missing.join(", "),
      );
      assert.ok(
        (
          await tx`select to_regclass('sports_feed.nfl_players') is not null and to_regclass('credits_sandbox.current_player_jerseys') is not null dependencies`
        )[0].dependencies,
      );
      const members =
        await tx`select case when lower(u.email)='support@docked.com.au' then 'Owner' when lower(u.email)='lbickley89@gmail.com' then 'Luke' else 'Other admitted tester' end member, u.email_confirmed_at is not null confirmed, a.status, beta_private.gameplay_mfa_required(u.id) mfa_required, exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') mfa_enrolled from auth.users u join beta_private.admissions a on a.user_id=u.id where a.status='accepted' order by member`;
      assert.ok(
        members.some(
          (m) =>
            m.member === "Owner" &&
            m.confirmed &&
            m.mfa_required &&
            m.mfa_enrolled,
        ),
      );
      assert.ok(
        members.some(
          (m) => m.member === "Luke" && m.confirmed && !m.mfa_required,
        ),
      );
      assert.ok(
        members
          .filter((m) => m.member !== "Owner")
          .every((m) => m.confirmed && !m.mfa_required),
      );
      const admission =
        await tx`select enabled,testers_enabled from beta_private.admission_control where id`;
      assert.ok(admission[0].enabled && admission[0].testers_enabled);
      const tables =
        await tx`select schemaname,tablename from pg_tables where schemaname in ('public','private','fantasy','beta_public','beta_private','beta_fantasy','credits_sandbox') order by 1,2`;
      if (apply) {
        await tx`select pg_advisory_xact_lock(71820342)`;
        // Bounded locks provide a consistent backup and conservation comparison.
        for (const t of tables)
          await tx.unsafe(
            `lock table "${t.schemaname}"."${t.tablename}" in share mode`,
          );
      }
      const snapshot: Record<string, unknown[]> = {};
      for (const t of tables) {
        const key = t.schemaname + "." + t.tablename;
        snapshot[key] = await tx.unsafe(
          `select * from "${t.schemaname}"."${t.tablename}" order by to_jsonb("${t.tablename}")::text`,
        );
      }
      const digest = hash(snapshot),
        backupPath = vault + "/before-" + digest + ".json";
      if (apply) {
        writeFileSync(backupPath, JSON.stringify({ projectRef, snapshot }), {
          mode: 0o600,
        });
        assert.equal(
          hash(JSON.parse(readFileSync(backupPath, "utf8")).snapshot),
          digest,
        );
      }
      const migrations = [];
      const rehearsal = JSON.parse(
        readFileSync(
          "docs/qa/private-preview-release/migration-rehearsal.json",
          "utf8",
        ),
      );
      assert.equal(rehearsal.passed, true);
      for (const file of files) {
        const bytes = readFileSync("supabase/migrations/" + file),
          source = bytes.toString().replaceAll("\r\n", "\n");
        assert.equal(
          rehearsal.migrations.find((m: { file: string }) => m.file === file)
            ?.sha256,
          createHash("sha256").update(bytes).digest("hex"),
        );
        const version = file.slice(0, 14),
          old =
            await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
        if (old.length)
          assert.equal(old[0].statements[0].replaceAll("\r\n", "\n"), source);
        else if (apply) {
          await tx.unsafe(source);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${file.slice(15, -4)},${[source]})`;
        }
        migrations.push({
          file,
          alreadyApplied: !!old.length,
          sha256: createHash("sha256").update(source).digest("hex"),
        });
      }
      if (apply)
        for (const t of tables) {
          const key = t.schemaname + "." + t.tablename;
          const rows = await tx.unsafe(
            `select * from "${t.schemaname}"."${t.tablename}" order by to_jsonb("${t.tablename}")::text`,
          );
          // Added columns have empty defaults; all pre-existing column values remain exact.
          const keys = Object.keys(snapshot[key][0] ?? {});
          assert.equal(
            hash(
              rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]]))),
            ),
            hash(snapshot[key]),
            "Existing data changed: " + key,
          );
        }
      return {
        at: new Date().toISOString(),
        passed: true,
        applied: apply,
        projectRef,
        missing,
        migrations,
        members,
        admission: admission[0],
        backup: apply
          ? {
              path: backupPath,
              sha256: digest,
              tables: tables.length,
              readBackVerified: true,
              scope:
                "All existing application tables; excludes Auth and storage",
            }
          : null,
        memberMutations: 0,
      };
    });
    writeFileSync(
      out + "/migration-" + (apply ? "applied" : "inspection") + ".json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error({
    passed: false,
    code: e.code ?? "ASSERTION",
    message:
      e instanceof assert.AssertionError
        ? e.message
        : "Secure migration failed; no partial migration committed",
  });
  process.exitCode = 1;
});
