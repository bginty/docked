/** Exact separately owner-approved non-cash TEST grant. Reuses the existing
 * trusted operator/store promotion path. No HTTP, login, MFA/JWT, payment,
 * permanent card, pack opening, competition award or permission is created. */
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Sql } from "postgres";
import { ownerDatabase } from "../../scripts/owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../../src/server/credits-sandbox-store";
import { assertMemberTestEconomy } from "../../src/core/member-test-wallet";
import {
  executeCredits,
  wallet,
  type CreditsState,
} from "../../src/core/credits-sandbox";
import { packAvailability } from "../../src/core/pack-availability";

assert.equal(process.argv[2], "--apply-exact-owner-approved-grant");
const root = process.cwd();
const output = resolve("docs/ops-launch-20261105/reviewer-grant-applied.json");
const privateDir = resolve("private-data/reviewer-test-grant-20261106");
mkdirSync(privateDir, { recursive: true });
const member = "eea25d64-9f12-4d8b-be8b-a8d8818ce0ff";
const reference = "owner-authorised-play-reviewer-test-30000-20261106-v1";
const command = {
  kind: "promotion",
  member,
  amount: 30000,
  campaign: "play-reviewer-free-access-20261106-v1",
  reason:
    "Owner-authorised one-time 30,000 non-cash TEST Docked Credits for nominated Google Play reviewer NFL/AFL/NRL pack access; no cash value, withdrawals, conversion, real funds or permanent issuance",
  confirmed: true,
  redeemable: false,
};
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const protectedState = (s: CreditsState) => ({
  policy: s.policy,
  commerce: s.commerce,
  economy: s.economy,
  cards: s.cards,
  entitlements: s.entitlements,
  listings: s.listings,
  swaps: s.swaps,
  cases: s.cases,
  deposits: s.deposits,
  withdrawals: s.withdrawals,
  prizes: s.prizes,
  storeTestDeposits: s.storeTestDeposits,
});
const peerWallets = (s: CreditsState) =>
  [...new Set(Object.values(s.lots).map((l) => l.member))]
    .filter((id) => id !== member)
    .sort()
    .map((id) => [id, wallet(s, id)]);
