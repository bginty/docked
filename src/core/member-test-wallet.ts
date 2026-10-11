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
) {
  assertMemberTestEconomy(s);
  const visible = new Set<string>();
  for (const [id, c] of Object.entries(s.commerce.cards))
    if (c.owner === member && s.cards[id]) visible.add(id);
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
    products: s.policy.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.priceCredits,
      tier: p.inventoryTier,
    })),
    packs: Object.entries(s.entitlements)
      .filter(([, e]) => e.member === member)
      .map(([id, e]) => ({
        id,
        status: e.status,
        name:
          s.policy.products.find(
            (p) => p.id === s.commerce.orders[e.order].product,
          )?.name ?? "Test pack",
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
    ownerReport: owner ? financialReport(s) : null,
  };
}
export type MemberTestView = ReturnType<typeof memberTestView>;
