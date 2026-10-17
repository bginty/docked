import { randomInt, randomUUID } from "node:crypto";
import { digest } from "./scoring-engine";
import {
  nflCardEligibility,
  type NflRosterEvidence,
} from "./nfl-card-eligibility";
import {
  limitedRarities,
  rarityConfiguration,
  rarityRule,
  type Rarity,
} from "./card-rarity";

export type EconomyPlayer = {
  id: string;
  sport: "nfl" | "afl";
  assetKind: "player" | "team-defence";
  provider: string;
  providerId: string;
  name: string;
  position: string;
  currentTeam: string;
  status: "active" | "inactive" | "retired" | "unknown";
  observedAt: number;
  sourceRevision: string;
  verifiedJerseyNumber?: number | null;
  presentation: string;
  roster?: NflRosterEvidence;
};
export type NinePackProduct = {
  id: string;
  version: string;
  type: "STANDARD" | "PREMIUM";
  name: string;
  priceCredits: number;
  cards: 9;
  sport: "nfl";
  positions: string[];
  eligibleStatuses?: EconomyPlayer["status"][];
  weights: Record<string, number>;
  guaranteedSlots: Record<string, Rarity>;
  duplicatePlayers: "allow" | "deny";
  status: "TEST_ONLY";
  effectiveAt: number;
  expiresAt: number | null;
  freshnessHours: number;
  exhaustion: "FAIL_ENTIRE_PACK";
};
export type EconomyInstance = {
  id: string;
  definition: string;
  playerId: string;
  rarity: Rarity;
  serial: number;
  lifetimeCap: number;
  mintedAt: number;
  source: string;
  presentation: string;
  printedTeam: string;
  rarityVersion: string;
};
export type EconomyPack = {
  id: string;
  member: string;
  product: NinePackProduct;
  configurationHash: string;
  cards: string[];
  createdAt: number;
  openedAt: number | null;
  draws: { rarity: Rarity; eligiblePlayers: number; poolHash: string }[];
};
export type CardEconomy = {
  rosterPolicy?: "official-nfl-roster-v1";
  activeProductVersions?: string[];
  id: "invited-nfl-test-v2";
  rarityVersion: string;
  enabled: boolean;
  players: Record<string, EconomyPlayer>;
  products: Record<string, NinePackProduct>;
  definitions: Record<
    string,
    { playerId: string; rarity: Rarity; issued: number }
  >;
  instances: Record<string, EconomyInstance>;
  /** Local test cleanup only: permanently consumed serials, never owned inventory. */
  retiredTestInstances?: Record<string, EconomyInstance>;
  packs: Record<string, EconomyPack>;
};
export const definitionId = (player: string, rarity: string) =>
  `${player}:${rarity}`;
