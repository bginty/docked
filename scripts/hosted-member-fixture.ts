/** Explicitly isolated, synthetic catalogue. Never seeds customer inventory. */
import { storePackFixture } from "../tests/fixtures/store-pack-lifecycle";
import { validateCredits } from "../src/core/credits-sandbox";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet";

export function hostedMemberFixture(now = Date.now()) {
  const state = storePackFixture("nfl");
  const economy = state.economy!;
  for (const sport of ["afl", "nrl"] as const) {
    const extra = storePackFixture(sport).economy!;
    Object.assign(economy.players, extra.players);
    for (const id of extra.activeProductVersions!) {
      economy.products[id] = extra.products[id];
      economy.activeProductVersions!.push(id);
    }
    economy.fixtureTestAllocation = {
      ...economy.fixtureTestAllocation,
      ...extra.fixtureTestAllocation,
    };
  }
  for (const player of Object.values(economy.players)) {
    player.name = `Synthetic ${player.sport.toUpperCase()} Player ${player.providerId}`;
    player.observedAt = now;
    // NFL's engine uses the synthetic provider marker. Non-NFL additionally
    // requires its existing fixture allocation gate, retained above.
    player.sourceRevision = "isolated-hosted-member-20261101";
  }
  assertMemberTestEconomy(state);
  validateCredits(state);
  return state;
}
