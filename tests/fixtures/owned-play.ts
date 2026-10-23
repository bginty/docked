import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import type { multiSportDatabase } from "./multi-sport-db";

/** Explicit owned grants in disposable PGlite only. Catalogue fixtures alone confer no ownership. */
export async function grantOwnedPlayFixtures(
  db: Awaited<ReturnType<typeof multiSportDatabase>>,
  cards = Object.values(db.inventories).flat(),
) {
  const state: any = initialMemberTestCredits();
  for (const card of cards) {
    state.commerce.cards[card.id] = {
      owner: card.owner_id,
      tier: card.tier,
      sport: card.sport,
      reserved: null,
    };
    state.cards[card.id] = {
      version: 0,
      restricted: false,
      locked: false,
      history: [
        {
          from: null,
          to: card.owner_id,
          reference: "isolated-owned-grant",
          at: 10000,
        },
      ],
    };
  }
  await db.q("insert into credits_sandbox.state values(true,0,$1)", [state]);
  return state;
}
