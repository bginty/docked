/** Read-only Production metadata/data checks. Emits no credential or member data. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { custodyQuery } from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import { digest } from "../src/core/scoring-engine";
const sha = "17b38c1290fd37c05487b332e5c0db440da6805b";
async function main() {
  const runtime = JSON.parse(
    readFileSync(
      `C:/Users/61412/.codex/worktrees/v31-phone-privacy-candidate-20261112/Docked.com.au/private-data/nba-production/${sha}/runtime.private.json`,
      "utf8",
    ),
  );
  assert.equal(runtime.VERCEL_GIT_COMMIT_SHA, sha);
  const gateNames = [
    "REGISTRATION_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_PUBLIC_CUSTOMERS",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_MULTI_SPORT_SANDBOX",
    "DOCKED_PUBLIC_PHONE_OTP",
    "DOCKED_ISOLATED_PHONE_TEST",
  ];
  for (const key of gateNames) assert.equal(runtime[key], "false");
  const credentialNames = [
    "DOCKED_COMMERCIAL_DATABASE_URL",
    "DOCKED_COMMERCIAL_REFERENCE_KEY",
    "DOCKED_COMMERCIAL_REFERENCE_KEYS",
    "DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET",
    "DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL",
    "DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY",
    "DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET",
  ];
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const database = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled,policy_version from commercial_billing.control where id`;
        for (const key of [
          "sales_enabled",
          "issuance_enabled",
          "transfers_enabled",
          "gameplay_enabled",
        ])
          assert.equal(control[key], false);
        const [counts] =
          await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.definitions where approved) approved,(select sum(legacy_issued)::int from commercial_billing.definitions) lifetime_consumed,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from credits_sandbox.store_notifications where state='attention') warnings`;
        assert.equal(counts.definitions, 6540);
        assert.equal(counts.approved, 0);
        assert.equal(counts.lifetime_consumed, 888);
        assert.equal(counts.cards, 0);
        assert.equal(counts.receipts, 0);
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        assert.equal(custody.length, 906);
        assert.equal(
          digest(custody),
          "a1bbdf806cee3f51d870b31f5fcb74d6cae0df93846f34bb4c291ffaae99cb8e",
        );
        const roles =
          await tx`select r.rolname name,r.rolcanlogin can_login,r.rolsuper superuser,r.rolbypassrls bypass_rls,r.rolcreaterole create_role from pg_roles r where r.rolname in ('docked_app','docked_commercial_app') or exists(select 1 from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid and p.rolname='docked_commercial_app') order by r.rolname`;
        const flags =
          await tx`select key,enabled from private.feature_flags order by key`;
        const [policies] =
          await tx`select (select count(*)::int from private.region_policies where country='AU' and approved and not preview_community_only and minimum_age=18 and effective_from<=clock_timestamp() and effective_to>clock_timestamp() and review_at>clock_timestamp()) current_approved_au_regions,(select enabled from operations.retention_policy) incident_deletion_enabled`;
        const schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        return {
          control,
          counts,
          custodyRecords: 906,
          custodyDigest: digest(custody),
          roles,
          flags,
          policies,
          schema,
        };
      },
    );
    const requests = await Promise.all(
      [
        ["/api/beta-release", 200],
        ["/app/signup", 200],
        ["/api/store/google/commercial", 403],
        ["/api/workspace-wallet", 403],
        ["/api/admin/incidents", 403],
        ["/profile/qa_billing", 503],
        ["/api/public-gameplay?sport=basketball", 403],
      ].map(async ([route, status]) => {
        const r = await fetch("https://docked.com.au" + route, {
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        assert.equal(r.status, status, String(route));
        await r.arrayBuffer();
        return { route, status: r.status };
      }),
    );
    const report = {
      at: new Date().toISOString(),
      productionWrites: 0,
      sourceCommit: sha,
      runtimeEvidence:
        "Exact previously supplied deployment recipe; immutable deployment independently rechecked with Vercel. This is not independent secret-value readback.",
      runtimeKeys: Object.keys(runtime).length,
      runtimeRecipeSha256: createHash("sha256")
        .update(JSON.stringify(runtime))
        .digest("hex"),
      closedRuntimeFlags: Object.fromEntries(
        gateNames.map((key) => [key, false]),
      ),
      commercialCredentialPresence: Object.fromEntries(
        credentialNames.map((key) => [key, !!runtime[key]]),
      ),
      database,
      http: requests,
    };
    writeFileSync(
      "docs/qa/v31-revenue-launch-20261113/production-live-readiness-final.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e: { code?: string }) => {
  console.error(
    "Read-only readiness incomplete; no Production changes. Code: " +
      (/^[A-Z0-9_]{3,32}$/.test(e.code ?? "") ? e.code : "redacted"),
  );
  process.exitCode = 1;
});