const protectedTables = [
  "beta_fantasy.cards",
  "beta_fantasy.editions",
  "beta_fantasy.packs",
  "beta_fantasy.entries",
  "beta_fantasy.results",
  "beta_fantasy.competitions",
  "sports_feed.weekly_core_packs",
  "sports_feed.weekly_core_schedules",
  "credits_sandbox.card_instances",
  "credits_sandbox.pack_receipts",
  "credits_sandbox.nba_fixture_instances",
  "commercial_billing.accounts",
  "commercial_billing.receipts",
  "commercial_billing.lots",
  "commercial_billing.journals",
  "commercial_billing.packs",
  "commercial_billing.cards",
  "commercial_billing.recovery_cases",
];
async function fingerprint(sql: Sql) {
  const values: Record<string, unknown> = {};
  for (const table of protectedTables) {
    assert(/^[a-z_]+\.[a-z_]+$/.test(table));
    const [r] = await sql.unsafe(
      `select count(*)::int count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
    );
    values[table] = r;
  }
  return values;
}
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
let mutationCommitted = false;
async function main() {
  try {
    const owners =
      await sql`select u.id from auth.users u join beta_private.roles r on r.user_id=u.id join beta_private.admissions a on a.user_id=u.id join beta_public.profiles p on p.id=u.id where lower(u.email)='support@docked.com.au' and r.role='owner' and a.status='accepted' and p.disabled_at is null and u.email_confirmed_at is not null`;
    assert.equal(owners.length, 1, "Existing approved owner identity required");
    // This is the existing offline owner-authorised operator domain adapter,
    // as used for the Barry grant. No active credential challenge is asserted:
    // these domain fields are never sent to Auth, HTTP, cookies or JWT claims.
    const actor = {
      id: String(owners[0].id),
      role: "reviewer",
      aal: "aal2",
    } as const;
    let before: CreditsState | undefined;
    let tableBefore: Record<string, unknown> | undefined;
    let backupEvidence: Record<string, unknown> | undefined;
    const store = new CreditsSandboxStore(
      sql,
      async (tx, state) => {
        assertMemberTestEconomy(state);
        assert.equal(state.mode, "financial-sandbox-only");
        assert.equal(state.commerce.mode, "synthetic-only");
        assert.equal(state.economy?.id, "invited-nfl-test-v2");
        const [r] =
          await tx`select u.email_confirmed_at is not null confirmed,a.status,a.administrator,p.disabled_at,x.kind,x.enabled wallet_enabled,b.enabled sport_enabled,b.expires_at,(select count(*)::int from beta_private.roles where user_id=u.id) roles from auth.users u join beta_private.admissions a on a.user_id=u.id join beta_public.profiles p on p.id=u.id join credits_sandbox.access x on x.user_id=u.id join sports_feed.nba_beta_access b on b.user_id=u.id where u.id=${member} and lower(u.email)='briantginty21@gmail.com'`;
        assert(
          r?.confirmed &&
            r.status === "accepted" &&
            !r.administrator &&
            !r.disabled_at &&
            r.roles === 0 &&
            r.kind === "tester" &&
            r.wallet_enabled &&
            r.sport_enabled &&
            Date.parse(r.expires_at) > Date.now(),
        );
        assert.equal(wallet(state, member).heldAvailable, 0);
        assert.equal(
          Object.values(state.cases).filter(
            (c) => c.member === member && c.status === "OPEN",
          ).length,
          0,
        );
        const products = Object.values(state.economy!.products).filter(
          (p) =>
            ["nfl", "afl", "nrl"].includes(p.sport) &&
            (!state.economy?.activeProductVersions ||
              state.economy.activeProductVersions.includes(p.id)),
        );
        assert.equal(products.length, 18);
        assert(
          products.every(
            (p) => packAvailability(state.economy!, p, Date.now()).available,
          ),
        );
        if (!before) {
          assert(
            !state.journal.some((j) => j.id === `${reference}_issue`),
            "Grant reference already exists; inspect readback, never regrant",
          );
          assert.equal(
            wallet(state, member).total,
            0,
            "Reviewer balance changed; review required",
          );
          before = structuredClone(state);
          tableBefore = await fingerprint(tx);
          const hypothetical = executeCredits(
            state,
            actor,
            reference,
            command,
            Date.now(),
          ).state;
          assert.equal(
            hash(protectedState(hypothetical)),
            hash(protectedState(state)),
          );
          assert.equal(
            hash(peerWallets(hypothetical)),
            hash(peerWallets(state)),
          );
          const key = Buffer.from(
            readFileSync(
              resolve(
                process.env.USERPROFILE!,
                ".docked-secrets/launch-migration-backup-key.hex",
              ),
              "utf8",
            ).trim(),
            "hex",
          );
          assert.equal(key.length, 32);
          try {
            const iv = randomBytes(12),
              cipher = createCipheriv("aes-256-gcm", key, iv);
            cipher.setAAD(Buffer.from(reference));
            const plain = Buffer.from(
              JSON.stringify({
                at: new Date().toISOString(),
                reference,
                member,
                command,
                state,
                protectedTables: tableBefore,
              }),
            );
            const encrypted = Buffer.concat([
              cipher.update(plain),
              cipher.final(),
            ]);
            const bytes = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
            const filename = `grant-before-${Date.now()}.aes`;
            writeFileSync(resolve(privateDir, filename), bytes, {
              flag: "wx",
              mode: 0o600,
            });
            backupEvidence = {
              at: new Date().toISOString(),
              file: filename,
              bytes: bytes.length,
              cipherSha256: createHash("sha256").update(bytes).digest("hex"),
              encryption: "AES-256-GCM",
              authenticatedContext: reference,
              plaintextWritten: false,
            };
            plain.fill(0);
          } finally {
            key.fill(0);
          }
        }
      },
      undefined,
      async (tx, previous, current) => {
        assert.equal(
          hash(protectedState(previous)),
          hash(protectedState(current)),
        );
        assert.equal(hash(peerWallets(previous)), hash(peerWallets(current)));
        assert.deepEqual(
          await fingerprint(tx),
          tableBefore,
          "Protected SQL data changed; roll back grant",
        );
      },
    );
    const first = await store.execute(actor, reference, command);
    mutationCommitted = true;
    const second = await store.execute(actor, reference, command);
    assert.deepEqual(second, first);
    const after = await store.read();
    assert(before && tableBefore && backupEvidence);
    assertMemberTestEconomy(after);
    assert.equal(after.journal.length, before.journal.length + 1);
    assert.equal(
      after.journal.filter((j) => j.id === `${reference}_issue`).length,
      1,
    );
    assert.equal(
      Object.keys(after.lots).length,
      Object.keys(before.lots).length + 1,
    );
    assert.equal(wallet(after, member).spendable, 30000);
    assert.equal(wallet(after, member).withdrawable, 0);
    assert.equal(hash(peerWallets(before)), hash(peerWallets(after)));
    assert.equal(hash(protectedState(before)), hash(protectedState(after)));
    assert.deepEqual(await fingerprint(sql), tableBefore);
    assert.throws(
      () =>
        executeCredits(
          after,
          actor,
          reference,
          { ...command, amount: 30001 },
          Date.now(),
        ),
      /Idempotency conflict/,
    );
    const weekly =
      await sql`select sport,count(*)::int total,count(*) filter(where opened_at is null)::int unopened from sports_feed.weekly_core_packs where user_id=${member} group by sport order by sport`;
    assert.equal(weekly.length, 3);
    assert(weekly.every((p) => p.total === 1 && p.unopened === 1));
    const result = {
      at: new Date().toISOString(),
      project: "pojoymtniryarxxunyvz",
      recipient: member,
      reference,
      amount: 30000,
      command,
      authorisation:
        "Specific owner approval in chat; out-of-band database operator following existing TEST promotion procedure",
      activeLoginOrMfaSessionCreated: false,
      jwtClaimsCreated: false,
      grantApplied: true,
      before: wallet(before, member),
      after: wallet(after, member),
      oneJournal: true,
      oneLot: true,
      identicalRetryNoExtraGrant: true,
      changedBodyRejectedInMemoryOnly: true,
      peerWalletFingerprintBefore: hash(peerWallets(before)),
      peerWalletFingerprintAfter: hash(peerWallets(after)),
      protectedInventoryFingerprintBefore: hash(protectedState(before)),
      protectedInventoryFingerprintAfter: hash(protectedState(after)),
      protectedTablesUnchanged: tableBefore,
      weeklyCorePreserved: weekly,
      backup: backupEvidence,
      commercialFundsChanged: false,
      commercialProductsActivated: false,
      permanentInventoryIssued: 0,
      reviewerPackPurchases: 0,
      reviewerPacksOpened: 0,
      signedInUiAcceptance: false,
    };
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
main().catch((error) => {
  writeFileSync(
    resolve(privateDir, "last-failure.private.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        mutationCommitted,
        message: error instanceof Error ? error.message : "unknown",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.error(
    JSON.stringify({
      error:
        "Scoped reviewer grant did not complete all checks; inspect private diagnostic before retry",
      mutationCommitted,
    }),
  );
  process.exitCode = 1;
});
