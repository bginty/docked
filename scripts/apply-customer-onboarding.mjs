// Exact isolated Docked beta. Additive code only: no invite/account/activation.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
assert.equal(process.argv[2], "--apply");
const evidence = JSON.parse(
  readFileSync("docs/qa/friends-cutover/hosted-two-user-policy.json", "utf8"),
);
assert.equal(evidence.passed, true);
assert.ok(evidence.checks.some((s) => s.includes("owner policy resumption")));
const names = [
  "20261011045327_customer_beta_onboarding.sql",
  "20261011045504_customer_invitation_eligibility.sql",
];
const hash = (s) => createHash("sha256").update(s).digest("hex");
const sql = ownerDatabase();
try {
  const tables = [
    "auth.users",
    "auth.sessions",
    "auth.mfa_factors",
    "beta_public.profiles",
    "beta_private.admissions",
    "beta_private.admission_events",
    "beta_private.consent_events",
    "beta_fantasy.cards",
    "beta_fantasy.editions",
    "beta_fantasy.entries",
    "sports_feed.nfl_allocations",
    "fantasy.cards",
    "fantasy.editions",
  ];
  const fingerprint = async (tx) => {
    const rows = [];
    for (const table of tables)
      rows.push([
        table,
        (
          await tx.unsafe(
            `select md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${table} t`,
          )
        )[0].digest,
      ]);
    return hash(JSON.stringify(rows));
  };
  const before = await fingerprint(sql),
    applied = [];
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820341),pg_advisory_xact_lock(71820342)`;
    assert.equal(
      (await tx`select enabled from beta_private.friends_control`)[0].enabled,
      false,
    );
    for (const name of names) {
      const source = readFileSync(
          "supabase/migrations/" + name,
          "utf8",
        ).replaceAll("\r\n", "\n"),
        version = name.slice(0, 14);
      const prior =
        await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
      if (prior.length)
        assert.equal(
          hash(prior[0].statements[0].replaceAll("\r\n", "\n")),
          hash(source),
        );
      else {
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${name.slice(15, -4)},${[source]})`;
      }
      applied.push({ name, sha256: hash(source) });
    }
    assert.equal(await fingerprint(tx), before);
    for (const role of [
      "anon",
      "authenticated",
      "docked_app",
      "docked_beta_app",
    ])
      assert.equal(
        (
          await tx`select has_function_privilege(${role},'beta_private.finish_customer_signup(uuid,text)','execute') allowed`
        )[0].allowed,
        false,
      );
  });
  assert.equal(await fingerprint(sql), before);
  const report = {
    at: new Date().toISOString(),
    projectRef,
    applied,
    existingDataPreserved: true,
    accountsCreated: 0,
    invitationsSent: 0,
    activationChanged: false,
  };
  writeFileSync(
    "docs/qa/customer-onboarding/hosted-migrations.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await sql.end();
}
