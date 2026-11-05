/** Exact owner-nominated account; metadata/counts only, read-only transaction.
 * Does not claim, allocate, open packs, set claims or change access/security. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "../../scripts/owner-gameplay-db.mjs";
import { wallet, type CreditsState } from "../../src/core/credits-sandbox";
import { packAvailability } from "../../src/core/pack-availability";
const output = resolve(
  "docs/ops-launch-20261105/reviewer-inventory-readback.json",
);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
async function main() {
  try {
    const data = await sql.begin(
      "read only isolation level repeatable read",
      async (tx) => {
        const users =
          await tx`select id,email_confirmed_at is not null confirmed,deleted_at is not null deleted from auth.users where lower(email)='briantginty21@gmail.com'`;
        assert.equal(
          users.length,
          1,
          "Exact nominated reviewer account required",
        );
        const user = users[0];
        const [state] =
          await tx`select document from credits_sandbox.state where id`;
        assert(state);
        const s = state.document as CreditsState;
        const packs = Object.values(s.economy?.packs ?? {}).filter(
          (p) => p.member === user.id,
        );
        const owned = Object.entries(s.commerce.cards).filter(
          ([, c]) => c.owner === user.id,
        );
        const weekly =
          await tx`select sport,count(*)::int total,count(*) filter(where opened_at is null)::int unopened,count(*) filter(where opened_at is not null)::int opened from sports_feed.weekly_core_packs where user_id=${user.id} group by sport order by sport`;
        const schedules =
          await tx`select sport,enrolled_at,next_period from sports_feed.weekly_core_schedules where user_id=${user.id} order by sport`;
        const [legacy] =
          await tx`select (select count(*)::int from beta_fantasy.cards where owner_id=${user.id}) owned_cards,(select count(*)::int from beta_fantasy.packs where user_id=${user.id} and opened_at is null) unopened_packs,(select count(*)::int from beta_fantasy.packs where user_id=${user.id} and opened_at is not null) opened_packs,(select count(*)::int from beta_fantasy.starter_claims where user_id=${user.id}) starter_claims`;
        const [commercial] =
          await tx`select (select count(*)::int from commercial_billing.accounts where member_id=${user.id}) accounts,(select count(*)::int from commercial_billing.receipts where member_id=${user.id}) receipts,(select count(*)::int from commercial_billing.cards where owner_id=${user.id}) cards,(select count(*)::int from commercial_billing.packs where member_id=${user.id}) packs`;
        const admission =
          await tx`select a.status,a.administrator,x.kind wallet_kind,x.enabled wallet_enabled,b.enabled sports_enabled,b.expires_at from beta_private.admissions a left join credits_sandbox.access x on x.user_id=a.user_id left join sports_feed.nba_beta_access b on b.user_id=a.user_id where a.user_id=${user.id}`;
        return {
          at: new Date().toISOString(),
          project: "pojoymtniryarxxunyvz",
          exactNominatedReviewer: true,
          recipientId: user.id,
          confirmed: user.confirmed,
          deleted: user.deleted,
          testWallet: wallet(s, user.id),
          aggregateOwnedCards: owned.length,
          aggregateOwnedBySport: Object.fromEntries(
            ["nfl", "afl", "nrl", "basketball"].map((sport) => [
              sport,
              owned.filter(([, c]) => c.sport === sport).length,
            ]),
          ),
          aggregatePacks: packs.map((p) => ({
            sport: p.product.sport,
            family: p.product.type,
            quantity: p.product.cards,
            opened: !!p.openedAt,
          })),
          aggregateEntitlements: Object.values(s.entitlements)
            .filter((e) => e.member === user.id)
            .map((e) => ({ state: e.status, restricted: e.restricted })),
          weeklyCore: weekly,
          weeklyCoreSchedules: schedules,
          legacyInventory: legacy,
          commercialInventory: commercial,
          admission,
          storedProductAvailability: Object.values(s.economy?.products ?? {})
            .filter(
              (p) =>
                ["nfl", "afl", "nrl"].includes(p.sport) &&
                (!s.economy?.activeProductVersions ||
                  s.economy.activeProductVersions.includes(p.id)),
            )
            .map((p) => ({
              id: p.id,
              sport: p.sport,
              family: p.type,
              cards: p.cards,
              price: p.priceCredits,
              ...packAvailability(s.economy!, p, Date.now()),
            })),
          availabilityScope:
            "Stored aggregate before the member API's normal read-only roster refresh; not signed-in rendered acceptance",
          readOnly: true,
          financialOrInventoryMutations: 0,
          credentialsRead: false,
        };
      },
    );
    writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify(data));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
main().catch(() => {
  console.error(
    "Read-only reviewer inventory check failed; no mutation was attempted.",
  );
  process.exitCode = 1;
});
