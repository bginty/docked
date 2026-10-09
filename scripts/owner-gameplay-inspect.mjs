import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
try {
  const report = await sql.begin("read only", async (tx) => {
    const owners =
      await tx`select u.id,u.email_confirmed_at is not null confirmed,exists(select 1 from auth.mfa_factors f where f.user_id=u.id and status='verified') mfa,exists(select 1 from beta_private.designated_administrators d where d.user_id=u.id) designated,exists(select 1 from beta_private.roles r where r.user_id=u.id and role='owner') owner_role from auth.users u where lower(u.email)='support@docked.com.au'`;
    assert.equal(owners.length, 1);
    const owner = owners[0];
    assert.ok(
      owner.confirmed && owner.mfa && owner.designated && owner.owner_role,
    );
    // Identity stays in the private operator file; report contains booleans/counts only.
    mkdirSync("private-data/owner-gameplay", { recursive: true });
    writeFileSync(
      "private-data/owner-gameplay/owner.json",
      JSON.stringify({ id: owner.id }),
    );
    const settings = await tx`select * from beta_fantasy.settings`;
    const counts = {};
    for (const table of [
      "players",
      "editions",
      "cards",
      "packs",
      "members",
      "competitions",
      "production_catalog",
      "production_definitions",
      "results",
      "ownership_events",
    ])
      counts[table] = Number(
        (await tx.unsafe(`select count(*) n from beta_fantasy.${table}`))[0].n,
      );
    return {
      at: new Date().toISOString(),
      projectRef,
      owner: {
        confirmed: owner.confirmed,
        mfa: owner.mfa,
        designated: owner.designated,
        ownerRole: owner.owner_role,
      },
      settings,
      counts,
      control:
        await tx`select enabled,testers_enabled from beta_private.admission_control`,
      admission:
        await tx`select status,country,state,age_attested,policy_versions from beta_private.admissions where user_id=${owner.id}`,
      profile:
        await tx`select country,state,age_attested,accepted_version from beta_public.profiles where id=${owner.id}`,
      socialPolicies:
        await tx`select id,country,state,approved,features,effective_to,review_at from beta_private.region_policies where 'community_social'=any(features)`,
      authSessions: Number(
        (
          await tx`select count(*) n from auth.sessions where user_id=${owner.id} and (not_after is null or not_after>now())`
        )[0].n,
      ),
      scope:
        "Read-only metadata inspection. No session tokens, factor secrets, passwords or personal holdings exported.",
    };
  });
  mkdirSync("docs/qa/owner-gameplay", { recursive: true });
  writeFileSync(
    "docs/qa/owner-gameplay/preflight.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end({ timeout: 5 });
}