export function drawPackRarity(
  p: NinePackProduct,
  slot: number,
  choose: (max: number) => number = randomInt,
): Rarity {
  const guaranteed = p.guaranteedSlots[String(slot)];
  if (guaranteed) return guaranteed;
  let draw = choose(10000);
  if (!Number.isInteger(draw) || draw < 0 || draw >= 10000)
    throw Error("Invalid secure draw");
  for (const r of limitedRarities) {
    draw -= p.weights[r];
    if (draw < 0) return r;
  }
  throw Error("Invalid rarity distribution");
}
export function initialCardEconomy(
  players: EconomyPlayer[],
  effectiveAt: number,
): CardEconomy {
  const products = (["STANDARD", "PREMIUM"] as const).map((type) => {
    const id = `${type.toLowerCase()}-nine-test-v1`;
    return [
      id,
      {
        id,
        version: id,
        type,
        name: `${type === "STANDARD" ? "Standard" : "Premium"} · nine cards`,
        priceCredits: type === "STANDARD" ? 900 : 1800,
        cards: 9,
        sport: "nfl",
        positions: ["QB", "RB", "WR", "TE", "K"],
        weights:
          type === "STANDARD"
            ? {
                RARE: 8500,
                ELITE: 1200,
                ULTRA_RARE: 250,
                LEGENDARY: 49,
                ICON: 1,
              }
            : {
                RARE: 6000,
                ELITE: 3000,
                ULTRA_RARE: 850,
                LEGENDARY: 149,
                ICON: 1,
              },
        guaranteedSlots: {},
        duplicatePlayers: "deny",
        status: "TEST_ONLY",
        effectiveAt,
        expiresAt: null,
        freshnessHours: 72,
        exhaustion: "FAIL_ENTIRE_PACK",
      } satisfies NinePackProduct,
    ];
  });
  const economy: CardEconomy = {
    id: "invited-nfl-test-v2",
    rarityVersion: rarityConfiguration.version,
    enabled: true,
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    products: Object.fromEntries(products),
    definitions: {},
    instances: {},
    packs: {},
  };
  if (Object.keys(economy.players).length !== players.length)
    throw Error("Duplicate permanent identity");
  validateCardEconomy(economy);
  return economy;
}
export function validateProduct(p: NinePackProduct) {
  if (p.id === premiumUltraVersion || p.version === premiumUltraVersion) {
    if (
      p.id !== premiumUltraVersion ||
      p.version !== premiumUltraVersion ||
      p.type !== "PREMIUM" ||
      digest(p.weights) !== digest(premiumUltraWeights) ||
      Object.keys(p.guaranteedSlots).length !== 0
    )
      throw Error(
        "Premium v3 requires exact Ultra Rare-or-better weights and no extra guaranteed slots",
      );
  }
  if (
    p.cards !== 9 ||
    p.status !== "TEST_ONLY" ||
    p.sport !== "nfl" ||
    !Number.isSafeInteger(p.priceCredits) ||
    p.priceCredits < 1 ||
    p.exhaustion !== "FAIL_ENTIRE_PACK" ||
    !["allow", "deny"].includes(p.duplicatePlayers) ||
    !Number.isFinite(p.effectiveAt) ||
    p.freshnessHours < 1 ||
    p.freshnessHours > 72 ||
    !p.id ||
    !p.version ||
    !["STANDARD", "PREMIUM"].includes(p.type) ||
    (p.expiresAt !== null &&
      (!Number.isFinite(p.expiresAt) || p.expiresAt <= p.effectiveAt)) ||
    !p.positions.length ||
    p.positions.some((x) => !["QB", "RB", "WR", "TE", "K"].includes(x)) ||
    (p.eligibleStatuses !== undefined &&
      (!p.eligibleStatuses.length ||
        p.eligibleStatuses.some(
          (s) => !["active", "inactive", "retired"].includes(s),
        ))) ||
    Object.keys(p.weights).some(
      (r) => !limitedRarities.includes(r as Rarity),
    ) ||
    limitedRarities.some(
      (r) => !Number.isSafeInteger(p.weights[r]) || p.weights[r] < 0,
    ) ||
    p.weights.ICON <= 0 ||
    Object.values(p.weights).reduce((a, b) => a + b, 0) !== 10000 ||
    Object.entries(p.guaranteedSlots).some(
      ([slot, r]) => !/^[0-8]$/.test(slot) || !limitedRarities.includes(r),
    )
  )
    throw Error("Invalid nine-card test product configuration");
}
export function validateCardEconomy(e: CardEconomy) {
  if (
    e.id !== "invited-nfl-test-v2" ||
    e.rarityVersion !== rarityConfiguration.version
  )
    throw Error("Isolated economy required");
  const providerIds = new Set<string>();
  for (const [id, p] of Object.entries(e.players)) {
    const key = `${p.sport}:${p.provider}:${p.providerId}`;
    if (id !== p.id || !p.providerId || providerIds.has(key))
      throw Error("Duplicate provider identity");
    providerIds.add(key);
  }
  Object.values(e.products).forEach(validateProduct);
  if (
    e.activeProductVersions?.some((id) => !e.products[id]) ||
    (e.activeProductVersions &&
      new Set(e.activeProductVersions).size !== e.activeProductVersions.length)
  )
    throw Error("Invalid active product versions");
  const serials = new Set<string>(),
    counts: Record<string, number> = {};
  if (Object.keys(e.retiredTestInstances ?? {}).some((id) => !!e.instances[id]))
    throw Error("Retired test allocation cannot be active");
  const allocations = { ...e.retiredTestInstances, ...e.instances };
  for (const [id, c] of Object.entries(allocations)) {
    const rule = rarityRule(c.rarity),
      key = `${c.definition}:${c.serial}`;
    if (
      id !== c.id ||
      !e.players[c.playerId] ||
      c.rarity === "CORE" ||
      c.definition !== definitionId(c.playerId, c.rarity) ||
      c.lifetimeCap !== rule.lifetimeCap ||
      c.rarityVersion !== e.rarityVersion ||
      !Number.isInteger(c.serial) ||
      c.serial < 1 ||
      c.serial > c.lifetimeCap ||
      serials.has(key)
    )
      throw Error("Permanent serial integrity");
    serials.add(key);
    counts[c.definition] = (counts[c.definition] ?? 0) + 1;
  }
  for (const [id, d] of Object.entries(e.definitions)) {
    if (
      id !== definitionId(d.playerId, d.rarity) ||
      d.issued !== (counts[id] ?? 0) ||
      d.issued > (rarityRule(d.rarity).lifetimeCap ?? 0)
    )
      throw Error("Lifetime supply mismatch");
    for (let serial = 1; serial <= d.issued; serial++)
      if (!serials.has(`${id}:${serial}`)) throw Error("Serial reuse/gap");
  }
  for (const c of Object.values(allocations))
    if (!e.definitions[c.definition]) throw Error("Missing supply definition");
  for (const p of Object.values(e.packs)) {
    if (
      p.cards.length !== 9 ||
      new Set(p.cards).size !== 9 ||
      p.cards.some((id) => allocations[id]?.source !== p.id) ||
      digest(p.product) !== p.configurationHash
    )
      throw Error("Pack receipt integrity");
  }
}
/** Injected RNG is only for deterministic tests. HTTP input never supplies it. */
export function allocateNine(
  original: CardEconomy,
  productId: string,
  member: string,
  request: string,
  now: number,
  choose: (max: number) => number = randomInt,
): EconomyPack {
  const e = structuredClone(original);
  validateCardEconomy(e);
  const p = e.products[productId];
  if (
    !e.enabled ||
    (e.activeProductVersions !== undefined &&
      !e.activeProductVersions.includes(productId)) ||
    !p ||
    now < p.effectiveAt ||
    (p.expiresAt !== null && now >= p.expiresAt)
  )
    throw Error("Pack unavailable");
  if (e.packs[request]) throw Error("Pack reference collision");
  const selected = new Set<string>(),
    cards: string[] = [],
    draws: EconomyPack["draws"] = [];
  const pick = (max: number) => {
    const value = choose(max);
    if (!Number.isInteger(value) || value < 0 || value >= max)
      throw Error("Invalid secure draw");
    return value;
  };
  for (let slot = 0; slot < 9; slot++) {
    const rarity = drawPackRarity(p, slot, pick);
    const pool = Object.values(e.players)
      .filter(
        (player) =>
          player.sport === p.sport &&
          player.assetKind === "player" &&
          (player.sport !== "nfl" ||
            nflCardEligibility(
              player,
              now,
              e.rosterPolicy === "official-nfl-roster-v1",
            ).eligible) &&
          (p.eligibleStatuses ?? ["active"]).includes(player.status) &&
          player.observedAt <= now &&
          now - player.observedAt <= p.freshnessHours * 3600000 &&
          p.positions.includes(player.position) &&
          (p.duplicatePlayers === "allow" || !selected.has(player.id)) &&
          (e.definitions[definitionId(player.id, rarity)]?.issued ?? 0) <
            rarityRule(rarity).lifetimeCap!,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!pool.length)
      throw Error(
        "Selected rarity has insufficient eligible supply; no charge or cards issued",
      );
    const player = pool[pick(pool.length)],
      definition = definitionId(player.id, rarity);
    const d = (e.definitions[definition] ??= {
      playerId: player.id,
      rarity,
      issued: 0,
    });
    const id = randomUUID();
    d.issued++;
    e.instances[id] = {
      id,
      definition,
      playerId: player.id,
      rarity,
      serial: d.issued,
      lifetimeCap: rarityRule(rarity).lifetimeCap!,
      mintedAt: now,
      source: request,
      presentation: player.presentation,
      printedTeam: player.currentTeam,
      rarityVersion: e.rarityVersion,
    };
    selected.add(player.id);
    cards.push(id);
    draws.push({
      rarity,
      eligiblePlayers: pool.length,
      poolHash: digest(pool.map((x) => x.id)),
    });
  }
  const pack: EconomyPack = {
    id: request,
    member,
    product: structuredClone(p),
    configurationHash: digest(p),
    cards,
    draws,
    createdAt: now,
    openedAt: null,
  };
  e.packs[request] = pack;
  validateCardEconomy(e);
  Object.assign(original, e);
  return pack;
}
export function economySupply(e: CardEconomy) {
  return Object.values(e.players).flatMap((p) =>
    limitedRarities.map((r) => {
      const issued = e.definitions[definitionId(p.id, r)]?.issued ?? 0,
        cap = rarityRule(r).lifetimeCap!;
      return {
        playerId: p.id,
        name: p.name,
        rarity: r,
        cap,
        issued,
        reserved: 0,
        available: cap - issued,
      };
    }),
  );
}
export function eligibleCatalogue(
  e: CardEconomy,
  p: NinePackProduct,
  now: number,
) {
  return Object.values(e.players).filter(
    (x) =>
      x.sport === p.sport &&
      x.assetKind === "player" &&
      (x.sport !== "nfl" ||
        nflCardEligibility(x, now, e.rosterPolicy === "official-nfl-roster-v1")
          .eligible) &&
      (p.eligibleStatuses ?? ["active"]).includes(x.status) &&
      p.positions.includes(x.position) &&
      x.observedAt <= now &&
      now - x.observedAt <= p.freshnessHours * 3600000,
  );
}

