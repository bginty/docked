import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  wallet,
  validateCredits,
  validateStoreTestProvenance,
} from "../src/core/credits-sandbox";
import { namedTesterId, namedTesterEmailDigest } from "./lib/named-tester-plan";
const base = "private-data/clean-transition-20261117/",
  docs = "docs/qa/clean-transition-20261117/";
const audit = JSON.parse(readFileSync(base + "audit.private.json", "utf8"));
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
async function main() {
  try {
    const evidence = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const roster =
          await tx`select to_jsonb(r) value from beta_private.friends_roster r`;
        const admissions =
          await tx`select to_jsonb(r)-'token_digest' value from beta_private.admissions r`;
        const invitations =
          await tx`select to_jsonb(r)-'token_digest' value from beta_private.customer_invitations r`;
        const exceptions =
          await tx`select to_jsonb(r) value from beta_private.named_tester_exception r`;
        const social =
          await tx`select p.user_id,p.handle,p.display_name,p.is_official,p.status,p.visibility,(select count(*) from beta_private.social_posts where author_id=p.id) posts,(select count(*) from beta_private.social_follows where target_id=p.id) followers from beta_private.social_profiles p`;
        const scopeTables = audit.tables.filter(
          (t: any) =>
            [
              "beta_fantasy",
              "sports_feed",
              "commercial_billing",
              "credits_sandbox",
            ].includes(t.table_schema) &&
            t.columns.some((c: string) =>
              ["user_id", "member_id", "owner_id"].includes(c),
            ),
        );
        const refs = [];
        for (const t of scopeTables) {
          for (const col of t.columns.filter((c: string) =>
            ["user_id", "member_id", "owner_id"].includes(c),
          )) {
            const values =
              await tx`select ${tx(col)}::text member,count(*)::int count from ${tx(t.table_schema)}.${tx(t.table_name)} where ${tx(col)}::text in ${tx(audit.accounts.map((a: any) => a.id))} group by 1`;
            refs.push({
              table: t.table_schema + "." + t.table_name,
              column: col,
              values,
            });
          }
        }
        const claims =
          await tx`select count(*)::int count from private.verified_phone_claims`;
        const [state] =
          await tx`select document from credits_sandbox.state where id`;
        const storage =
          await tx`select owner_id,count(*)::int count from storage.objects group by owner_id`;
        const [tables] =
          await tx`select count(*)::int count from private.roles`;
        return {
          roster,
          admissions,
          invitations,
          exceptions,
          social,
          refs,
          claims,
          state: state.document,
          storage,
          publicRoles: tables.count,
        };
      },
    );
    validateCredits(evidence.state);
    validateStoreTestProvenance(evidence.state);
    const plan = audit.accounts.map((a: any) => {
      const admission = evidence.admissions
        .map((r) => r.value)
        .filter(
          (r) =>
            r.user_id === a.id &&
            r.email.toLowerCase() === a.email.toLowerCase(),
        );
      const roster = evidence.roster
        .map((r) => r.value)
        .find(
          (r) =>
            r.user_id === a.id &&
            r.email.toLowerCase() === a.email.toLowerCase(),
        );
      const invite = evidence.invitations
        .map((r) => r.value)
        .filter(
          (r) =>
            r.intended_user === a.id &&
            r.email.toLowerCase() === a.email.toLowerCase(),
        );
      const exception = evidence.exceptions
        .map((r) => r.value)
        .find(
          (r) =>
            r.user_id === a.id &&
            r.email_digest === hash(a.email.toLowerCase()),
        );
      const social = evidence.social.find((r) => r.user_id === a.id);
      let label = "Other invited customer",
        kind = "customer";
      const identityEvidence: string[] = [];
      if (a.id === "623d1e69-d0f3-493f-9713-108e8c21469a") {
        assert.equal(a.email, "support@docked.com.au");
        assert(a.beta_roles.some((r: any) => r.role === "owner"));
        label = "Founder";
        kind = "owner";
        identityEvidence.push(
          "Existing owner role + exact verified operational email + historical owner admission",
        );
      } else if (a.id === "ef641248-67be-4c32-9b12-9205bfcee15b") {
        assert.equal(
          hash(a.email.toLowerCase()),
          "c1a55e654eb2cdccb34881d8e7b6d08f1d0eeeec387923971928de2a274768e3",
        );
        assert(roster && admission.length);
        label = "Barry";
        kind = "owner";
        identityEvidence.push(
          "Exact original verified email + invitation/roster + reviewed 17 October admin grant",
        );
      } else if (a.id === "9fa5cdbb-aa2e-4ebe-9f2c-de9885233cd3") {
        assert(roster && admission.length);
        label = "Luke";
        identityEvidence.push(
          "Historical reviewed Luke UUID + current verified Auth/accepted invitation email match",
        );
      } else if (a.id === namedTesterId) {
        assert.equal(hash(a.email.toLowerCase()), namedTesterEmailDigest);
        assert(exception);
        label = "Brenton";
        identityEvidence.push(
          "Reviewed named-tester UUID/email digest + accepted US exception",
        );
      } else if (a.email.endsWith("@example.invalid")) {
        const p =
          "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/customer-hosted-qa/identity.json";
        assert(
          existsSync(p),
          "Original internal QA identity evidence required",
        );
        const qa = JSON.parse(readFileSync(p, "utf8"));
        assert.equal(qa.id, a.id);
        assert.equal(qa.email, a.email);
        label = "Internal synthetic QA";
        kind = "system";
        identityEvidence.push(
          "Exact original internal QA fixture UUID/email; no customer classification",
        );
      } else {
        assert(
          a.email_confirmed_at && roster && admission.length,
          "Unclassified identity needs review",
        );
        identityEvidence.push(
          "Verified Auth email matches bound original roster and accepted admission",
        );
      }
      const s = evidence.state;
      const cards = Object.entries(s.commerce.cards)
        .filter(([, c]: any) => c.owner === a.id)
        .map(([id, c]) => ({
          id,
          custody: c,
          instance: s.economy?.instances[id] ?? null,
          history: s.cards[id] ?? null,
        }));
      const entitlements = Object.entries(s.entitlements)
        .filter(([, e]: any) => e.member === a.id)
        .map(([id, e]: any) => ({
          id,
          ...e,
          allocation: s.economy?.packs[id] ?? null,
        }));
      return {
        id: a.id,
        email: a.email,
        phone: a.phone,
        label,
        kind,
        identityEvidence,
        originalAuth: a,
        admission,
        roster,
        invite,
        exception,
        social,
        wallet: wallet(s, a.id),
        cards,
        entitlements,
        cases: Object.values(s.cases).filter((c: any) => c.member === a.id),
        consents: audit.consent
          .map((c: any) => c.value)
          .filter((c: any) => c.user_id === a.id),
        references: evidence.refs.flatMap((r) =>
          r.values
            .filter((v) => v.member === a.id)
            .map((v) => ({ table: r.table, column: r.column, count: v.count })),
        ),
      };
    });
    assert.equal(plan.filter((p: any) => p.kind === "owner").length, 2);
    const packet = {
      at: new Date().toISOString(),
      productionWrites: 0,
      accounts: plan,
      phoneClaims: evidence.claims,
      storage: evidence.storage,
      commercial: audit.commercial,
      ledgerChecks: {
        validated: true,
        testProvenanceValidated: true,
        liveEnabled: evidence.state.policy.liveEnabled,
        redeemableLots: Object.values(evidence.state.lots).filter(
          (l: any) => l.redeemable,
        ).length,
        withdrawals: Object.keys(evidence.state.withdrawals).length,
        unclassifiedDeposits: Object.keys(evidence.state.deposits).filter(
          (k) => !evidence.state.storeTestDeposits?.[k],
        ).length,
      },
    };
    writeFileSync(
      base + "plan.private.json",
      JSON.stringify(packet, null, 2) + "\n",
      { mode: 0o600 },
    );
    const redacted = plan.map((p: any) => ({
      ref: p.id.slice(0, 8) + "…",
      identitySha256: hash(p.id),
      label: p.label,
      kind: p.kind,
      identityEvidence: p.identityEvidence,
      roles: p.originalAuth.beta_roles?.map((r: any) => r.role) ?? [],
      mfaVerified: !!p.originalAuth.factors?.some(
        (r: any) => r.status === "verified",
      ),
      country: p.originalAuth.beta_profile.country,
      emailVerified: !!p.originalAuth.email_confirmed_at,
      phoneVerified: !!p.originalAuth.phone_confirmed_at,
      sessions: p.originalAuth.sessions.count,
      betaCredits: p.wallet.available,
      cards: p.cards.length,
      limitedCards: p.cards.filter(
        (c: any) => c.instance && c.instance.rarity !== "CORE",
      ).length,
      sealed: p.entitlements
        .filter((e: any) => e.status === "SEALED")
        .map((e: any) => ({ cards: e.allocation?.cards.length ?? null })),
      recoveryCases: p.cases.length,
      consentVersions: [
        ...new Set(
          p.consents
            .filter((c: any) => c.granted)
            .map((c: any) => c.purpose + ":" + c.version),
        ),
      ],
      references: p.references,
      posts: Number(p.social?.posts ?? 0),
      followers: Number(p.social?.followers ?? 0),
    }));
    writeFileSync(
      docs + "accounts-and-assets.json",
      JSON.stringify(
        {
          at: packet.at,
          planSha256: hash(readFileSync(base + "plan.private.json", "utf8")),
          accounts: redacted,
          ledgerChecks: packet.ledgerChecks,
          phoneClaims: evidence.claims,
          productionWrites: 0,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify(
        { accounts: redacted, ledgerChecks: packet.ledgerChecks },
        null,
        2,
      ),
    );
    const env = JSON.parse(
      readFileSync(
        "private-data/batch1-production-execution-20261116/captured-runtime-values.private.json",
        "utf8",
      ),
    );
    assert.equal(
      env.NEXT_PUBLIC_SUPABASE_URL,
      "https://pojoymtniryarxxunyvz.supabase.co",
    );
    const response = await fetch(
      env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/health",
      { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
    );
    if (response.ok) {
      const health = await response.json();
      writeFileSync(
        docs + "auth-version.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            status: response.status,
            version: health.version,
            name: health.name,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(JSON.stringify({ authVersion: health.version }));
    } else console.log(JSON.stringify({ authHealthStatus: response.status }));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  writeFileSync(base + "detail-error.private.txt", String(e.stack), {
    mode: 0o600,
  });
  console.error(
    "Private identity evidence or asset check failed; account retirement must stop.",
  );
  process.exitCode = 1;
});
