/** Production READ ONLY. Identifiers and customer detail stay in ignored private-data. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const out = "private-data/clean-transition-20261117";
mkdirSync(out, { recursive: true });
mkdirSync("docs/qa/clean-transition-20261117", { recursive: true });
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const accounts =
          await tx`select u.id,u.email,u.phone,u.email_confirmed_at,u.phone_confirmed_at,u.invited_at,u.created_at,u.deleted_at,u.banned_until,u.is_anonymous,
        (select to_jsonb(p) from beta_public.profiles p where p.id=u.id) beta_profile,
        (select to_jsonb(p) from public.profiles p where p.id=u.id) public_profile,
        (select jsonb_agg(to_jsonb(r)) from beta_private.roles r where r.user_id=u.id) beta_roles,
        (select jsonb_agg(to_jsonb(r)) from private.roles r where r.user_id=u.id) public_roles,
        (select jsonb_agg(to_jsonb(a)) from credits_sandbox.access a where a.user_id=u.id) credit_access,
        (select jsonb_agg(jsonb_build_object('status',f.status,'type',f.factor_type,'created',f.created_at)) from auth.mfa_factors f where f.user_id=u.id) factors,
        (select jsonb_build_object('count',count(*),'aal2',count(*)filter(where aal='aal2'),'unexpired',count(*)filter(where not_after is null or not_after>now())) from auth.sessions s where s.user_id=u.id) sessions,
        (select jsonb_agg(jsonb_build_object('provider',i.provider,'created',i.created_at,'email',i.identity_data->>'email','provider_id',i.provider_id)) from auth.identities i where i.user_id=u.id) identities
        from auth.users u order by u.created_at,u.id`;
        const tables =
          await tx`select table_schema,table_name,jsonb_agg(column_name order by ordinal_position) columns from information_schema.columns where table_schema in('beta_private','beta_public','private','public','operations','commercial_billing','sports_feed','beta_fantasy','credits_sandbox') group by 1,2 order by 1,2`;
        const functions =
          await tx`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and n.nspname in('private','beta_private','commercial_billing','operations') and (p.proname in('admitted','active_member_session','beta_gameplay_identity','gameplay_mfa_required','public_phone_verified','sync_verified_phone_claim','owner_actor','preserved_collection_rows','member_record') or p.proname like '%onboarding%')`;
        const foreignKeys =
          await tx`select c.conrelid::regclass::text relation,c.conname,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.contype='f' and c.confrelid in('auth.users'::regclass,'beta_public.profiles'::regclass,'public.profiles'::regclass) order by 1,2`;
        const [state] =
          await tx`select revision,document from credits_sandbox.state where id`;
        const consent =
          await tx`select to_jsonb(c) value from beta_private.consent_events c order by created_at,id`;
        const policies =
          await tx`select key,enabled from private.feature_flags order by key`;
        const [commercial] =
          await tx`select (select count(*) from commercial_billing.receipts) receipts,(select count(*) from commercial_billing.cards) cards,(select count(*) from commercial_billing.packs) packs,(select count(*) from commercial_billing.accounts) accounts,(select count(*) from commercial_billing.definitions) definitions,(select sum(issued) from commercial_billing.definitions) issued,(select to_jsonb(c) from commercial_billing.control c where id) control`;
        const authSchema =
          await tx`select version from auth.schema_migrations order by version desc limit 5`;
        return {
          accounts,
          tables,
          functions,
          foreignKeys,
          state,
          consent,
          policies,
          commercial,
          authSchema,
        };
      },
    );
    const snapshot = {
      at: new Date().toISOString(),
      project: "pojoymtniryarxxunyvz",
      productionWrites: 0,
      ...result,
    };
    const bytes = JSON.stringify(snapshot, null, 2) + "\n";
    writeFileSync(out + "/audit.private.json", bytes, { mode: 0o600 });
    const summary = result.accounts.map((a) => ({
      ref: a.id.slice(0, 8) + "…",
      identityDigest: createHash("sha256").update(a.id).digest("hex"),
      profileHint:
        a.beta_profile?.display_name ?? a.beta_profile?.username ?? null,
      emailDomain: a.email?.split("@")[1],
      emailVerified: !!a.email_confirmed_at,
      phoneSet: !!a.phone,
      phoneVerified: !!a.phone_confirmed_at,
      deleted: !!a.deleted_at,
      banned: !!a.banned_until,
      roles: a.beta_roles?.map((r: any) => r.role) ?? [],
      factors: a.factors,
      sessions: a.sessions,
      country: a.beta_profile?.country,
      profile: !!a.beta_profile,
    }));
    writeFileSync(
      "docs/qa/clean-transition-20261117/audit-index.json",
      JSON.stringify(
        {
          at: snapshot.at,
          productionWrites: 0,
          auditSha256: createHash("sha256").update(bytes).digest("hex"),
          accounts: summary,
          commercial: result.commercial,
          foreignKeys: result.foreignKeys,
          authSchema: result.authSchema,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          accounts: summary,
          tables: result.tables.filter((t) =>
            /invit|admiss|eligib|policy|notice|lineup|social|consent|terms/.test(
              t.table_name,
            ),
          ),
          commercial: result.commercial,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-only audit failed; no Production writes");
  process.exitCode = 1;
});
