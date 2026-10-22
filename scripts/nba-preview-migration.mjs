import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
const root = process.argv[2],
  apply = process.argv[3] === "--apply-preview";
assert(root && ["--rehearse", "--apply-preview"].includes(process.argv[3]));
const ref = "bckkllmndoxzpzdqrevb",
  file = "20261022053636_nba_proposal_isolated_score_read.sql";
const c = JSON.parse(
  await readFile(root + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, ref);
assert.equal(c.organizationId, "ernfnkcbalhyqpsrzdwa");
const u = new URL(c.databaseUrl);
assert.equal(decodeURIComponent(u.username), "postgres." + ref);
assert(u.hostname.endsWith(".pooler.supabase.com"));
assert.equal(u.port, "5432");
const ddl = await readFile("supabase/migrations/" + file, "utf8"),
  hash = createHash("sha256").update(ddl).digest("hex");
assert(!/^\s*(begin|commit|rollback)\s*;/im.test(ddl));
const out = "docs/qa/multi-sport/nba-acceptance/";
if (apply) {
  const r = JSON.parse(
    await readFile(out + "migration-rehearsal.json", "utf8"),
  );
  assert.equal(r.passed, true);
  assert.equal(r.hash, hash);
  assert.equal(r.project, ref);
}
const db = postgres(c.databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 12,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(root + "/certs/supabase-prod-ca-2021.crt", "utf8"),
  },
});
const report = {
  project: ref,
  production: false,
  file,
  hash,
  mode: apply ? "applied" : "rolled-back rehearsal",
  passed: false,
};
const rollback = new Error("EXPECTED_ROLLBACK");
try {
  await db.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    await tx`set local statement_timeout='60s'`;
    const prior =
      await tx`select statements from supabase_migrations.schema_migrations where version='20261022053636'`;
    if (prior.length) {
      assert.equal(
        createHash("sha256").update(prior[0].statements.join("")).digest("hex"),
        hash,
      );
      report.mode = "already applied";
      report.passed = true;
      return;
    }
    assert.equal(
      (
        await tx`select max(version) v from supabase_migrations.schema_migrations`
      )[0].v,
      "20261022023942",
    );
    assert.equal(
      (await tx`select enabled from beta_private.admission_control`)[0].enabled,
      false,
    );
    const snapshot = async () => {
      const answer = {};
      for (const table of [
        "beta_fantasy.cards",
        "beta_fantasy.entries",
        "credits_sandbox.state",
        "scoring_beta.journal",
      ]) {
        answer[table] = (
          await tx.unsafe(
            `select count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          )
        )[0];
      }
      return answer;
    };
    const before = await snapshot();
    const definitions =
      await tx`select pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure) definition`;
    await mkdir("private-data/nba-acceptance", { recursive: true });
    if (apply)
      await writeFile(
        "private-data/nba-acceptance/migration-preimage.private.json",
        JSON.stringify({ project: ref, hash, definitions, before }),
        { flag: "wx", mode: 0o600 },
      );
    await tx.unsafe(ddl);
    assert.deepEqual(await snapshot(), before);
    const [grants] =
      await tx`select has_function_privilege('docked_beta_app','sports_feed.sandbox_nba_journals()','execute') app,has_function_privilege('anon','sports_feed.sandbox_nba_journals()','execute') anon,has_function_privilege('authenticated','sports_feed.sandbox_nba_journals()','execute') member,has_function_privilege('service_role','sports_feed.sandbox_nba_journals()','execute') service`;
    assert.deepEqual(grants, {
      app: true,
      anon: false,
      member: false,
      service: false,
    });
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values('20261022053636','nba_proposal_isolated_score_read',${tx.array([ddl])})`;
    report.passed = true;
    report.grants = grants;
    report.existingRecordsUnchanged = Object.keys(before);
    report.at = new Date().toISOString();
    if (!apply) throw rollback;
  });
} catch (e) {
  if (e !== rollback) {
    report.passed = false;
    report.code = /^[A-Z0-9_]+$/.test(e.code ?? "")
      ? e.code
      : "RECONCILIATION_REQUIRED";
    process.exitCode = 1;
  }
} finally {
  await db.end({ timeout: 2 });
  await mkdir(out, { recursive: true });
  await writeFile(
    out + (apply ? "migration-applied.json" : "migration-rehearsal.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
