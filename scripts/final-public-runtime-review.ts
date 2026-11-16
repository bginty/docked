import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const [profiles] =
          await tx`select (select count(*)::int from beta_public.profiles) beta_profiles,
  (select count(*)::int from public.profiles) public_profiles,
  (select count(*)::int from beta_public.profiles b join public.profiles p on p.id=b.id) same_auth_id_in_both,
  (select count(*)::int from beta_public.profiles b left join public.profiles p on p.id=b.id where p.id is null) missing_public_profile,
  (select count(*)::int from beta_private.roles) beta_roles,(select count(*)::int from private.roles) public_roles`;
        const policies =
          await tx`select country,approved,preview_community_only,count(*)::int total,count(*)filter(where review_at>now() and effective_from<=now() and effective_to>now())::int current from private.region_policies group by 1,2,3`;
        const gates =
          await tx`select key,enabled from private.feature_flags where key in('registration','payments','trading','competitions','prizes','withdrawals') order by key`;
        const roles =
          await tx`select rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname in('docked_app','docked_beta_app','docked_commercial_app') order by rolname`;
        const privileges =
          await tx`select has_table_privilege('docked_app','public.profiles','SELECT') public_profile_read,
  has_table_privilege('docked_app','private.runtime_auth_users','SELECT') auth_read,
  has_table_privilege('docked_app','private.runtime_auth_sessions','SELECT') session_read,
  has_table_privilege('docked_app','beta_public.profiles','SELECT') beta_profile_read,
  has_table_privilege('docked_app','credits_sandbox.state','SELECT') legacy_collection_read`;
        const schemas =
          await tx`select table_schema,table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where (table_schema in('public','beta_public') and table_name='profiles') or(table_schema in('private','beta_private') and table_name in('roles','consent_events')) order by table_schema,table_name,ordinal_position`;
        const roleKinds =
          await tx`select role,count(*)::int count from beta_private.roles group by role`;
        const [collectionProjection] =
          await tx`select pg_get_functiondef('commercial_billing.preserved_collection_rows(uuid,text)'::regprocedure) definition`;
        const pendingLegacyPacks =
          await tx`select e.value->>'status' status,count(*)::int total from credits_sandbox.state s cross join lateral jsonb_each(s.document->'entitlements') e where s.id group by 1`;
        const sealedLegacyDetail =
          await tx`select e.value->>'kind' kind,e.value->>'product' product,
      exists(select 1 from beta_public.profiles p where p.id::text=e.value->>'member' and p.disabled_at is null) active_profile,
      exists(select 1 from credits_sandbox.access a where a.user_id::text=e.value->>'member' and a.enabled) beta_access,
      jsonb_array_length(coalesce(s.document->'economy'->'packs'->e.key->'cards','[]')) allocated_cards,
      (e.value ? 'receipt') receipt_present
      from credits_sandbox.state s cross join lateral jsonb_each(s.document->'entitlements') e where s.id and e.value->>'status'='SEALED'`;
        return {
          profiles,
          policies,
          gates,
          roles,
          privileges,
          schemas,
          roleKinds,
          collectionProjection,
          pendingLegacyPacks,
          sealedLegacyDetail,
        };
      },
    );
    writeFileSync(
      "docs/qa/final-release-decision-20261117/public-runtime-review.json",
      JSON.stringify(
        { at: new Date().toISOString(), productionWrites: 0, ...result },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        profiles: result.profiles,
        roleKinds: result.roleKinds,
        collectionProjection: result.collectionProjection,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-only runtime review failed; no mutations.");
  process.exitCode = 1;
});
