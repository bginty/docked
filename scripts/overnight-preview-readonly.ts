/** No Auth requests, messages, grants, fixture resets or configuration changes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls";
const config = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(
  new URL(config.databaseUrl).username,
  "postgres.bckkllmndoxzpzdqrevb",
);
const sql = postgres(config.databaseUrl, {
  ...databaseConnectionOptions(config.databaseUrl, {
    DATABASE_SSL_CA_FILE: path.resolve("certs/supabase-prod-ca-2021.crt"),
  }),
  max: 1,
  onnotice: () => {},
});
async function main() {
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const qa =
          await tx`select u.id,u.email_confirmed_at is not null email_confirmed,p.disabled_at is null enabled,p.country='AU' and p.age_attested australian_adult,
      (u.phone_confirmed_at is not null and u.phone ~ '^614[0-9]{8}$') phone_verified,u.phone_change_sent_at,u.phone_confirmed_at,
      exists(select 1 from commercial_billing.recovery_cases r where r.member_id=u.id and r.state='OPEN') recovery_hold,
      (select coalesce(sum(remaining),0)::int from commercial_billing.lots where member_id=u.id) balance,
      (select count(*)::int from commercial_billing.receipts where member_id=u.id) receipts
      from auth.users u join public.profiles p on p.id=u.id where u.deleted_at is null and u.email ~ '^docked-preview-public-member-[a-f0-9]+@example[.]invalid$' order by u.created_at,u.id`;
        assert.equal(qa.length, 2);
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
        const [counts] =
          await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.packs) packs,(select count(*)::int from commercial_billing.receipts) receipts,(select coalesce(sum(exposure_credits),0)::int from commercial_billing.recovery_cases where state='OPEN') recovery_exposure,(select count(*)::int from private.verified_phone_claims) verified_phone_claims`;
        const [guards] =
          await tx`select to_regprocedure('private.public_phone_verified(uuid)') is not null verified_guard,
      exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='docked_verified_phone_claim' and tgenabled='O' and tgfoid=to_regprocedure('private.sync_verified_phone_claim()')) canonical_claim_trigger,
      (select count(*)::int from pg_namespace where nspname like 'batch1_acceptance%') disposable_batch_namespaces`;
        return {
          at: new Date().toISOString(),
          projectRef: "bckkllmndoxzpzdqrevb",
          control,
          counts,
          guards,
          members: qa.map((r) => ({
            ...r,
            id: undefined,
            identitySha256: createHash("sha256").update(r.id).digest("hex"),
          })),
          genuinelyVerifiedUnblockedAccounts: qa.filter(
            (r) => r.phone_verified && !r.recovery_hold,
          ).length,
          smsAcceptance: qa.some((r) => r.phone_verified)
            ? "Confirmed Auth phone evidence present; still reconcile provider/physical-device evidence"
            : "No genuine QA phone confirmation recorded; attended acceptance outstanding",
          productionWrites: 0,
          previewWrites: 0,
          authRequests: 0,
          smsAttempts: 0,
          phonesOrCredentialsDisclosed: false,
        };
      },
    );
    writeFileSync(
      "docs/qa/overnight-launch-20261117/preview-readonly.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    "Preview read-only assessment incomplete; no mutations performed or private response printed.",
  );
  process.exitCode = 1;
});
