import { rarityRule } from "./card-rarity";
import { economySupply, eligibleCatalogue } from "./card-economy";
import {
  initialCredits,
  wallet,
  creditsCommand,
  financialReport,
  type CreditsState,
} from "./credits-sandbox";
import type { AwardedCard, PackReceipt } from "./pack-opening";
export const testWalletVersion = "invited-test-credits-2026-10-11-v1";
export const barryGrantReference =
  "owner-authorized-barry-test-100000-20261011-v1";
export function initialMemberTestCredits() {
  const s = initialCredits();
  s.policy.version = testWalletVersion;
  s.policy.campaignLimit = 100000;
  s.policy.purchasedWithdrawable = false;
  for (const p of s.policy.products) {
    const pool = Array.from({ length: 20 }, (_, i) => `test-${p.id}-${i + 1}`);
    s.commerce.products[p.id] = {
      tier: p.inventoryTier,
      cents: p.priceCredits,
      pool,
      method: "random",
      sport: "nfl",
    };
    for (const id of pool)
      s.commerce.cards[id] = {
        tier: p.inventoryTier,
        sport: "nfl",
        owner: null,
        reserved: null,
      };
  }
  return s;
}
export function assertMemberTestEconomy(s: CreditsState) {
  if (
    s.policy.version !== testWalletVersion ||
    s.policy.liveEnabled ||
    s.policy.purchasedWithdrawable ||
    Object.values(s.lots).some((l) => l.redeemable) ||
    Object.keys(s.deposits).length ||
    Object.keys(s.withdrawals).length
  )
    throw Error("Test-only economy required");
}
const memberKinds = new Set([
  "buy-pack",
  "open-pack",
  "list",
  "cancel-listing",
  "buy",
  "offer",
  "accept",
  "reject",
  "cancel-swap",
]);
export function memberTestCommand(input: unknown) {
  const c = creditsCommand.parse(input);
  if (!memberKinds.has(c.kind)) throw Error("Test wallet action denied");
  return c;
}
export function testCard(s: CreditsState, id: string): AwardedCard {
  const c = s.commerce.cards[id];
  if (!c || !s.cards[id]) throw Error("Card not opened");
  const instance = s.economy?.instances[id];
  if (instance && s.economy) {
    const player = s.economy.players[instance.playerId];
    return {
      id,
      edition_id: instance.definition,
      player_id: player.id,
      name: player.name,
      position: player.position,
      tier: instance.rarity,
      season: "LIFETIME TEST",
      kind: "regular",
      max_supply: instance.lifetimeCap,
      serial: instance.serial,
      team: player.currentTeam,
      edition_team: instance.printedTeam,
      colour: "#1A2AFF",
      shirt: 0,
      status: player.status,
      sport: player.sport,
      tradeable: true,
      rarity_version: instance.rarityVersion,
      multiplier: rarityRule(instance.rarity).multiplierTenths / 10,
      presentation: instance.presentation,
    };
  }
  const serial = Number(id.split("-").at(-1));
  return {
    id,
    edition_id: `test-${c.tier}`,
    player_id: `test-player-${serial}`,
    name: `Test Player ${serial}`,
    position: ["QB", "RB", "WR", "TE"][(serial - 1) % 4],
    tier: c.tier as AwardedCard["tier"],
    season: "2026 TEST",
    kind: "regular",
    max_supply: 20,
    serial,
    team: "Docked Test Squad",
    colour: "#1A2AFF",
    shirt: serial,
    status: "active",
    sport: "nfl",
    tradeable: true,
  };
}
export function testReceipt(
  s: CreditsState,
  id: string,
  member: string,
): PackReceipt {
  const e = s.entitlements[id];
  if (!e || e.member !== member || e.status !== "OPENED")
    throw Error("Receipt unavailable");
  const nine = s.economy?.packs[id];
  if (nine)
    return {
      id,
      name: nine.product.name,
      opened_at: new Date(nine.openedAt!).toISOString(),
      cards: nine.cards.map((card) => testCard(s, card)),
    };
  return {
    id,
    name: "Docked test single-card pack",
    opened_at: new Date(
      s.cards[s.commerce.orders[e.order].card].history[0].at,
    ).toISOString(),
    cards: [testCard(s, s.commerce.orders[e.order].card)],
  };
}
export function memberTestView(
  s: CreditsState,
  member: string,
  peers: { id: string; label: string }[],
  owner = false,
  now = Date.now(),
) {
  assertMemberTestEconomy(s);
  const supplyRows = s.economy ? economySupply(s.economy) : [];
  const visible = new Set<string>();
  for (const [id, c] of Object.entries(s.commerce.cards))
    if (
      c.owner === member &&
      s.cards[id] &&
      (!s.economy?.instances[id] ||
        s.economy.packs[s.economy.instances[id].source]?.openedAt)
    )
      visible.add(id);
  const listings = Object.entries(s.listings)
    .filter(
      ([, l]) =>
        l.status === "OPEN" || l.member === member || l.buyer === member,
    )
    .map(([id, l]) => {
      visible.add(l.card);
      return { id, ...l };
    });
  const swaps = Object.entries(s.swaps)
    .filter(([, x]) => x.member === member || x.other === member)
    .map(([id, x]) => {
      x.give.concat(x.take).forEach((c) => visible.add(c));
      return { id, ...x };
    });
  return {
    member,
    policy: s.policy.version,
    wallet: wallet(s, member),
    peers,
    economyEnabled: !!s.economy?.enabled,
    products: s.economy?.enabled
      ? Object.values(s.economy.products).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.priceCredits,
          tier: p.type,
          cards: p.cards,
          weights: p.weights,
          guaranteedSlots: p.guaranteedSlots,
          duplicatePlayers: p.duplicatePlayers,
          eligiblePlayers: eligibleCatalogue(s.economy!, p, now).length,
          available:
            now >= p.effectiveAt &&
            (p.expiresAt === null || now < p.expiresAt) &&
            eligibleCatalogue(s.economy!, p, now).length >= 9,
          version: p.version,
        }))
      : (s.economy ? [] : s.policy.products).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.priceCredits,
          tier: p.inventoryTier,
          cards: 1,
          weights: null,
          guaranteedSlots: {},
          duplicatePlayers: "n/a",
          eligiblePlayers: 20,
          version: p.id,
          available: true,
        })),
    packs: Object.entries(s.entitlements)
      .filter(([, e]) => e.member === member)
      .map(([id, e]) => ({
        id,
        status: e.status,
        name:
          s.economy?.packs[id]?.product.name ??
          s.policy.products.find(
            (p) => p.id === s.commerce.orders[e.order]?.product,
          )?.name ??
          "Test pack",
        receipt: e.status === "OPENED" ? testReceipt(s, id, member) : null,
      })),
    cards: [...visible].map((id) => ({
      ...testCard(s, id),
      owner: s.commerce.cards[id].owner,
      history: s.cards[id].history,
    })),
    listings,
    swaps,
    history: s.journal
      .filter((j) =>
        j.lines.some((l) => {
          const lid = l.account.split(":")[1];
          return s.lots[lid]?.member === member;
        }),
      )
      .map((j) => ({
        id: j.id,
        at: j.at,
        reason: j.reason,
        change: j.lines
          .filter((l) => s.lots[l.account.split(":")[1]]?.member === member)
          .reduce((n, l) => n + l.credits, 0),
      })),
    supply: supplyRows.filter(
      (row) =>
        visible.size &&
        [...visible].some(
          (id) => s.economy?.instances[id]?.playerId === row.playerId,
        ),
    ),
    ownerEconomy:
      owner && s.economy
        ? {
            version: s.economy.rarityVersion,
            products: s.economy.products,
            supply: supplyRows,
            packs: Object.values(s.economy.packs).map((p) => ({
              id: p.id,
              product: p.product.id,
              configuration: p.configurationHash,
              draws: p.draws,
              at: p.createdAt,
            })),
            players: Object.values(s.economy.players).map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              observedAt: p.observedAt,
            })),
            integrity: "Database-enforced permanent definitions and serials",
          }
        : null,
    ownerReport: owner ? financialReport(s) : null,
    failures: [] as {
      request: string;
      product: string;
      category: string;
      recordedAt: string;
    }[],
    pool: s.economy
      ? Object.values(s.economy.players).map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          team: p.currentTeam,
          status: p.status,
          fresh: p.observedAt <= now && now - p.observedAt <= 72 * 3600000,
          supply: supplyRows.filter((r) => r.playerId === p.id),
        }))
      : [],
  };
}
export type MemberTestView = ReturnType<typeof memberTestView>;
