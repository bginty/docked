import "server-only";
import { z } from "zod";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { assertMemberTestEconomy } from "../core/member-test-wallet";
import { ownerWalletSummary } from "../core/owner-wallet-summary";
import { reviewedBetaTrading } from "../core/beta-trading";

export const ownerTradingCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("pause"),
      paused: z.boolean(),
      revision: z.number().int().min(0),
      request: z.string().uuid(),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("case"),
      category: z.enum(["dispute", "suspicious", "case_closed"]),
      request: z.string().uuid(),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
export type TradingReport = {
  control: {
    policy: string;
    approval_reference: string | null;
    approved_at: string | null;
    paused: boolean;
    sale: boolean;
    swap: boolean;
    combined: boolean;
    revision: number;
  };
  members: { id: string; label: string; enabled: boolean }[];
  audit: {
    id: number;
    request: string;
    actor: string;
    action: string;
    detail: string;
    created_at: string;
  }[];
};
export async function changeOwnerMarketplace(input: unknown) {
  const who = await requireRole(["owner"]),
    sql = db();
  if (
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.DOCKED_FRIENDS_BETA !== "true"
  )
    throw Error("Private beta required");
  const command = ownerTradingCommand.parse(input);
  if (!(await rateLimit(`owner-trading:${who.user.id}`, 20, 60)))
    throw Error("Please wait before another request");
  await sql.begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select pg_advisory_xact_lock(71820342)`;
    if (command?.action === "pause") {
      if (
        !command.paused &&
        (!reviewedBetaTrading(process.env) ||
          process.env.DOCKED_TEST_MARKET_READ_ONLY !== "false")
      )
        throw Error("Deployment trading control is paused");
      if (!command.paused)
        assertMemberTestEconomy(
          await new CreditsSandboxStore(tx as unknown as typeof sql).read(),
        );
      await tx`select credits_sandbox.trading_set_pause(${command.paused},${command.revision},${command.request}::uuid,${command.reason})`;
    } else if (command?.action === "case")
      await tx`select credits_sandbox.trading_record(${command.request}::uuid,${command.category},${command.reason})`;
  });
}
export async function ownerMarketplace() {
  const who = await requireRole(["owner"]),
    sql = db();
  if (
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.DOCKED_FRIENDS_BETA !== "true"
  )
    throw Error("Private beta required");
  return sql.begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select pg_advisory_xact_lock(71820342)`;
    const [row] = await tx`select credits_sandbox.trading_report() value`;
    const state = await new CreditsSandboxStore(
      tx as unknown as typeof sql,
    ).read();
    assertMemberTestEconomy(state);
    return {
      ...(row.value as TradingReport),
      deploymentEnabled:
        reviewedBetaTrading(process.env) &&
        process.env.DOCKED_TEST_MARKET_READ_ONLY === "false",
      wallet: ownerWalletSummary(state),
      listings: Object.entries(state.listings)
        .filter(([, l]) => l.status === "OPEN" && !l.privateOffer)
        .map(([id, l]) => ({
          id,
          card: l.card,
          member: l.member,
          price: l.price,
          preference: l.preference ?? "sell",
        })),
      // One record per settled operation. Private-accept also emits underlying
      // buy/accept events; counting both would double-count the same trade.
      history: [
        ...Object.entries(state.listings)
          .filter(([, l]) => l.status === "SOLD")
          .map(([id, l]) => ({
            id,
            actor: l.buyer ?? l.member,
            kind: "sale",
            at: l.receipt?.at ?? null,
          })),
        ...Object.entries(state.swaps)
          .filter(([, s]) => s.status === "ACCEPTED")
          .map(([id, s]) => ({
            id,
            actor: s.other,
            kind: s.creditTopUp ? "combined" : "swap",
            at:
              state.events.find(
                (e) =>
                  e.kind === "accept" &&
                  (e.command as { swap?: string }).swap === id,
              )?.at ?? null,
          })),
      ]
        .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
        .slice(0, 100),
      pendingOffers: Object.values(state.privateCardOffers ?? {})
        .filter((o) => o.status === "OPEN" && o.expires > Date.now())
        .map((o) => ({
          id: o.id,
          buyer: o.buyer,
          seller: o.seller,
          card: o.card,
          price: o.price,
          expires: o.expires,
        })),
      transfers: [
        ...Object.entries(state.listings)
          .filter(([, l]) => l.status === "SOLD")
          .map(([id, l]) => ({
            id,
            card: l.card,
            from: l.member,
            to: l.buyer,
            receipt: l.receipt,
          })),
        ...Object.entries(state.swaps)
          .filter(([, s]) => s.status === "ACCEPTED")
          .flatMap(([id, s]) => [
            ...s.give.map((card) => ({
              id,
              card,
              from: s.member,
              to: s.other,
            })),
            ...s.take.map((card) => ({
              id,
              card,
              from: s.other,
              to: s.member,
            })),
          ]),
      ]
        .slice(-100)
        .reverse(),
    };
  });
}
