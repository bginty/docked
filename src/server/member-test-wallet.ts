import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { CreditsSandboxStore, CreditsRejected } from "./credits-sandbox-store";
import { creditsCommand } from "@/core/credits-sandbox";
import { refreshEconomyCatalogue } from "./economy-catalogue";
import { setCommunityClaims } from "./community-social";
import type { TransactionSql } from "postgres";
import { privateOfferEnabled } from "../core/private-card-offers";
import { hiddenMarketCards } from "./market-visibility";
import {
  memberTestCommand,
  memberTestView,
  assertMemberTestEconomy,
  testReceipt,
} from "@/core/member-test-wallet";
export async function memberTestSource(input?: unknown) {
  if (
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    throw Error("Test wallet unavailable");
  const who = await requireIdentity(),
    sql = db();
  const [access] =
    await sql`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled and beta_private.admitted(user_id)`;
  if (!access) throw Error("Test wallet admission required");
  const isOwner = access.kind === "owner";
  if (isOwner && who.aal !== "aal2") throw Error("Owner MFA required");
  if (input && !(await rateLimit(`test-wallet:${who.user.id}`, 40, 60)))
    throw Error("Please wait before another request");
  const peers =
    await sql`select user_id::text id,label from credits_sandbox.access where enabled and beta_private.admitted(user_id)`;
  let command: ReturnType<typeof memberTestCommand> | undefined;
  const store = new CreditsSandboxStore(sql, async (tx, state) => {
    await setCommunityClaims(tx as unknown as TransactionSql, who);
    assertMemberTestEconomy(state);
    await refreshEconomyCatalogue(tx, state);
    const rows =
      await tx`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled`;
    if (!rows.length || (rows[0].kind === "owner" && who.aal !== "aal2"))
      throw Error("Admission revoked");
    if (
      !(await tx`select beta_private.admitted(${who.user.id}::uuid) allowed`)[0]
        ?.allowed
    )
      throw Error("Admission revoked");
    const counterparties =
      command?.kind === "offer"
        ? [command.other]
        : command?.kind === "buy"
          ? [state.listings[command.listing]?.member]
          : command?.kind === "accept"
            ? [
                state.swaps[command.swap]?.member,
                state.swaps[command.swap]?.other,
              ]
            : [];
    for (const id of counterparties) {
      if (
        !id ||
        !(
          await tx`select user_id from credits_sandbox.access where user_id=${id}::uuid and enabled and beta_private.admitted(user_id)`
        ).length
      )
        throw Error("Counterparty no longer admitted");
    }
    if (command?.kind === "buy" || command?.kind === "review-buy") {
      const l = state.listings[command.listing];
      if (l) {
        const [v] =
          await tx`select private.social_collection_cards(${l.member}::uuid,${tx.json([{ id: l.card }])}) cards`;
        if (!v?.cards?.length) throw new CreditsRejected("Listing unavailable");
      }
    }
    const swap = command?.kind === "accept" ? state.swaps[command.swap] : null;
    const otherCards =
      command?.kind === "offer"
        ? command.take
        : swap
          ? [...swap.give, ...swap.take].filter(
              (id) => state.commerce.cards[id]?.owner !== who.user.id,
            )
          : [];
    for (const id of otherCards) {
      const owner = state.commerce.cards[id]?.owner;
      if (!owner) throw new CreditsRejected("Card unavailable");
      const [v] =
        await tx`select private.social_collection_cards(${owner}::uuid,${tx.json([{ id }])}) cards`;
      if (!v?.cards?.length) throw new CreditsRejected("Card unavailable");
    }
  });
  let result: unknown = null;
  if (input !== undefined) {
    const body = z
      .object({ request: z.string().uuid(), command: z.unknown() })
      .strict()
      .parse(input);
    const parsed = creditsCommand.parse(body.command);
    if (parsed.kind === "swap-window") {
      if (!isOwner || who.aal !== "aal2") throw Error("Owner MFA required");
      command = parsed;
    } else command = memberTestCommand(body.command);
    if (
      process.env.DOCKED_TEST_MARKET_READ_ONLY === "true" &&
      ["list", "replace-listing", "buy", "offer", "accept"].includes(
        command.kind,
      )
    )
      throw new CreditsRejected(
        "Trading is temporarily paused. Your cards and credits are unchanged. You can still cancel listings and offers.",
      );
    if (
      (command.kind === "list" || command.kind === "replace-listing") &&
      command.preference &&
      command.preference !== "sell" &&
      !privateOfferEnabled(process.env)
    )
      throw new CreditsRejected("Swap listings await beta trading approval");
    const other = command.kind === "offer" ? command.other : null;
    if (other && !peers.some((p) => p.id === other))
      throw Error("Counterparty not admitted");
    assertMemberTestEconomy(await store.read());
    try {
      result = await store.execute(
        command.kind === "swap-window"
          ? { id: who.user.id, role: "reviewer", aal: "aal2" }
          : { id: who.user.id, role: "member" },
        body.request,
        command,
      );
    } catch (error) {
      if (command.kind === "buy-pack" && error instanceof CreditsRejected) {
        const category = /Insufficient/.test(error.message)
          ? "FUNDS"
          : /supply/.test(error.message)
            ? "SUPPLY"
            : /configuration|unavailable|retired/.test(error.message)
              ? "CONFIGURATION"
              : "TRANSACTION";
        await sql`insert into credits_sandbox.pack_failures(member,request,product,category) values(${who.user.id},${body.request},${command.product},${category})`;
      }
      throw error;
    }
  }
  const { s, hidden } = await sql.begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select pg_advisory_xact_lock(71820342)`;
    const [access] =
      await tx`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled and beta_private.admitted(user_id)`;
    if (!access || (access.kind === "owner" && who.aal !== "aal2"))
      throw Error("Admission revoked");
    const s = await new CreditsSandboxStore(tx as unknown as typeof sql).read();
    await refreshEconomyCatalogue(tx, s);
    assertMemberTestEconomy(s);
    return { s, hidden: await hiddenMarketCards(tx, s, who.user.id) };
  });
  if (command?.kind === "open-pack")
    result = testReceipt(s, command.entitlement, who.user.id);
  return {
    s,
    hidden,
    member: who.user.id,
    peers: peers.map((p) => ({ id: String(p.id), label: String(p.label) })),
    isOwner,
    result,
    sql,
    who,
  };
}
export async function memberTestWallet(input?: unknown) {
  const { s, hidden, member, peers, isOwner, result, sql } =
    await memberTestSource(input);
  const view = memberTestView(s, member, peers, isOwner, Date.now(), hidden);
  if (isOwner)
    view.failures = (
      await sql`select request,product,category,recorded_at from credits_sandbox.pack_failures order by recorded_at desc limit 100`
    ).map((r) => ({
      request: String(r.request),
      product: String(r.product),
      category: String(r.category),
      recordedAt: new Date(r.recorded_at).toISOString(),
    }));
  return { state: view, result };
}