/** New offers only; saved pack/product snapshots and allocations are not rewritten. */
export function sevenPlayerPackUpgrade(e: CardEconomy, now: number) {
  const active: string[] = [];
  for (const type of ["STANDARD", "PREMIUM"] as const) {
    const old = e.products[`${type.toLowerCase()}-nine-test-v1`];
    if (!old) throw Error("Original approved test product required");
    const id = `${type.toLowerCase()}-nine-seven-test-v2`;
    if (!e.products[id])
      e.products[id] = {
        ...structuredClone(old),
        id,
        version: id,
        positions: ["QB", "RB", "WR", "TE"],
        effectiveAt: now,
      };
    active.push(id);
  }
  e.activeProductVersions = active;
  validateCardEconomy(e);
}

export const premiumUltraVersion = "premium-nine-seven-test-v3";
const premiumUltraWeights = Object.freeze({
  RARE: 0,
  ELITE: 0,
  ULTRA_RARE: 9000,
  LEGENDARY: 990,
  ICON: 10,
});

/** Explicit additive configuration transition. Never called by a read or an opening. */
export function premiumUltraPackUpgrade(original: CardEconomy, now: number) {
  const e = structuredClone(original);
  validateCardEconomy(e);
  const active = e.activeProductVersions ?? Object.keys(e.products);
  const premium = active
    .map((id) => e.products[id])
    .filter((p) => p.type === "PREMIUM");
  if (premium.length !== 1)
    throw Error("Exactly one active Premium configuration required");
  const old = premium[0];
  if (old.version === premiumUltraVersion) return old;
  if (Object.keys(old.guaranteedSlots).length)
    throw Error("Review existing Premium guaranteed slots before transition");
  if (e.products[premiumUltraVersion])
    throw Error(
      "Premium v3 already exists but is not active; explicit review required",
    );
  const next: NinePackProduct = {
    ...structuredClone(old),
    id: premiumUltraVersion,
    version: premiumUltraVersion,
    weights: { ...premiumUltraWeights },
    effectiveAt: now,
  };
  e.products[next.id] = next;
  e.activeProductVersions = active.map((id) => (id === old.id ? next.id : id));
  validateCardEconomy(e);
  Object.assign(original, e);
  return next;
}
