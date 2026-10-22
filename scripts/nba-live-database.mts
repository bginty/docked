// Exact existing Production private beta. Never changes Auth, wallets or NFL data.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const source =
  "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au";
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const multiSport = process.argv.includes("--multisport");
const operations = process.argv.includes("--operations");
const evidence =
  source +
  (operations
    ? "/docs/qa/overnight-multisport/release/operations-migration"
    : multiSport
      ? "/docs/qa/overnight-multisport/release"
      : "/docs/qa/nba-private-beta-live");
const privateDir = operations
  ? "private-data/multisport-private-beta-operations"
  : multiSport
    ? "private-data/multisport-private-beta-live"
    : "private-data/nba-private-beta-live";
const files = operations
  ? ["20261022211500_private_beta_operations_report.sql"]
  : multiSport
    ? [
        "20261022115817_nba_isolated_economy_boundary.sql",
        "20261022122441_multi_sport_private_beta_access.sql",
        "20261022123136_multi_sport_fixture_economy.sql",
        "20261022124750_fixture_inventory_projection.sql",
        "20261022203038_fixture_social_audience.sql",
      ]
    : [
        "20261010092154_scoring_v1_isolated_journal.sql",
        "20261021120641_multi_sport_lineup_adapters.sql",
        "20261021122246_additional_sport_sandbox_formats.sql",
        "20261021230000_isolated_sport_tester_access.sql",
        "20261022010531_multi_sport_readiness_registry.sql",
        "20261022023942_multi_sport_delivery_checkpoint.sql",
        "20261022053636_nba_proposal_isolated_score_read.sql",
        "20261022101445_nba_private_beta_access.sql",
      ];
const mode = process.argv[2];
assert(["inspect", "rehearse", "apply", "verify"].includes(mode));
assert.equal(projectRef, "pojoymtniryarxxunyvz");
await mkdir(evidence, { recursive: true });
await mkdir(privateDir, { recursive: true });
const sql = ownerDatabase();
const hashes = await Promise.all(
  files.map(async (file) => ({
    file,
    hash: createHash("sha256")
      .update(await readFile(source + "/supabase/migrations/" + file))
      .digest("hex"),
  })),
);
const snapshot = async (tx: Pick<Sql, "unsafe">) => {
  const answer: Record<string, unknown> = {};
  for (const table of [
    "beta_fantasy.cards",
    "beta_fantasy.entries",
    "beta_fantasy.results",
    "beta_fantasy.ownership_events",
    "beta_fantasy.sales",
    "credits_sandbox.state",
    "sports_feed.nfl_rounds",
    "sports_feed.nfl_control",
    "beta_fantasy.players",
    "sports_feed.sport_sandbox_inventory",
  ]) {
    answer[table] = (
      await tx.unsafe(
        `select count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
      )
    )[0];
  }
  return answer;
};
try {
  const existing =
    await sql`select version,name from supabase_migrations.schema_migrations order by version`;
  const missing = files.filter(
    (f) => !existing.some((x) => x.version === f.split("_")[0]),
  );
  const before = await snapshot(sql);
  if (mode === "inspect") {
    const functions =
      await sql`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('sports_feed','beta_private','credits_sandbox') and p.prokind='f'`;
    if (
      !(await readFile(privateDir + "/preimage.private.json").then(
        () => true,
        () => false,
      ))
    )
      await writeFile(
        privateDir + "/preimage.private.json",
        JSON.stringify({
          at: new Date().toISOString(),
          projectRef,
          functions,
          before,
          existing,
        }),
        { flag: "wx", mode: 0o600 },
      );
    await writeFile(
      evidence + "/database-inspect.json",
      JSON.stringify(
        {
          projectRef,
          missing,
          hashes,
          before,
          backup:
            "Private function preimage and record hashes retained; additive schema rollback retains audit data.",
        },
        null,
        2,
      ),
    );
  } else if (mode === "rehearse" || mode === "apply") {
    if (mode === "apply") {
      const rehearsal = JSON.parse(
        await readFile(evidence + "/database-rehearse.json", "utf8"),
      );
      assert.equal(rehearsal.passed, true);
      assert.deepEqual(rehearsal.hashes, hashes);
      assert.deepEqual(rehearsal.missing, missing);
    }
    let receipt: Record<string, unknown> | undefined;
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71022026)`;
        await tx`set local lock_timeout='10s'`;
        await tx`set local statement_timeout='60s'`;
        const lockedBefore = await snapshot(tx);
        for (const file of missing) {
          const body = await readFile(
            source + "/supabase/migrations/" + file,
            "utf8",
          );
          await tx.unsafe(body);
          if (mode === "apply")
            await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values(${file.split("_")[0]},${file.slice(15, -4)},${[body]})`;
        }
        assert.deepEqual(
          await snapshot(tx),
          lockedBefore,
          "Existing production records changed",
        );
        assert.equal(
          (
            await tx`select rolbypassrls or rolsuper elevated from pg_roles where rolname='docked_beta_app'`
          )[0].elevated,
          false,
        );
        receipt = {
          projectRef,
          mode,
          passed: true,
          missing,
          hashes,
          before: lockedBefore,
          existingRecordsUnchanged: true,
        };
        if (mode === "rehearse") throw Error("ROLLBACK_REHEARSAL");
      });
    } catch (e) {
      if (!(
        mode === "rehearse" &&
        e instanceof Error &&
        e.message === "ROLLBACK_REHEARSAL"
      ))
        throw e;
    }
    await writeFile(
      evidence + `/database-${mode}.json`,
      JSON.stringify(receipt, null, 2),
    );
  } else {
    const backup = JSON.parse(
      await readFile(privateDir + "/preimage.private.json", "utf8"),
    );
    const unchanged = Object.fromEntries(
      Object.keys(before).map((k) => [
        k,
        JSON.stringify(before[k]) === JSON.stringify(backup.before[k]),
      ]),
    );
    await writeFile(
      evidence + "/database-verify.json",
      JSON.stringify(
        {
          projectRef,
          at: new Date().toISOString(),
          missing,
          unchanged,
          before,
        },
        null,
        2,
      ),
    );
  }
  console.log(JSON.stringify({ projectRef, mode, missing, completed: true }));
} catch (e) {
  console.error({
    failed: true,
    mode,
    code: (e as { code?: string }).code ?? "FAILED",
    message:
      e instanceof Error
        ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
        : "Unknown error",
  });
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
