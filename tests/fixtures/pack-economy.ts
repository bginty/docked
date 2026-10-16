import {
  initialCardEconomy,
  sevenPlayerPackUpgrade,
  premiumUltraPackUpgrade,
} from "../../src/core/card-economy";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import { executeCredits } from "../../src/core/credits-sandbox";
export const packMember = { id: "pack-local-qa", role: "member" } as const;
export const packNow = 1792100000000;
/** In-memory only. Never connects to a database or changes member assets. */
export function packFixture() {
  let state = initialMemberTestCredits();
  state.economy = initialCardEconomy(
    Array.from({ length: 24 }, (_, i) => ({
      id: `local-${i}`,
      provider: "synthetic",
      providerId: String(i),
      name: i === 0 ? "Alex Northbridge-Wellington" : `Local Player ${i + 1}`,
      sport: "nfl",
      assetKind: "player",
      position: ["QB", "RB", "WR", "TE"][i % 4],
      currentTeam: ["PIT", "BUF", "BAL", "GB"][i % 4],
      status: "active",
      observedAt: packNow,
      sourceRevision: "local",
      presentation: "docked",
    })),
    packNow,
  );
  sevenPlayerPackUpgrade(state.economy, packNow);
  premiumUltraPackUpgrade(state.economy, packNow);
  state = executeCredits(
    state,
    { id: "local-operator", role: "reviewer", aal: "aal2" },
    "local-funding",
    {
      kind: "promotion",
      member: packMember.id,
      amount: 25000,
      campaign: "isolated-browser",
      reason: "Local pack UI verification",
      confirmed: true,
      redeemable: false,
    },
    packNow,
  ).state;
  return state;
}
