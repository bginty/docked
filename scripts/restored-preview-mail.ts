/** Separate hosted email transport; preserves the original loopback-only hook. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postgres from "postgres";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const c = JSON.parse(
  readFileSync(main + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(process.argv[2], "--prepare-isolated-only");
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function run() {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`create table if not exists preview_auth.hosted_mail(
   id uuid primary key default gen_random_uuid(),email text not null references preview_auth.allowed_recipients(email),
   auth_user_id uuid not null,action text not null check(action in ('signup','recovery')),token_hash text not null check(token_hash ~ '^(pkce_)?[a-f0-9]+$' and length(regexp_replace(token_hash,'^pkce_','')) between 40 and 256),
   redirect_to text not null check(redirect_to in ('https://docked-preview-s24-briant-ginty.vercel.app/auth/callback','https://docked-preview-s24-briant-ginty.vercel.app/auth/callback?next=/app/verified')),
   received_at timestamptz not null,expires_at timestamptz not null check(expires_at>received_at and expires_at<=received_at+interval '30 minutes'),
   unique(email,action,token_hash));
   alter table preview_auth.hosted_mail drop constraint if exists hosted_mail_token_hash_check;
   alter table preview_auth.hosted_mail add constraint hosted_mail_token_hash_check check(token_hash ~ '^(pkce_)?[a-f0-9]+$' and length(regexp_replace(token_hash,'^pkce_','')) between 40 and 256);
   alter table preview_auth.hosted_mail enable row level security;
   revoke all on preview_auth.hosted_mail from public,anon,authenticated,service_role,docked_app,docked_beta_app;
   grant insert on preview_auth.hosted_mail to supabase_auth_admin;
   drop policy if exists hosted_capture on preview_auth.hosted_mail;
   create policy hosted_capture on preview_auth.hosted_mail for insert to supabase_auth_admin with check(
    email like 'docked-preview-public-%@example.invalid' and exists(select 1 from preview_auth.allowed_recipients a where a.email=hosted_mail.email and a.revoked_at is null and a.expires_at>clock_timestamp() and hosted_mail.expires_at<=a.expires_at));`);
      await tx.unsafe(`create or replace function preview_auth.hosted_recipient_allowed(recipient text) returns boolean language sql stable security definer set search_path='' as $$
      select recipient ~ '^docked-preview-public-(member|deletion)-[a-f0-9]+@example[.]invalid$' and exists(select 1 from preview_auth.allowed_recipients a where a.email=recipient and a.revoked_at is null and a.expires_at>now())
    $$;
    revoke all on function preview_auth.hosted_recipient_allowed(text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
    grant usage on schema preview_auth to docked_public_acceptance;
    grant execute on function preview_auth.hosted_recipient_allowed(text) to docked_public_acceptance;`);
      const [f] =
        await tx`select pg_get_functiondef('preview_auth.capture_hosted_public_email(jsonb)'::regprocedure) definition`;
      assert(
        f.definition.includes("insert into preview_auth.captured_mail") ||
          f.definition.includes("insert into preview_auth.hosted_mail"),
      );
      await tx.unsafe(
        f.definition
          .replace(
            "token !~ '^(pkce_)?[a-f0-9]{40,256}$'",
            () =>
              "(token !~ '^(pkce_)?[a-f0-9]+$' or length(regexp_replace(token,'^pkce_','')) not between 40 and 256)",
          )
          .replace(
            "insert into preview_auth.captured_mail",
            "insert into preview_auth.hosted_mail",
          ),
      );
      const [grants] =
        await tx`select has_table_privilege('anon','preview_auth.hosted_mail','select') or has_table_privilege('authenticated','preview_auth.hosted_mail','select') or has_table_privilege('docked_app','preview_auth.hosted_mail','select') leaked`;
      assert.equal(grants.leaked, false);
    });
    console.log(
      "Hosted capture prepared: two expiring synthetic recipients; private insert only; original loopback constraints preserved.",
    );
  } finally {
    await sql.end();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
