import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import {
  initialCardEconomy,
  sevenPlayerPackUpgrade,
} from "../../src/core/card-economy";
import { executeCredits } from "../../src/core/credits-sandbox";
export const marketActors = [1, 2, 3].map((n) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  role: "member" as const,
}));
export const marketLabels = marketActors.map((a, i) => ({
  id: a.id,
  label: ["Local Alice", "Local Bob", "Local Charlie"][i],
}));
/** Only imported by local tests/preview. Never an application data source. */
export function marketplaceFixture(now = Date.now(), actors = marketActors) {
  let s = initialMemberTestCredits();
  s.economy = initialCardEconomy(
    Array.from({ length: 28 }, (_, i) => ({
      id: `local-player-${i}`,
      provider: "fixture",
      providerId: `local-${i}`,
      name: `Local Player ${String(i).padStart(2, "0")}`,
      sport: "nfl",
      assetKind: "player",
      position: ["QB", "RB", "WR", "TE", "K", "DST", "WR"][i % 7],
      currentTeam: i % 2 ? "TEST A" : "TEST B",
      status: "active",
      observedAt: now,
      sourceRevision: "local-synthetic",
      presentation: "docked-shirt-v1",
    })),
    now,
  );
  sevenPlayerPackUpgrade(s.economy, now);
  for (const a of actors) {
    s = executeCredits(
      s,
      { id: "local-operator", role: "reviewer", aal: "aal2" },
      `fund-${a.id}`,
      {
        kind: "promotion",
        member: a.id,
        amount: 10000,
        campaign: "local-fixture",
        reason: "Isolated LOCAL marketplace verification",
        confirmed: true,
        redeemable: false,
      },
      now,
    ).state;
    s = executeCredits(
      s,
      a,
      `pack-${a.id}`,
      {
        kind: "buy-pack",
        product: "standard-nine-seven-test-v2",
        configuration: "standard-nine-seven-test-v2",
        policy: s.policy.version,
        confirmed: true,
      },
      now,
    ).state;
    s = executeCredits(
      s,
      a,
      `open-${a.id}`,
      { kind: "open-pack", entitlement: `pack-${a.id}` },
      now,
    ).state;
  }
  return s;
}
