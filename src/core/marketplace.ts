import { z } from "zod";
import { rarities } from "./card-rarity";
import { sevenPositions, collectibleOnly, cardIdentity } from "./card-display";
import { testCard, assertMemberTestEconomy } from "./member-test-wallet";
import { wallet, type CreditsState } from "./credits-sandbox";
import { nflSeven, salary } from "./nfl-seven";
import { sellerQuote } from "./credits-policy";
export const marketQuery = z.object({
  activityType: z
    .enum(["all", "purchase", "sale", "cancellation", "swap"])
    .default("all"),
  listing: z.string().max(100).default(""),
  sell: z.string().max(100).default(""),
  tab: z.enum(["browse", "listings", "activity", "swaps"]).default("browse"),
  q: z.string().max(100).default(""),
  team: z.string().max(100).default(""),
  position: z.enum(["", "QB", "RB", "WR", "TE", "K", "DEF", "DST"]).default(""),
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
  ownerReservations?: {
    card: string;
    competition: string;
    name: string;
    slot: string;
    withdrawable: boolean;
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
    .filter(([id, l]) =>
      query.tab === "activity"
        ? (l.status === "SOLD" &&
            (l.member === member || l.buyer === member)) ||
          (l.status === "CANCELLED" && l.member === member)
        : query.tab === "listings"
          ? l.member === member && l.status === query.status
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
      const journal = s.journal.find(
        (j) => j.reason === `Sale ${id}: 7.5% seller commission`,
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
        card: card(l.card),
        own: l.member === member,
        seller: labels.find((p) => p.id === l.member)?.label ?? "Docked member",
        price: l.price,
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
        quote: sellerQuote(l.price),
        receipt: l.member === member || l.buyer === member ? receipt : null,
        direction: l.member === member ? "Sale" : "Purchase",
      };
    })
    .filter(
      (l) =>
        query.tab === "activity" ||
        ((!query.q ||
          l.card.name.toLowerCase().includes(query.q.toLowerCase())) &&
          (!query.team || l.card.team === query.team) &&
          (!query.position || l.card.position === query.position) &&
          (!query.rarity || l.card.tier === query.rarity) &&
          l.price >= query.min &&
          l.price <= query.max &&
          (!query.playable || sevenPositions.includes(l.card.position)) &&
          (!query.round || l.card.eligible) &&
          (!query.available || (l.card.fresh && l.card.status === "active")) &&
          (query.own === "include" || l.own === (query.own === "only"))),
    );
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
    .map(card);
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
  }[] = rows
    .filter((l) => l.own || l.receipt)
    .filter((l) => l.status !== "OPEN")
    .map((l) => ({
      id: `listing:${l.id}`,
      kind:
        l.status === "CANCELLED" ? "cancellation" : l.own ? "sale" : "purchase",
      status: l.status,
      at: l.receipt?.at ?? l.cancelledAt,
      description: `${l.card.name} · ${l.card.tier} · ${cardIdentity(l.card)}`,
      reference: l.receipt?.reference ?? l.id,
      listing: l.id,
      ...(l.receipt
        ? { price: l.receipt.price, fee: l.receipt.fee, net: l.receipt.net }
        : {}),
    }));
  for (const [id, offer] of Object.entries(s.swaps)) {
    if (![offer.member, offer.other].includes(member)) continue;
    const status =
      offer.status === "OPEN" && offer.expires <= now
        ? "EXPIRED"
        : offer.status;
    if (status === "OPEN") continue;
    const event = [...s.events]
      .reverse()
      .find((e) => (e.command as { swap?: string }).swap === id);
    activities.push({
      id: `swap:${id}`,
      kind: "swap",
      status,
      at: status === "EXPIRED" ? offer.expires : (event?.at ?? null),
      description: `Test-credit card swap · ${offer.give.length} for ${offer.take.length} cards`,
      reference: id,
      ...(status === "ACCEPTED" && offer.completedFeeEach !== undefined
        ? { fee: offer.completedFeeEach }
        : {}),
    });
  }
  for (const offer of context.freeSwaps ?? [])
    activities.push({
      id: `free:${offer.id}`,
      kind: "swap",
      status: offer.status.toUpperCase(),
      at: offer.at,
      description: "Free beta card swap",
      reference: offer.id,
    });
  const filteredActivity = activities
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
    inventoryTotal: inventory.length,
    inventory: inventory
      .slice(inventoryPage * 40, (inventoryPage + 1) * 40)
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
        "QB",
        "RB",
        "WR",
        "TE",
        "K",
        ...Object.values(s.economy?.players ?? {})
          .map((p) => p.position)
          .filter((p) => p === "DEF" || p === "DST"),
      ]),
    ],
    teams: [
      ...new Set(
        Object.values(s.economy?.players ?? {}).map((p) => p.currentTeam),
      ),
    ].sort(),
    rounds: context.rounds.map((r) => ({ id: r.id, name: r.name })),
  };
}
export type MarketplaceView = ReturnType<typeof marketplaceView>;
