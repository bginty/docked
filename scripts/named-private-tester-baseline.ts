/** Read-only live baseline; does not contain Auth credentials, emails or customer rows. */
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { namedTesterDirectory, namedTesterId } from "./lib/named-tester-plan";
async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const response = await fetch("https://docked.com.au/api/beta-release", {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Production identity unavailable");
    const live = await response.json();
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const functions =
          await tx`select p.oid::regprocedure::text identity,pg_get_functiondef(p.oid) definition,
    coalesce(p.proacl::text,'') acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='beta_private'
    and p.proname in('admitted_before_owner_gameplay','customer_signup_identity','pending_beta_consent','profile_admission_guard',
     'admitted','admission_guard','renew_customer_consent','beta_gameplay_identity','gameplay_mfa_required') order by p.oid::regprocedure::text`;
        const constraints =
          await tx`select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='beta_private.admissions'::regclass and contype='c' order by conname`;
        const [counts] =
          await tx`select (select count(*) from commercial_billing.definitions)::int definitions,
    (select sum(legacy_issued) from commercial_billing.definitions)::int legacy_issued,
    (select count(*) from beta_packs.issued)::int beta_issued,
    (select sum(issued) from commercial_billing.definitions)::int lifetime_issued,
    (select count(*) from commercial_billing.cards)::int commercial_cards,
    (select count(*) from beta_packs.members)::int private_pack_members,
    (select status='accepted' from beta_private.admissions where user_id=${namedTesterId}::uuid) named_member_admission_accepted,
    (select count(*) from beta_private.consent_events where user_id=${namedTesterId}::uuid)::int named_member_consents`;
        const [controls] =
          await tx`select (select enabled from beta_private.feature_flags where key='registration') registration,
    (select bool_or(sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) from commercial_billing.control) commercial,
    (select enabled from beta_packs.control where id) private_packs,
    (select grants_enabled from beta_packs.control where id) founder_grants`;
        return { functions, constraints, counts, controls };
      },
    );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          functions: data.functions,
          constraints: data.constraints,
        }),
      )
      .digest("hex");
    const out = {
      at: new Date().toISOString(),
      productionWrites: 0,
      live,
      schemaFingerprint: fingerprint,
      ...data,
    };
    mkdirSync(namedTesterDirectory, { recursive: true });
    writeFileSync(
      namedTesterDirectory + "production-baseline.json",
      JSON.stringify(out, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        productionWrites: 0,
        commit: live.commit,
        schemaFingerprint: fingerprint,
        counts: data.counts,
        controls: data.controls,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
