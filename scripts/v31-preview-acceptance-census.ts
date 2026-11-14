/** Read-only admission census. Never creates an identity or clears a TEST hold. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import path from "node:path";
import { databaseConnectionOptions } from "../src/server/database-tls";
async function main() {
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
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const rows =
          await tx`select u.id,u.email,u.email_confirmed_at is not null confirmed,p.disabled_at is null enabled,p.country='AU' and p.age_attested australian_adult,
     (u.phone_confirmed_at is not null and u.phone ~ '^614[0-9]{8}$') phone_verified,
     exists(select 1 from commercial_billing.recovery_cases r where r.member_id=u.id and r.state='OPEN') recovery_hold,
     (select count(*)::int from commercial_billing.receipts r where r.member_id=u.id) receipt_count,
     (select count(*)::int from commercial_billing.lots l where l.member_id=u.id and l.remaining<>0) funded_lots
     from auth.users u join public.profiles p on p.id=u.id where u.deleted_at is null and u.email ~ '^docked-preview-public-member-[a-f0-9]+@example[.]invalid$' order by u.created_at,u.id`;
        const safe = rows.filter(
          (r) =>
            r.confirmed && r.enabled && r.australian_adult && !r.recovery_hold,
        );
        writeFileSync(
          "private-data/v31-revenue-launch-20261113/preview-acceptance-candidates.private.json",
          JSON.stringify(
            {
              at: new Date().toISOString(),
              projectRef: config.projectRef,
              candidates: safe.map((r) => ({
                id: r.id,
                email: r.email,
                phoneVerified: r.phone_verified,
                receiptCount: r.receipt_count,
                fundedLots: r.funded_lots,
              })),
            },
            null,
            2,
          ),
          { flag: "wx", mode: 0o600 },
        );
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled from commercial_billing.control where id`;
        const [schema] =
          await tx`select to_regprocedure('private.public_phone_verified(uuid)') is not null phone_guard_present,
            to_regclass('private.verified_phone_claims') is not null canonical_claim_registry_present,
            exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='docked_verified_phone_claim' and tgenabled='O' and tgfoid=to_regprocedure('private.sync_verified_phone_claim()')) canonical_claim_trigger_present`;
        return {
          at: new Date().toISOString(),
          projectRef: config.projectRef,
          existingQaMembers: rows.length,
          unblockedExistingCandidates: safe.length,
          alreadyPhoneVerified: safe.filter((r) => r.phone_verified).length,
          holdAccountsExcluded: rows.filter((r) => r.recovery_hold).length,
          control,
          schema,
          productionWrites: 0,
          previewWrites: 0,
          identitiesCreated: 0,
          holdsCleared: 0,
          phonesDisclosed: 0,
          decision: safe.length
            ? "Use an existing eligible candidate only after founder-controlled verification and exact bounded acceptance approval."
            : "Existing QA member has a preserved recovery hold. A separate isolated ordinary QA identity needs explicit acceptance authority; never waive the hold or reset historical accounting.",
        };
      },
    );
    writeFileSync(
      "docs/qa/v31-revenue-launch-20261113/preview-acceptance-census.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((error: { code?: string }) => {
  console.error(
    "Read-only Preview admission census incomplete; no hosted data changed. Code: " +
      (/^[A-Z0-9_]{3,32}$/.test(error.code ?? "") ? error.code : "redacted"),
  );
  process.exitCode = 1;
});
