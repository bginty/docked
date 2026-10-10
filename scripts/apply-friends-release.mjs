// Additive, exact-project-only. Never opens admission, swaps, payments or registration.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
const mode = process.argv[2];
assert.ok(["--inspect", "--apply"].includes(mode));
const sql = ownerDatabase(),
  runtime = ownerRuntimeDatabase();
const files = [
  "20261010112653_friends_beta_admission_boundary.sql",
  "20261010112939_owner_operations_read_model.sql",
  "20261010114202_friends_card_swap_boundary.sql",
];
const hash = (s) => createHash("sha256").update(s).digest("hex");
const sources = files.map((file) => ({
  file,
  sql: readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
    "\r\n",
    "\n",
  ),
}));
const evidence = JSON.parse(
  readFileSync("docs/qa/friends-release/real-postgres.json", "utf8"),
);
assert.equal(evidence.passed, true);
for (const s of sources)
  assert.equal(
    evidence.migrationHashes[s.file],
    hash(s.sql),
    "Exact migration evidence required",
  );
const report = {
  at: new Date().toISOString(),
  projectRef,
  mode,
  passed: false,
  scope: "Hosted database/operator context; not browser owner acceptance",
  checks: [],
};
try {
  const tables =
    await sql`select schemaname,tablename from pg_tables where schemaname in('fantasy','private','public','beta_fantasy','beta_private','beta_public') order by 1,2`;
  const snapshot = async (tx) => {
    const rows = [];
    for (const t of tables) {
      const name = t.schemaname + "." + t.tablename;
      assert.match(name, /^[a-z_]+\.[a-z0-9_]+$/);
      rows.push({
        name,
        ...(
          await tx.unsafe(
            `select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${name} t`,
          )
        )[0],
      });
    }
    return hash(JSON.stringify(rows));
  };
  const before = await snapshot(sql);
  assert.equal(
    (
      await sql`select testers_enabled from beta_private.admission_control where id`
    )[0].testers_enabled,
    false,
  );
  assert.equal(
    (await sql`select enabled from beta_fantasy.swap_policy where id`)[0]
      .enabled,
    false,
  );
  const owner = (
    await sql`select owner_id from beta_private.owner_gameplay_control where enabled`
  )[0].owner_id;
  const session = (
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>now()) order by created_at desc limit 1`
  )[0]?.id;
  assert.ok(session, "Existing owner MFA session required; no reset");
  if (mode === "--apply")
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820341),pg_advisory_xact_lock(71820343)`;
      for (const s of sources) {
        const version = s.file.slice(0, 14),
          prior =
            await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
        if (prior.length) {
          assert.equal(
            hash(prior[0].statements[0].replaceAll("\r\n", "\n")),
            hash(s.sql),
          );
          continue;
        }
        await tx.unsafe(s.sql);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${s.file.slice(15, -4)},${[s.sql]})`;
      }
      assert.equal(
        await snapshot(tx),
        before,
        "Existing data changed; rollback",
      );
      assert.equal(
        (await tx`select enabled from beta_private.friends_control`)[0].enabled,
        false,
      );
    });
  if (mode === "--apply") {
    const context = (aal) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: session, aal })},true)`;
        return (
          await tx`select beta_private.owner_operations(now()-interval '1 day',now()+interval '30 days',null,false) value`
        )[0].value;
      });
    await assert.rejects(() => context("aal1"), /MFA/);
    const data = await context("aal2");
    assert.equal(data.scope, "beta");
    assert.equal(
      data.metrics.admitted,
      Number(
        (
          await sql`select count(*) n from beta_private.admissions where status='accepted' and not administrator`
        )[0].n,
      ),
    );
    for (const role of ["anon", "authenticated", "docked_app"])
      assert.equal(
        (
          await sql`select has_function_privilege(${role},'beta_private.owner_operations(timestamptz,timestamptz,text,boolean)','execute') ok`
        )[0].ok,
        false,
      );
    report.checks.push(
      "Existing owner AAL2 can read; AAL1 and untrusted roles denied; admitted count reconciles",
    );
  }
  assert.equal(await snapshot(sql), before);
  report.checks.push(
    "Every pre-existing gameplay, ownership, supply, history and policy record unchanged",
    "Admission and swap execution remain disabled",
  );
  report.passed = true;
  report.migrationHashes = Object.fromEntries(
    sources.map((s) => [s.file, hash(s.sql)]),
  );
  writeFileSync(
    `docs/qa/friends-release/hosted-${mode.slice(2)}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      passed: false,
      code: e.code ?? "ASSERTION",
      message:
        e instanceof assert.AssertionError
          ? e.message
          : "Safe migration/verification failure; inspect without secrets",
    }),
  );
  process.exitCode = 1;
} finally {
  await sql.end();
  await runtime.end();
}
