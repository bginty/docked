import { createHash } from "node:crypto";
import {
  prepareSportTestProducts,
  validateCardEconomy,
  type CardEconomy,
  type EconomyPlayer,
  type NinePackProduct,
} from "./card-economy";
import { fixtureSports, type FixtureSport } from "./fixture-sports";
import { isRosterBetaPlayer } from "./roster-beta";
import type { SandboxCard } from "./sport-sandbox";
export function rosterBetaUuid(key: string) {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** Operator plan only. Existing players, allocations and receipts cannot be rewritten. */
export function prepareRosterBetaCatalogue(
  original: CardEconomy,
  players: EconomyPlayer[],
  now: number,
) {
  const e = structuredClone(original);
  const products: NinePackProduct[] = [];
  for (const p of players) {
    if (!isRosterBetaPlayer(p)) throw Error("Unverified beta roster record");
    if (
      e.players[p.id] &&
      JSON.stringify(e.players[p.id]) !== JSON.stringify(p)
    )
      throw Error("Existing roster snapshot requires explicit reconciliation");
    e.players[p.id] ??= structuredClone(p);
  }
  e.activeProductVersions ??= Object.keys(original.products);
  for (const sport of Object.keys(fixtureSports) as FixtureSport[]) {
    if (sport === "basketball")
      e.nbaTestAllocation ??= { enabled: false, scope: "isolated-fixtures-v1" };
    else {
      e.fixtureTestAllocation ??= {};
      e.fixtureTestAllocation[sport] ??= {
        enabled: false,
        scope: "isolated-fixtures-v1",
      };
    }
    if (players.filter((p) => p.sport === sport).length < 9)
      throw Error("Incomplete beta sport pool");
    const staging = structuredClone(e);
    for (const base of prepareSportTestProducts(staging, sport, now)) {
      const id = base.id.replace("isolated-v1", "real-roster-beta-v1");
      const p: NinePackProduct = {
        ...base,
        id,
        version: id,
        name: base.name.replace("· Test", "· Real-player beta"),
        inventoryScope: "real-roster-beta-v1",
      };
      if (
        e.products[id] &&
        JSON.stringify(e.products[id]) !== JSON.stringify(p)
      )
        throw Error("Existing product version requires reconciliation");
      e.products[id] ??= p;
      products.push(e.products[id]);
    }
    e.activeProductVersions = e.activeProductVersions.filter(
      (id) => e.products[id].sport !== sport,
    );
    e.activeProductVersions.push(
      ...products.filter((p) => p.sport === sport).map((p) => p.id),
    );
  }
  validateCardEconomy(e);
  return { economy: e, products };
}
export function rosterBetaCoreCards(
  member: string,
  players: EconomyPlayer[],
): SandboxCard[] {
  return players.map((p) => {
    if (!isRosterBetaPlayer(p)) throw Error("Source-verified roster required");
    return {
      id: rosterBetaUuid(`docked:roster-beta-core:${member}:${p.id}`),
      player_id: p.fixturePlayerId!,
      canonical_player_id: p.fixturePlayerId!,
      owner_id: member,
      name: p.name,
      team: p.currentTeam,
      sport: p.sport,
      position: p.position,
      eligible_positions: p.eligiblePositions,
      status: "active",
      listed: false,
      tier: "CORE",
      serial: 0,
      max_supply: 0,
      multiplierTenths: 10,
      season: "REAL PLAYER · BETA INVENTORY",
      verifiedJerseyNumber: null,
      inventory_source: "roster-beta-core-v1",
      inventory_class: "real-roster-beta-v1",
      roster_source: p.rosterBeta,
    };
  });
}
