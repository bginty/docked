// Explicit owner-authorised account operation. No credentials or member assets are printed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";

async function main() {
  const apply = process.argv.includes("--apply");
  const target = "ef641248-67be-4c32-9b12-9205bfcee15b";
  const owner = "623d1e69-d0f3-493f-9713-108e8c21469a";
  const luke = "9fa5cdbb-aa2e-4ebe-9f2c-de9885233cd3";
  const file = "20261016233803_delegated_beta_admin_admission.sql";
  const source = readFileSync(`supabase/migrations/${file}`, "utf8");
  const authority =
    "Owner request 17 October 2026: give Barry admin access to see dashboard and admin tools; existing owner-only permissions and MFA retained.";
  const dir = "docs/qa/barry-admin";
  mkdirSync(dir, { recursive: true });
  mkdirSync("private-data/barry-admin", { recursive: true });
  const sql = ownerDatabase();
  try {
    const result = await sql.begin(async (tx) => {
      await tx`set local statement_timeout='30s'`;
      await tx`set local lock_timeout='10s'`;
      if (apply) await tx`select pg_advisory_xact_lock(71820343)`;
      const [control] =
        await tx`select enabled from beta_private.friends_control where id for update`;
      assert.equal(control.enabled, true);
      const [identity] =
        await tx`select u.id,u.email_confirmed_at is not null verified,
      exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') mfa,
      a.status admission,r.enabled roster,p.display_name
      from auth.users u join beta_private.admissions a on a.user_id=u.id
      join beta_private.friends_roster r on r.user_id=u.id and r.email=lower(u.email)
      join beta_private.social_profiles p on p.user_id=u.id
      where u.id=${target}::uuid and lower(u.email)='barrydearing@gmail.com'
      and not coalesce(u.is_anonymous,false) and coalesce(u.banned_until,'-infinity')<=clock_timestamp()`;
      assert.ok(
        identity?.verified &&
          identity.roster &&
          identity.admission === "accepted",
      );
      assert.equal(identity.display_name, "bazzzzz");
      const [ownerState] =
        await tx`select beta_private.owner_gameplay_identity(${owner}::uuid) allowed`;
      assert.equal(ownerState.allowed, true);
      const beforeRoles =
        await tx`select * from beta_private.roles order by user_id`;
      assert.ok(
        !beforeRoles.some((r) => r.user_id === target && r.role !== "admin"),
      );
      const beforeAdmission =
        await tx`select * from beta_private.admissions order by id`;
      const fingerprint = async () => {
        const result: Record<string, unknown> = {};
        for (const table of [
          "credits_sandbox.state",
          "credits_sandbox.card_instances",
          "beta_fantasy.cards",
          "beta_fantasy.entries",
          "beta_fantasy.entry_revisions",
          "sports_feed.weekly_core_packs",
        ]) {
          result[table] = (
            await tx.unsafe(
              `select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) digest from ${table} t`,
            )
          )[0];
        }
        return result;
      };
      const before = await fingerprint();
      const prior =
        await tx`select version from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
      if (apply) {
        if (!prior.length) {
          const functions =
            await tx`select pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='beta_private' and p.proname='beta_gameplay_identity'`;
          writeFileSync(
            `private-data/barry-admin/before-${Date.now()}.json`,
            JSON.stringify({
              projectRef,
              beforeRoles,
              beforeAdmission,
              before,
              functions,
            }),
            { mode: 0o600, flag: "wx" },
          );
          await tx.unsafe(source);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},'delegated_beta_admin_admission',${[source]})`;
        }
        if (!beforeRoles.some((r) => r.user_id === target)) {
          await tx`insert into beta_private.roles(user_id,role,assigned_by) values(${target}::uuid,'admin',${owner}::uuid)`;
          await tx`insert into beta_private.audit_events(actor,action,subject,details) values(${owner},'admin_role_granted',${target},${tx.json({ role: "admin", authority, source: "explicit-owner-request", ownerRoleGranted: false })})`;
        }
        const existing =
          await tx`select enabled from beta_private.delegated_admin_admissions where user_id=${target}::uuid`;
        if (!existing.length)
          await tx`insert into beta_private.delegated_admin_admissions(user_id,approved_by,authority,enabled) values(${target}::uuid,${owner}::uuid,${authority},true)`;
        else
          assert.equal(
            existing[0].enabled,
            true,
            "Do not reactivate a revoked grant implicitly",
          );
        assert.deepEqual(
          await fingerprint(),
          before,
          "Member assets must not change",
        );
        assert.deepEqual(
          await tx`select * from beta_private.admissions order by id`,
          beforeAdmission,
        );
        assert.deepEqual(
          Array.from(
            await tx`select * from beta_private.roles where user_id<>${target}::uuid order by user_id`,
          ),
          beforeRoles.filter((r) => r.user_id !== target),
        );
      }
      const [access] =
        await tx`select beta_private.admitted(${target}::uuid) admitted,beta_private.beta_gameplay_identity(${target}::uuid) identity,beta_private.gameplay_mfa_required(${target}::uuid) mfa_required,
      beta_private.admitted(${luke}::uuid) luke_admitted,beta_private.gameplay_mfa_required(${luke}::uuid) luke_mfa_required`;
      if (apply) {
        assert.ok(access.admitted && access.identity && access.mfa_required);
        assert.ok(access.luke_admitted && !access.luke_mfa_required);
        const [grants] =
          await tx`select relrowsecurity rls,has_table_privilege('docked_beta_app',oid,'SELECT,INSERT,UPDATE,DELETE') runtime,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') authenticated,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') anonymous from pg_class where oid='beta_private.delegated_admin_admissions'::regclass`;
        assert.ok(
          grants.rls &&
            !grants.runtime &&
            !grants.authenticated &&
            !grants.anonymous,
        );
      }
      return {
        at: new Date().toISOString(),
        projectRef,
        applied: apply,
        target,
        account: "bazzzzz",
        role: apply
          ? "admin"
          : (beforeRoles.find((r) => r.user_id === target)?.role ?? null),
        mfaEnrolled: identity.mfa,
        access,
        ownerCommandCentre: "owner-only",
        assetsUnchanged: true,
        otherRolesUnchanged: true,
        admissionsUnchanged: true,
        migration: file,
        sourceHash: createHash("sha256").update(source).digest("hex"),
        authority,
      };
    });
    writeFileSync(
      `${dir}/${apply ? "applied" : "inspection"}.json`,
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end();
  }
}
void main();
