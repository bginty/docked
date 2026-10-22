import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import {
  initialCardEconomy,
  sevenPlayerPackUpgrade,
  prepareSportTestProducts,
} from "../../src/core/card-economy";
import {
  fixtureSports,
  type FixtureSport,
} from "../../src/core/fixture-sports";
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
export function marketplaceFixture(
  now = Date.now(),
  actors = marketActors,
  canonicalNfl = false,
  sport: "nfl" | FixtureSport = "nfl",
) {
  let s = initialMemberTestCredits();
  s.economy = initialCardEconomy(
    Array.from({ length: 28 }, (_, i) => ({
      id: canonicalNfl
        ? `90000000-0000-4000-8000-${String(i).padStart(12, "0")}`
        : `local-player-${i}`,
      provider: canonicalNfl ? "nflverse" : "fixture",
      providerId: canonicalNfl
        ? `99-${String(i).padStart(7, "0")}`
        : `local-${i}`,
      name: `Local Player ${String(i).padStart(2, "0")}`,
      sport: "nfl",
      assetKind: "player",
      position: ["QB", "RB", "WR", "TE", "K", "DST", "WR"][i % 7],
      currentTeam: canonicalNfl
        ? i % 2
          ? "NE"
          : "NYJ"
        : i % 2
          ? "TEST A"
          : "TEST B",
      status: "active",
      observedAt: now,
      sourceRevision: "local-synthetic",
      presentation: "docked-shirt-v1",
    })),
    now,
  );
  sevenPlayerPackUpgrade(s.economy, now);
  let product = "standard-nine-seven-test-v2";
  if (sport !== "nfl") {
    const definition = fixtureSports[sport];
    s.economy.players = Object.fromEntries(
      Object.values(s.economy.players).map((p, i) => {
        const id = `${definition.prefix}-fixture-${i}`;
        return [
          id,
          {
            ...p,
            id,
            provider: "fixture",
            providerId: id,
            synthetic: true,
            sport,
            name: `Synthetic ${definition.label} Player ${i + 1}`,
            position: definition.positions[i % definition.positions.length],
            currentTeam: "Synthetic City",
            presentation: `docked-${sport}-v1`,
          },
        ];
      }),
    );
    const products = prepareSportTestProducts(s.economy, sport, now);
    if (sport === "basketball") s.economy.nbaTestAllocation!.enabled = true;
    else s.economy.fixtureTestAllocation![sport]!.enabled = true;
    s.economy.activeProductVersions = products.map((p) => p.id);
    product = products.find((p) => p.type === "STANDARD")!.id;
  }
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
        product,
        configuration: product,
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
