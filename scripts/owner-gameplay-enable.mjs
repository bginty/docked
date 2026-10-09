// Authorized owner-only Preview setup. Never updates official data or Auth policy.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const mode = process.argv[2];
assert.ok(["--dry-run", "--apply"].includes(mode));
const migration = "20261009220656_owner_only_fantasy_gameplay.sql";
const source = readFileSync(
  "supabase/migrations/" + migration,
  "utf8",
).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
if (mode === "--apply") {
  const dry = JSON.parse(
    readFileSync("docs/qa/owner-gameplay/enable-dry-run.json", "utf8"),
  );
  const local = JSON.parse(
    readFileSync("docs/qa/beta-isolation/real-postgres.json", "utf8"),
  );
  assert.equal(dry.sha256, hash(source));
  assert.equal(local.passed, true);
  assert.equal(local.migrationHashes[migration], hash(source));
}
const sql = ownerDatabase();
let report;
const rollback = Error("QA_ROLLBACK");
try {
  await sql.begin(async (tx) => {
    const owner =
      await tx`select u.id from auth.users u join beta_private.roles r on r.user_id=u.id and r.role='owner' join beta_private.designated_administrators d on d.user_id=u.id where lower(u.email)='support@docked.com.au' and u.email_confirmed_at is not null and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')`;
    assert.equal(owner.length, 1);
    const id = owner[0].id;
    assert.equal(
      (await tx`select testers_enabled from beta_private.admission_control`)[0]
        .testers_enabled,
      false,
    );
    const snapshot = async () => {
      const rows = [];
      for (const t of await tx`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy') order by 1,2`) {
        assert.match(t.tablename, /^[a-z0-9_]+$/);
        rows.push({
          table: t.schemaname + "." + t.tablename,
          ...(
            await tx.unsafe(
              `select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${t.schemaname}.${t.tablename} t`,
            )
          )[0],
        });
      }
      return hash(JSON.stringify(rows));
    };
    const before = await snapshot();
    const supplies = JSON.stringify(
      await tx`select id,max_supply,issued from beta_fantasy.editions order by id`,
    );
    assert.equal(
      Number((await tx`select count(*) n from beta_fantasy.cards`)[0].n),
      0,
      "Do not touch existing holdings",
    );
    assert.equal(
      (await tx`select deployment_mode from beta_fantasy.settings`)[0]
        .deployment_mode,
      "preview",
    );
    await tx.unsafe(source);
    await tx`insert into beta_private.owner_gameplay_control(owner_id,enabled,authority) values(${id},true,'Owner instruction 10 October 2026: exclusively existing verified owner; protected Preview fantasy QA; no external admission')`;
    const [admission] =
      await tx`select policy_versions,country,state from beta_private.admissions where user_id=${id} and status='accepted'`;
    assert.ok(admission);
    await tx`select beta_fantasy.initialize_production(${projectRef},${admission.policy_versions.terms},${admission.policy_versions.privacy})`;
    // Existing round metadata is immutable. The app labels the entire isolated
    // owner window as fictional QA; never bypass its trigger to rename a round.
    await tx`insert into beta_private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values(${admission.country},${admission.state},'owner-fantasy-qa-2026-10-10',clock_timestamp(),clock_timestamp()+interval '30 days',clock_timestamp()+interval '30 days',true,18,array['community_social','public_profiles'],'Owner-only protected Preview QA authorization 10 October 2026. No external admission, paid services or public legal approval. Exact owner gate enforced independently.')`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values(${id},'owner_fantasy_qa_enabled',${id},${tx.json({ migration, sha256: hash(source), scope: "isolated fictional beta only", testers: false, realHoldingsChanged: false })})`;
    assert.equal(await snapshot(), before);
    assert.equal(
      JSON.stringify(
        await tx`select id,max_supply,issued from beta_fantasy.editions order by id`,
      ),
      supplies,
    );
    assert.equal(
      (await tx`select beta_private.owner_gameplay_identity(${id}) ok`)[0].ok,
      true,
    );
    assert.equal(
      (
        await tx`select beta_private.owner_gameplay_identity(gen_random_uuid()) ok`
      )[0].ok,
      false,
    );
    report = {
      at: new Date().toISOString(),
      mode,
      projectRef,
      migration,
      sha256: hash(source),
      officialTablesUnchanged: true,
      existingEditionLimitsAndIssuanceUnchanged: true,
      ownerOnly: true,
      testersEnabled: false,
      authChanged: false,
      mailSent: false,
      realHoldingsChanged: false,
    };
    if (mode === "--dry-run") throw rollback;
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values('20261009220656','owner_only_fantasy_gameplay',${[source]})`;
  });
} catch (e) {
  if (e !== rollback) throw e;
} finally {
  await sql.end({ timeout: 5 });
}
writeFileSync(
  `docs/qa/owner-gameplay/enable-${mode.slice(2)}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
