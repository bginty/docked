import { portfolioValuation } from "./portfolio-valuation";
import { packAvailability } from "./pack-availability";
import { rarityRule } from "./card-rarity";
import { swapFeeQuote } from "./credit-only";
import { economySupply, eligibleCatalogue } from "./card-economy";
import { packOdds } from "./pack-odds";
import {
  initialCredits,
  wallet,
  creditsCommand,
  financialReport,
  validateStoreTestProvenance,
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
  validateStoreTestProvenance(s);
  if (
    s.policy.version !== testWalletVersion ||
    s.policy.liveEnabled ||
    s.policy.purchasedWithdrawable ||
    Object.values(s.lots).some((l) => l.redeemable) ||
    Object.keys(s.deposits).some((key) => !s.storeTestDeposits?.[key]) ||
    Object.keys(s.withdrawals).length
  )
    throw Error("Test-only economy required");
}
const memberKinds = new Set([
  "buy-pack",
  "open-pack",
  "list",
  "replace-listing",
  "reprice-listing",
  "cancel-listing",
  "buy",
  "review-buy",
  "expire-swap",
  "offer",
  "accept",
  "reject",
  "cancel-swap",
]);
export function memberTestCommand(input: unknown) {
  const c = creditsCommand.parse(input);
  assertCreditSalesOnly(c);
  if (!memberKinds.has(c.kind)) throw Error("Test wallet action denied");
  if (c.kind === "offer" && c.creditTopUp !== undefined)
    throw Error("Combined offers require the reviewed private-offer workflow");
  if (c.kind === "buy" && !c.review)
    throw Error("Review the listing before confirming purchase");
  return c;
}
import { assertCreditSalesOnly } from "./credit-sales-only";
import { teamColours } from "./sport-team-colours";
import { rosterCardMetadata } from "./roster-card-metadata";
export type TestCardSource = {
  commerce: Pick<CreditsState["commerce"], "cards">;
  cards: Record<string, unknown>;
  economy?: Pick<NonNullable<CreditsState["economy"]>, "instances" | "players">;
};
export function testCard(s: TestCardSource, id: string): AwardedCard {
  const c = s.commerce.cards[id];
  if (!c || !s.cards[id]) throw Error("Card not opened");
  const instance = s.economy?.instances[id];
  if (instance && s.economy) {
    const player = s.economy.players[instance.playerId];
    return {
      artworkVersion: "afl-owner-2026-10-24-v1",
      id,
      edition_id: instance.definition,
      player_id:
        player.synthetic || player.inventoryClass === "real-roster-beta-v1"
          ? (player.fixturePlayerId ?? player.id)
          : player.id,
      name: player.name,
      position: player.position,
      tier: instance.rarity,
      season:
        player.inventoryClass === "real-roster-beta-v1"
          ? "REAL PLAYER · BETA INVENTORY"
          : player.synthetic
            ? `SYNTHETIC ${player.sport === "basketball" ? "NBA" : player.sport.toUpperCase()} TEST`
            : "LIFETIME TEST",
      kind: "regular",
      max_supply: instance.lifetimeCap,
      serial: instance.serial,
      team: player.currentTeam,
      edition_team: instance.printedTeam,
      colour:
        teamColours(player.sport, player.currentTeam)?.primary ?? "#1A2AFF",
      accentColour: teamColours(player.sport, player.currentTeam)?.accent,
      shirt: 0,
      verifiedJerseyNumber: player.verifiedJerseyNumber,
      ...rosterCardMetadata(
        player.fixturePlayerId ?? player.id,
        player.sport,
        player.currentTeam,
      ),
      status: player.status,
      sport: player.sport,
      tradeable: true,
      rarity_version: instance.rarityVersion,
      multiplier:
        !["nfl", "basketball"].includes(player.sport) &&
        (player.synthetic || player.inventoryClass === "real-roster-beta-v1")
          ? 1
          : rarityRule(instance.rarity).multiplierTenths / 10,
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
      ...(nine.cards.some((card) => !!s.economy?.retiredTestInstances?.[card])
        ? {
            notice:
              "Ineligible test cards were removed after a verified roster audit. Original allocations remain in the audit history; no replacements or credits were issued.",
          }
        : {}),
      cards: nine.cards
        .filter((card) => !s.economy?.retiredTestInstances?.[card])
        .map((card) => testCard(s, card)),
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
  hiddenCards: string[] = [],
  options: { catalogue?: boolean } = {},
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
        l.member === member ||
        l.buyer === member ||
        (!l.privateOffer && !hiddenCards.includes(l.card)),
    )
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
      return {
        id,
        ...x,
        status:
          x.status === "OPEN" && x.expires <= now
            ? ("EXPIRED" as const)
            : x.status,
      };
    });
  return {
    member,
    serverTime: now,
    policy: s.policy.version,
    wallet: wallet(s, member),
    portfolio: portfolioValuation(s, member, now, hiddenCards),
    swapQuote: swapFeeQuote(s.creditOnly, s.policy.swapFeeEach, now),
    swapWindows: owner ? (s.creditOnly?.windows ?? []) : [],
    peers,
    economyEnabled: !!s.economy?.enabled,
    products: s.economy?.enabled
      ? Object.values(s.economy.products)
          .filter(
            (p) =>
              !s.economy?.activeProductVersions ||
              s.economy.activeProductVersions.includes(p.id),
          )
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: p.priceCredits,
            tier: p.type,
            cards: p.cards,
            sport: p.sport,
            inventoryScope: p.inventoryScope,
            weights: p.weights,
            odds: packOdds(p),
            positions: p.positions,
            guaranteedSlots: p.guaranteedSlots,
            duplicatePlayers: p.duplicatePlayers,
            eligiblePlayers: eligibleCatalogue(s.economy!, p, now).length,
            ...packAvailability(s.economy!, p, now),
            version: p.version,
          }))
      : (s.economy ? [] : s.policy.products).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.priceCredits,
          tier: p.inventoryTier,
          cards: 1,
          sport: "nfl" as const,
          weights: null,
          odds: null,
          positions: [],
          guaranteedSlots: {},
          duplicatePlayers: "n/a",
          eligiblePlayers: 20,
          version: p.id,
          available: true,
          availabilityReason: null,
          availabilityRetryable: false,
        })),
    packs: Object.entries(s.entitlements)
      .filter(([, e]) => e.member === member)
      .map(([id, e]) => ({
        id,
        status: e.status,
        product:
          s.economy?.packs[id]?.product.id ??
          s.commerce.orders[e.order]?.product ??
          null,
        type: s.economy?.packs[id]?.product.type ?? null,
        sport: s.economy?.packs[id]?.product.sport ?? "nfl",
        purchasedAt: s.economy?.packs[id]?.createdAt ?? null,
        paidCredits: e.source.startsWith("round-reward:")
          ? 0
          : (s.economy?.packs[id]?.pricing?.charge ??
            s.economy?.packs[id]?.product.priceCredits ??
            null),
        coupon: s.economy?.packs[id]?.pricing
          ? {
              code: s.economy.packs[id].pricing!.coupon.code,
              original: s.economy.packs[id].pricing!.original,
              saving: s.economy.packs[id].pricing!.saving,
            }
          : null,
        cardCount:
          s.economy?.packs[id]?.cards.filter(
            (card) => !s.economy?.retiredTestInstances?.[card],
          ).length ?? null,
        configuration: s.economy?.packs[id]?.product.version ?? null,
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
      history:
        s.commerce.cards[id].owner === member
          ? s.cards[id].history.map((h) => ({
              ...h,
              from:
                h.from === member ? member : h.from ? "another-member" : null,
              to: h.to === member ? member : "another-member",
              reference: !h.from
                ? "Issued"
                : s.listings[h.reference]
                  ? "Purchased / sold"
                  : s.swaps[h.reference]
                    ? "Swapped"
                    : "Ownership transfer",
            }))
          : [],
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
      .map((j) => {
        const sale = Object.values(s.listings).find(
          (l) =>
            l.receipt?.reference === j.id &&
            (l.member === member || l.buyer === member),
        );
        const entitlement = Object.entries(s.entitlements).find(
          ([, e]) => e.member === member && e.source === j.id,
        );
        const product = entitlement
          ? s.economy?.packs[entitlement[0]]?.product
          : null;
        const legacyProduct = entitlement
          ? s.policy.products.find(
              (p) => p.id === s.commerce.orders[entitlement[1].order]?.product,
            )
          : null;
        return {
          label: sale
            ? `${sale.member === member ? "Card sold" : "Card purchased"} · ${sale.receipt?.cardSnapshot?.name ?? "Collectible card"}`
            : (product?.name ??
              legacyProduct?.name ??
              (/revers/i.test(j.reason)
                ? "Credit reversal"
                : "Credit adjustment")),
          sale:
            sale?.member === member && sale.receipt
              ? {
                  price: sale.receipt.price,
                  fee: sale.receipt.fee,
                  net: sale.receipt.net,
                }
              : null,
          id: j.id,
          at: j.at,
          reason: j.reason,
          change: j.lines
            .filter((l) => s.lots[l.account.split(":")[1]]?.member === member)
            .reduce((n, l) => n + l.credits, 0),
        };
      }),
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
    pool:
      s.economy && options.catalogue !== false
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
/** The shared header/profile needs balances and counts, not catalogue or audit data. */
export function memberTestSummary(
  s: CreditsState,
  member: string,
  now = Date.now(),
  hiddenCards: string[] = [],
) {
  assertMemberTestEconomy(s);
  return {
    member,
    wallet: wallet(s, member),
    portfolio: portfolioValuation(s, member, now, hiddenCards),
    packs: Object.values(s.entitlements)
      .filter((p) => p.member === member)
      .map((p) => ({ status: p.status })),
    swaps: Object.values(s.swaps)
      .filter((s) => s.member === member || s.other === member)
      .map((s) => ({ status: s.status })),
  };
}
export type MemberTestView = Omit<
  ReturnType<typeof memberTestView>,
  "products"
> & {
  products: ReturnType<typeof memberTestView>["products"][number][];
};
