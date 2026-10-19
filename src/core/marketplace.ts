import {
  contextualCompetitionName,
  type CompetitionDisplayContext,
} from "./competition-display";
import { z } from "zod";
import { rarities } from "./card-rarity";
import { sevenPositions, collectibleOnly, cardIdentity } from "./card-display";
import { testCard, assertMemberTestEconomy } from "./member-test-wallet";
import { wallet, type CreditsState } from "./credits-sandbox";
import { nflSeven, salary } from "./nfl-seven";
import { sellerQuote } from "./credits-policy";
export const marketQuery = z.object({
  sport: z.enum(["nfl", "football", "afl", "basketball"]).default("nfl"),
  activityType: z
    .enum(["all", "purchase", "sale", "cancellation", "swap"])
    .default("all"),
  listing: z.string().max(100).default(""),
  sale: z.string().max(100).default(""),
  sell: z.string().max(100).default(""),
  tab: z.enum(["browse", "listings", "activity", "swaps"]).default("browse"),
  q: z.string().max(100).default(""),
  team: z.string().max(100).default(""),
  position: z.string().max(24).default(""),
  rarity: z
    .string()
    .refine((v) => !v || rarities.includes(v as (typeof rarities)[number]))
    .default(""),
  min: z.coerce.number().int().min(0).max(1000000000).default(0),
  max: z.coerce.number().int().min(0).max(1000000000).default(1000000000),
  playable: z.enum(["", "yes"]).default(""),
  available: z.enum(["", "yes"]).default(""),
  own: z.enum(["include", "exclude", "only"]).default("include"),
  status: z.enum(["OPEN", "SOLD", "CANCELLED"]).default("OPEN"),
  round: z.string().max(80).default(""),
  sort: z
    .enum(["newest", "price-asc", "price-desc", "rarity"])
    .default("newest"),
  cursor: z.string().max(2048).default(""),
  inventoryPage: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(40).default(12),
});
export type MarketQuery = z.infer<typeof marketQuery>;
export type MarketContext = {
  reserved: string[];
  hiddenCards?: string[];
  tradingEnabled?: boolean;
  offersEnabled?: boolean;
  ownerReservations?: {
    card: string;
    competition: string;
    name: string;
    slot: string;
    withdrawable: boolean;
    display?: CompetitionDisplayContext;
  }[];
  freeSwaps?: {
    id: string;
    status: string;
    at: number;
    give: string;
    take: string;
  }[];
  rounds: {
    id: string;
    name: string;
    configuration?: typeof nflSeven | null;
    display?: CompetitionDisplayContext;
    fixtures: {
      playerIds: string[];
      scheduledAt: string;
      status?: string;
      home?: string;
      away?: string;
    }[];
  }[];
};
export const emptyMarketContext: MarketContext = { reserved: [], rounds: [] };
/** Server-only use: bounded projection of the existing aggregate, never another inventory/ledger. */
export function marketplaceView(
  s: CreditsState,
  member: string,
  labels: { id: string; label: string }[],
  query: MarketQuery,
  context: MarketContext = emptyMarketContext,
  now = Date.now(),
) {
  assertMemberTestEconomy(s);
  context = {
    ...context,
    rounds: context.rounds.map((r) => ({
      ...r,
      name: contextualCompetitionName(r.name, r.display),
    })),
    ownerReservations: context.ownerReservations?.map((r) => ({
      ...r,
      name: contextualCompetitionName(r.name, r.display),
    })),
  };

  const activeSwap = (id: string) =>
    Object.values(s.swaps).some(
      (x) =>
        x.status === "OPEN" &&
        x.expires > now &&
        [...x.give, ...x.take].includes(id),
    );
  const card = (id: string) => {
    const c = testCard(s, id),
      player = s.economy?.players[c.player_id];
    const fresh =
      !!player &&
      player.observedAt <= now &&
      now - player.observedAt <= 72 * 3600000;
    const fixture = context.rounds
      .find((r) => r.id === query.round)
      ?.fixtures.find((f) => f.playerIds.includes(c.player_id));
    const canSelect =
      !collectibleOnly(c.position, c.sport ?? "nfl") &&
      fresh &&
      player?.status === "active" &&
      !!fixture &&
      (!fixture.status || fixture.status === "scheduled") &&
      Date.parse(fixture.scheduledAt) > now;
    const reason = context.reserved.includes(id)
      ? "Used in an unlocked submitted team. Replace it in Play before transferring."
      : activeSwap(id)
        ? "Reserved by an active swap offer."
        : s.commerce.cards[id].reserved
          ? "Reserved by another transaction."
          : s.cards[id].locked
            ? "Card held by an existing competition."
            : c.tier === "CORE"
              ? "Core cards cannot be sold for credits."
              : "";
    const selectedRound = context.rounds.find((r) => r.id === query.round);
    const config = query.round ? selectedRound?.configuration : nflSeven;
    const own = s.commerce.cards[id].owner === member;
    return {
      ...c,
      salary:
        config && rarities.includes(c.tier as (typeof rarities)[number])
          ? (salary(c.tier, config) ?? null)
          : null,
      salaryRules: config?.version ?? null,
      ownerReservations: own
        ? (context.ownerReservations ?? []).filter((r) => r.card === id)
        : [],
      fresh,
      eligible: canSelect,
      fixture: fixture ?? null,
      transferReason:
        reason && !own
          ? "Transfer restricted. This listing cannot currently be purchased."
          : reason,
      availability: !fresh
        ? "Current roster data unavailable or stale; not an injury or retirement diagnosis."
        : player?.status === "active"
          ? "Active roster; injury report unavailable."
          : `Roster: ${player?.status}. Injury report unavailable.`,
      gameplay: collectibleOnly(c.position, c.sport ?? "nfl")
        ? "Collectible only in current seven-player competitions. No eligible slot."
        : "QB / RB / WR / TE slots subject to the round's fixture and ownership rules.",
    };
  };
  const rows = Object.entries(s.listings)
    .filter(
      ([, l]) =>
        l.member === member ||
        l.buyer === member ||
        !(context.hiddenCards ?? []).includes(l.card),
    )
    .filter(
      ([, l]) => !l.privateOffer || l.member === member || l.buyer === member,
    )
    .filter(([id, l]) =>
      query.tab === "activity"
        ? l.status === "SOLD" && (l.member === member || l.buyer === member)
        : query.tab === "listings"
          ? l.member === member && l.status === "OPEN"
          : query.listing
            ? id === query.listing
            : l.status === "OPEN",
    )
    .map(([id, l]) => {
      const createdAt =
        l.createdAt ??
        s.events.find((e) => e.kind === "list" && e.id === `${l.member}:${id}`)
          ?.at ??
        0;
      // Historical receipt values are recovered from immutable ledger and ownership event, never current fee configuration.
      const saleEvent = s.cards[l.card]?.history.find(
        (h) => h.reference === id && h.from === l.member && h.to === l.buyer,
      );
      const journal = s.journal.find((j) =>
        l.receipt
          ? j.id === l.receipt.reference
          : j.reason === `Sale ${id}: 7.5% seller commission`,
      );
      const gross = journal
        ? -journal.lines
            .filter(
              (x) =>
                x.credits < 0 &&
                s.lots[x.account.split(":")[1]]?.member === l.buyer,
            )
            .reduce((n, x) => n + x.credits, 0)
        : null;
      const fee =
        journal?.lines.find((x) => x.account === "system:commission")
          ?.credits ?? (journal ? 0 : null);
      const receipt =
        l.receipt ??
        (journal && gross !== null && fee !== null
          ? {
              reference: journal.id,
              at: saleEvent?.at ?? journal.at,
              price: gross,
              fee,
              net: gross - fee,
            }
          : null);
      return {
        id,
        card:
          l.status === "SOLD" && (l.receipt?.cardSnapshot || l.snapshot)
            ? { ...card(l.card), ...(l.receipt?.cardSnapshot || l.snapshot) }
            : card(l.card),
        revision: l.revision ?? 0,
        own: l.member === member,
        seller: labels.find((p) => p.id === l.member)?.label ?? "Docked member",
        price: l.price,
        preference: l.preference ?? "sell",
        status: l.status,
        version: l.version,
        createdAt,
        cancelledAt:
          l.cancelledAt ??
          s.events.find(
            (e) =>
              e.kind === "cancel-listing" &&
              (e.command as { listing?: string }).listing === id,
          )?.at ??
          null,
        quote: l.price
          ? sellerQuote(l.price)
          : { price: 0, fee: 0, net: 0, policy: s.policy.version },
        receipt: l.member === member || l.buyer === member ? receipt : null,
        direction: l.member === member ? "Sale" : "Purchase",
      };
    })
    .filter(
      (l) =>
        l.card.sport === query.sport &&
        (query.tab === "activity" ||
          ((!query.q ||
            l.card.name.toLowerCase().includes(query.q.toLowerCase())) &&
            (!query.team || l.card.team === query.team) &&
            (!query.position || l.card.position === query.position) &&
            (!query.rarity || l.card.tier === query.rarity) &&
            l.price >= query.min &&
            l.price <= query.max &&
            (!query.playable || sevenPositions.includes(l.card.position)) &&
            (!query.round || l.card.eligible) &&
            (!query.available ||
              (l.card.fresh && l.card.status === "active")) &&
            (query.tab === "listings" ||
              query.own === "include" ||
              l.own === (query.own === "only")))),
    );
  const visibleRows = rows.filter(
    (l) =>
      query.tab === "activity" ||
      (l.price > 0 &&
        (query.tab === "listings" ||
          (!l.card.transferReason && l.status === "OPEN"))),
  );
  rows.splice(0, rows.length, ...visibleRows);
  const value = (l: (typeof rows)[number]) =>
    query.sort === "price-asc"
      ? l.price
      : query.sort === "price-desc"
        ? -l.price
        : query.sort === "rarity"
          ? rarities.indexOf(l.card.tier as (typeof rarities)[number])
          : -l.createdAt;
  rows.sort((a, b) => value(a) - value(b) || a.id.localeCompare(b.id));
  const signature = JSON.stringify({ ...query, cursor: "", limit: 0 });
  let after: [number, string] | null = null;
  if (query.cursor) {
    const c = JSON.parse(Buffer.from(query.cursor, "base64url").toString()) as {
      signature: string;
      value: number;
      id: string;
    };
    if (
      c.signature !== signature ||
      !Number.isFinite(c.value) ||
      typeof c.id !== "string"
    )
      throw Error("Filters changed; return to the first page");
    after = [c.value, c.id];
  }
  const eligible = after
    ? rows.filter(
        (l) =>
          value(l) > after![0] ||
          (value(l) === after![0] && l.id.localeCompare(after![1]) > 0),
      )
    : rows;
  const page = eligible.slice(0, query.limit),
    last = page.at(-1);
  // Own inventory is paginated independently through the same endpoint, never includes anyone else's private cards.
  const inventory = Object.keys(s.cards)
    .filter(
      (id) =>
        s.commerce.cards[id]?.owner === member &&
        (!s.economy?.instances[id] ||
          s.economy.packs[s.economy.instances[id].source]?.openedAt),
    )
    .map(card)
    .filter(
      (c) =>
        query.tab !== "listings" ||
        ((!query.q || c.name.toLowerCase().includes(query.q.toLowerCase())) &&
          (!query.team || c.team === query.team) &&
          (!query.position || c.position === query.position) &&
          (!query.rarity || c.tier === query.rarity)),
    );
  const requestedIndex = query.sell
    ? inventory.findIndex((c) => c.id === query.sell)
    : -1;
  const inventoryPage =
    requestedIndex >= 0 ? Math.floor(requestedIndex / 40) : query.inventoryPage;
  const activities: {
    id: string;
    kind: string;
    status: string;
    at: number | null;
    description: string;
    reference: string;
    price?: number;
    fee?: number;
    net?: number;
    listing?: string;
    card: ReturnType<typeof card>;
  }[] = rows
    .filter((l) => l.own || l.receipt)
    .filter((l) => l.status === "SOLD" && !!l.receipt)
    .map((l) => ({
      id: `listing:${l.id}`,
      card: l.card,
      kind: l.own ? "sale" : "purchase",
      status: l.status,
      at: l.receipt?.at ?? l.cancelledAt,
      description: `${l.card.name} · ${l.card.tier} · ${cardIdentity(l.card)}`,
      reference: l.receipt?.reference ?? l.id,
      listing: l.id,
      ...(l.receipt
        ? { price: l.receipt.price, fee: l.receipt.fee, net: l.receipt.net }
        : {}),
    }));
  const filteredActivity = activities
    .filter((a) => !query.sale || a.listing === query.sale)
    .filter(
      (a) => query.activityType === "all" || a.kind === query.activityType,
    )
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.id.localeCompare(b.id));
  const activityAfter = after
    ? filteredActivity.filter(
        (a) =>
          -(a.at ?? 0) > after![0] ||
          (-(a.at ?? 0) === after![0] && a.id.localeCompare(after![1]) > 0),
      )
    : filteredActivity;
  const activity = activityAfter.slice(0, query.limit),
    activityLast = activity.at(-1);
  const activityNext =
    activityAfter.length > query.limit && activityLast
      ? Buffer.from(
          JSON.stringify({
            signature,
            value: -(activityLast.at ?? 0),
            id: activityLast.id,
          }),
        ).toString("base64url")
      : null;
  return {
    member,
    tradingEnabled: context.tradingEnabled ?? false,
    offersEnabled: context.offersEnabled ?? false,
    activity,
    activityTotal: filteredActivity.length,
    activityNext,
    serverTime: now,
    query: { ...query, inventoryPage },
    wallet: wallet(s, member),
    policy: s.policy.version,
    rows: page,
    total: rows.length,
    next:
      eligible.length > query.limit && last
        ? Buffer.from(
            JSON.stringify({ signature, value: value(last), id: last.id }),
          ).toString("base64url")
        : null,
    inventoryTotal: query.sell ? 1 : 0,
    inventory: inventory
      .filter((c) => c.id === query.sell)
      .map((c) => ({
        ...c,
        listingId:
          Object.entries(s.listings).find(
            ([, l]) => l.card === c.id && l.status === "OPEN",
          )?.[0] ?? null,
        listed: Object.values(s.listings).some(
          (l) => l.card === c.id && l.status === "OPEN",
        ),
      })),
    positions: [
      ...new Set([
        ...(query.sport === "nfl" ? ["QB", "RB", "WR", "TE", "K"] : []),
        ...Object.values(s.economy?.players ?? {})
          .filter((p) => p.sport === query.sport)
          .map((p) => p.position)
          .filter(Boolean),
      ]),
    ],
    teams: [
      ...new Set(
        Object.values(s.economy?.players ?? {})
          .filter((p) => p.sport === query.sport)
          .map((p) => p.currentTeam),
      ),
    ].sort(),
    rounds: context.rounds.map((r) => ({ id: r.id, name: r.name })),
  };
}
export type MarketplaceView = ReturnType<typeof marketplaceView>;
