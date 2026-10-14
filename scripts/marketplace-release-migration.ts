// Exact-target reviewed release only. No member command, asset rewrite or QA copy.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
const files = [
  "20261014021342_marketplace_phase_one_guards.sql",
  "20261014081315_marketplace_legacy_identity_compatibility.sql",
  "20261014081931_nfl_locked_worker_read_scope.sql",
];
const sources = files.map((file) => ({
  file,
  version: file.slice(0, 14),
  source: readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
    "\r\n",
    "\n",
  ),
}));
async function main() {
  const apply = process.argv[2] === "--apply";
  assert.ok(apply || process.argv[2] === "--snapshot");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const folder = "docs/qa/marketplace-release",
    privateFolder = "private-data/marketplace-release";
  mkdirSync(privateFolder, { recursive: true });
  mkdirSync(folder, { recursive: true });
  const preflight = JSON.parse(
    readFileSync(folder + "/database-preflight.json", "utf8"),
  );
  assert.equal(preflight.projectRef, projectRef);
  assert.equal(preflight.passed, true);
  if (apply) {
    const gates = JSON.parse(readFileSync(folder + "/decision.json", "utf8"));
    assert.equal(gates.decision, "RELEASE");
    assert.equal(gates.commit, commit);
    assert.deepEqual(
      gates.migrations,
      sources.map((s) => ({ file: s.file, sha256: digest(s.source) })),
    );
    for (const key of [
      "integrated",
      "restrictedWorker",
      "races",
      "database",
      "platform",
      "browser",
      "typecheck",
      "lint",
      "build",
      "clientBoundary",
      "reviewedSecrets",
      "targetCompatibility",
      "rollback",
      "noMemberQa",
      "controlsClosed",
    ])
      assert.equal(gates.checks[key], true, key);
    assert.equal(
      execFileSync(
        "git",
        [
          "diff",
          "--name-only",
          "HEAD",
          "--",
          "src",
          "config",
          "supabase/migrations",
        ],
        { encoding: "utf8" },
      ).trim(),
      "",
    );
  }
  const sql = ownerDatabase();
  try {
    const snapshot = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const functions =
          await tx`select n.nspname schema,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='sports_feed' and p.proname in ('seven_inventory','card_entry_reserved','rarity_transfer_guard')) or (n.nspname='beta_fantasy' and p.proname in ('swap_read_state','swap_command','swap_command_before_nfl'))`;
        const data: Record<string, unknown> = {};
        for (const table of [
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
        ])
          data[table] = await tx.unsafe("select * from " + table);
        const policies =
          await tx`select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='beta_fantasy' and tablename in('entries','competitions','slot_locks')`;
        return {
          projectRef,
          commit,
          at: new Date().toISOString(),
          functions,
          policies,
          data,
        };
      },
    );
    const path = privateFolder + `/before-${commit}.json`;
    // Preserve the first pre-release snapshot if retrying an uncertain command.
    try {
      readFileSync(path);
    } catch {
      writeFileSync(path, JSON.stringify(snapshot), { mode: 0o600 });
    }
    const saved = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(saved.projectRef, projectRef);
    const coverage = {
      path,
      sha256: digest(saved),
      tables: Object.fromEntries(
        Object.entries(saved.data).map(([k, v]) => [
          k,
          (v as unknown[]).length,
        ]),
      ),
      functions: saved.functions.length,
      scope:
        "Affected application data and function/policy definitions; not full Auth/storage disaster recovery",
      verifiedReadable: true,
    };
    writeFileSync(folder + "/backup.json", JSON.stringify(coverage, null, 2));
    if (!apply) {
      console.log(JSON.stringify({ snapshot: true, projectRef, ...coverage }));
      return;
    }
    const receipt = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820342)`;
      const protectedState = async () => ({
        state: await tx`select revision,document from credits_sandbox.state`,
        cards:
          await tx`select id,owner_id,serial from beta_fantasy.cards order by id`,
        entries: await tx`select * from beta_fantasy.entries order by id`,
        locks:
          await tx`select * from beta_fantasy.slot_locks order by competition_id,user_id,slot`,
      });
      const before = digest(await protectedState());
      const applied = [];
      for (const s of sources) {
        const [old] =
          await tx`select statements from supabase_migrations.schema_migrations where version=${s.version}`;
        if (old)
          assert.equal(
            digest(old.statements[0].replaceAll("\r\n", "\n")),
            digest(s.source),
          );
        else {
          await tx.unsafe(s.source);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${s.version},${s.file.slice(15, -4)},${[s.source]})`;
        }
        applied.push({
          file: s.file,
          sha256: digest(s.source),
          alreadyApplied: !!old,
        });
      }
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          (
            await tx`select has_function_privilege(${role},'credits_sandbox.market_context(uuid)','execute') allowed`
          )[0].allowed,
          false,
        );
      assert.equal(
        (
          await tx`select has_column_privilege('docked_nfl_worker','beta_fantasy.entries','snapshot','SELECT') allowed`
        )[0].allowed,
        true,
      );
      assert.equal(
        (
          await tx`select has_column_privilege('docked_nfl_worker','beta_fantasy.entries','snapshot','UPDATE') allowed`
        )[0].allowed,
        false,
      );
      assert.equal(
        digest(await protectedState()),
        before,
        "Member assets/teams/locks must not change",
      );
      const out = {
        at: new Date().toISOString(),
        projectRef,
        commit,
        applied,
        protectedHash: before,
        memberAssetsUnchanged: true,
        qaCopied: false,
      };
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('owner-authorised-release','marketplace_phase_one_release',${commit},${tx.json(out)})`;
      return out;
    });
    writeFileSync(
      folder + "/migration-applied.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify(receipt));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error({ error: e.message });
  process.exitCode = 1;
});
