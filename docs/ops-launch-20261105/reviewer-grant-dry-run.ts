/** Read-only Production snapshot + pure in-memory grant rehearsal. No grant,
 * active MFA/session assertion, SQL mutation or generated inventory is persisted. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "../../scripts/owner-gameplay-db.mjs";
import {
  executeCredits,
  wallet,
  type CreditsState,
} from "../../src/core/credits-sandbox";
import { assertMemberTestEconomy } from "../../src/core/member-test-wallet";
import { packAvailability } from "../../src/core/pack-availability";
const output = resolve("docs/ops-launch-20261105/reviewer-grant-dry-run.json");
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
const member = "eea25d64-9f12-4d8b-be8b-a8d8818ce0ff";
const reference = "owner-authorised-play-reviewer-test-30000-20261106-v1";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function main() {
  try {
    const data = await sql.begin(
      "read only isolation level repeatable read",
      async (tx) => {
        const [u] =
          await tx`select u.id,u.email_confirmed_at is not null confirmed,a.status,a.administrator,p.disabled_at,x.enabled wallet_enabled,x.kind,b.enabled sports_enabled,b.expires_at from auth.users u join beta_private.admissions a on a.user_id=u.id join beta_public.profiles p on p.id=u.id join credits_sandbox.access x on x.user_id=u.id join sports_feed.nba_beta_access b on b.user_id=u.id where u.id=${member} and lower(u.email)='briantginty21@gmail.com'`;
        assert(
          u?.confirmed &&
            u.status === "accepted" &&
            !u.administrator &&
            !u.disabled_at &&
            u.wallet_enabled &&
            u.kind === "tester" &&
            u.sports_enabled &&
            Date.parse(u.expires_at) > Date.now(),
        );
        const [roles] =
          await tx`select count(*)::int n from beta_private.roles where user_id=${member}`;
        assert.equal(roles.n, 0);
        const [row] =
          await tx`select document from credits_sandbox.state where id`;
        const original = row.document as CreditsState;
        assertMemberTestEconomy(original);
        assert.equal(original.mode, "financial-sandbox-only");
        assert.equal(original.commerce.mode, "synthetic-only");
        assert.equal(original.economy?.id, "invited-nfl-test-v2");
        assert.equal(
          Object.values(original.cases).filter(
            (c) => c.member === member && c.status === "OPEN",
          ).length,
          0,
        );
        assert.equal(wallet(original, member).heldAvailable, 0);
        assert(!original.journal.some((j) => j.id === `${reference}_issue`));
        const products = Object.values(original.economy!.products).filter(
          (p) =>
            ["nfl", "afl", "nrl"].includes(p.sport) &&
            (!original.economy?.activeProductVersions ||
              original.economy.activeProductVersions.includes(p.id)),
        );
        assert.equal(products.length, 18);
        assert(
          products.every(
            (p) => packAvailability(original.economy!, p, Date.now()).available,
          ),
        );
        const total = products.reduce((sum, p) => sum + p.priceCredits, 0);
        assert.equal(total, 26100);
        const peers = [
          ...new Set(Object.values(original.lots).map((lot) => lot.member)),
        ]
          .filter((id) => id !== member)
          .sort();
        const peerWallets = (s: CreditsState) =>
          peers.map((id) => [id, wallet(s, id)]);
        const protectedData = (s: CreditsState) => ({
          cards: s.cards,
          commerce: s.commerce,
          economy: s.economy,
          entitlements: s.entitlements,
          listings: s.listings,
          swaps: s.swaps,
          cases: s.cases,
          deposits: s.deposits,
          withdrawals: s.withdrawals,
          prizes: s.prizes,
        });
        // A fixture context only for this pure function: no JWT, request, cookie,
        // actual owner identity or MFA session is created or submitted anywhere.
        const fictionalActor = {
          id: "local-grant-rehearsal-only",
          role: "reviewer",
          aal: "aal2",
        } as const;
        const command = {
          kind: "promotion",
          member,
          amount: 30000,
          campaign: "play-reviewer-free-access-20261106-v1",
          reason:
            "Proposed owner-authorised 30,000 non-cash TEST credits for nominated Play reviewer; no cash value, withdrawals, conversion or commercial funds",
          confirmed: true,
          redeemable: false,
        };
        const beforeHash = hash(original);
        const once = executeCredits(
          original,
          fictionalActor,
          reference,
          command,
          Date.now(),
        );
        const twice = executeCredits(
          once.state,
          fictionalActor,
          reference,
          command,
          Date.now(),
        );
        assert.equal(hash(original), beforeHash);
        assert.deepEqual(twice, once);
        assert.equal(
          once.state.journal.filter((j) => j.id === `${reference}_issue`)
            .length,
          1,
        );
        assert.equal(once.state.journal.length, original.journal.length + 1);
        assert.equal(
          Object.keys(once.state.lots).length,
          Object.keys(original.lots).length + 1,
        );
        assert.equal(
          wallet(once.state, member).spendable -
            wallet(original, member).spendable,
          30000,
        );
        assert.equal(wallet(once.state, member).withdrawable, 0);
        assert.equal(
          hash(peerWallets(original)),
          hash(peerWallets(once.state)),
        );
        assert.equal(
          hash(protectedData(original)),
          hash(protectedData(once.state)),
        );
        assert.throws(
          () =>
            executeCredits(
              once.state,
              fictionalActor,
              reference,
              { ...command, amount: 30001 },
              Date.now(),
            ),
          /Idempotency conflict/,
        );
        assert.throws(
          () =>
            executeCredits(
              original,
              { id: member, role: "member" },
              reference,
              command,
              Date.now(),
            ),
          /Owner MFA required/,
        );
        assertMemberTestEconomy(once.state);
        return {
          at: new Date().toISOString(),
          recipient: member,
          reference,
          proposedAmount: 30000,
          paidVariants: products.length,
          allVariantsOnceCredits: total,
          remainingAfterAllVariants: 30000 - total,
          envelope:
            "financial-sandbox-only / synthetic-only / invited-nfl-test-v2",
          reviewerConfirmedNonAdmin: true,
          reviewerUnheld: true,
          grantApplied: false,
          pureInMemoryRehearsal: true,
          fictionalActorOnly: true,
          activeMfaOrJwtCreated: false,
          sqlTransaction: "read only repeatable read",
          singleJournalAndLot: true,
          identicalReplayIdempotent: true,
          changedAmountRejected: true,
          memberCannotGrant: true,
          peerWalletFingerprintBefore: hash(peerWallets(original)),
          peerWalletFingerprintAfter: hash(peerWallets(once.state)),
          protectedInventoryFingerprintBefore: hash(protectedData(original)),
          protectedInventoryFingerprintAfter: hash(protectedData(once.state)),
          originalUnchanged: true,
          persistedFinancialChanges: 0,
          permanentCardsIssued: 0,
        };
      },
    );
    writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify(data));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Reviewer grant rehearsal failed; no mutation was attempted",
  );
  process.exitCode = 1;
});
