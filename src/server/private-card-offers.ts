import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import {
  assertBetaTrade,
  betaTradingAccess,
  recordTradingFailure,
} from "./beta-trading";
import { reviewedBetaTrading, tradingCommandMode } from "../core/beta-trading";
import { requireCommunityAccess } from "./community-policy";
import {
  setCommunityClaims,
  enqueueCommunityNotification,
} from "./community-social";
import { CreditsSandboxStore, CreditsRejected } from "./credits-sandbox-store";
import {
  executePrivateOffer,
  privateOfferCommand,
  privateOfferEnabled,
  effectiveOfferStatus,
  privateOfferQuote,
  type OfferPermission,
} from "../core/private-card-offers";
import { assertMemberTestEconomy, testCard } from "../core/member-test-wallet";
import { refreshEconomyCatalogue } from "./economy-catalogue";
import type { TransactionSql } from "postgres";
import { swapFeeQuote } from "../core/credit-only";
import { marketplaceView, marketQuery } from "../core/marketplace";

export async function privateOffers(
  input?: unknown,
  inventoryQuery: { q?: string; inventoryPage?: string } = {},
) {
  const query = marketQuery.parse({ tab: "listings", ...inventoryQuery });
  const who = await requireIdentity();
  await requireCommunityAccess("community_social");
  const enabled =
    privateOfferEnabled(process.env) || reviewedBetaTrading(process.env);
  if (!enabled) {
    if (input)
      throw new CreditsRejected("Private offers await beta trading approval");
    return {
      enabled: false,
      offers: [],
      inventory: [],
      inventoryTotal: 0,
      inventoryPage: 0,
      member: who.user.id,
      combinedEnabled: false,
      swapFee: null,
    };
  }
  if (
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    throw new CreditsRejected("Isolated beta required");
  const body =
    input === undefined
      ? null
      : z
          .object({ request: z.string().uuid(), command: privateOfferCommand })
          .strict()
          .parse(input);
  let permission: OfferPermission = { allowed: false, minimum: null };
  const sql = db();
  if (body && !(await rateLimit(`private-trade:${who.user.id}`, 40, 60)))
    throw new CreditsRejected("Please wait before another request");
  const [access] =
    await sql`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled and beta_private.admitted(user_id)`;
  if (!access || (access.kind === "owner" && who.aal !== "aal2"))
    throw new CreditsRejected("Admission or MFA required");
  const store = new CreditsSandboxStore(
    sql,
    async (tx, state) => {
      await setCommunityClaims(tx as unknown as TransactionSql, who);
      await tx`select private.community_actor(${who.user.id},'community_social',true)`;
      assertMemberTestEconomy(state);
      await refreshEconomyCatalogue(tx, state);
      const cmd = body?.command;
      const offer =
        cmd && cmd.kind !== "private-offer"
          ? state.privateCardOffers?.[cmd.offer]
          : null;
      const card = cmd?.kind === "private-offer" ? cmd.card : offer?.card;
      const seller =
        cmd?.kind === "private-offer"
          ? state.commerce.cards[cmd.card]?.owner
          : offer?.seller;
      const buyer = cmd?.kind === "private-offer" ? who.user.id : offer?.buyer;
      const mode =
        cmd?.kind === "private-accept" && offer
          ? tradingCommandMode({
              kind: "private-offer",
              price: offer.price,
              offeredCards: offer.offeredCards,
            })
          : cmd && tradingCommandMode(cmd);
      if (mode)
        await assertBetaTrade(tx, mode, [
          who.user.id,
          ...[seller, buyer].filter((id): id is string => !!id),
        ]);
      for (const member of new Set(
        (cmd?.kind === "private-cancel" || cmd?.kind === "private-decline"
          ? [who.user.id]
          : [who.user.id, seller, buyer]
        ).filter((id): id is string => !!id),
      )) {
        const rows =
          await tx`select kind from credits_sandbox.access where user_id=${member}::uuid and enabled and beta_private.admitted(user_id)`;
        if (
          !rows.length ||
          (member === who.user.id &&
            rows[0].kind === "owner" &&
            who.aal !== "aal2")
        )
          throw new CreditsRejected("Admission or MFA required");
      }
      if (cmd?.kind === "private-offer") {
        const [locks] =
          await tx`select credits_sandbox.market_context(${who.user.id}::uuid) context`;
        if (
          [cmd.card, ...(cmd.offeredCards ?? [])].some((id) =>
            locks.context.reserved.includes(id),
          )
        )
          throw new CreditsRejected("Card unavailable for transfer");
      }
      if (seller && buyer && card) {
        const [p] =
          await tx`select prefs.*,sp.id seller_profile,bp.id buyer_profile,
       private.social_profile_visible(bp.id,sp.id,true) visible,
       exists(select 1 from private.social_follows where actor_id=bp.id and target_id=sp.id) following
       from private.social_profiles sp join private.social_profiles bp on bp.user_id=${buyer}::uuid
       left join private.social_collection_settings prefs on prefs.profile_id=sp.id where sp.user_id=${seller}::uuid and bp.status='active' and sp.status='active'`;
        const per = p?.card_preferences?.[card];
        const listing = Object.values(state.listings).find(
          (l) => l.card === card && l.status === "OPEN" && !l.privateOffer,
        );
        permission = {
          allowed:
            !!p?.visible &&
            per?.hidden !== true &&
            (p.visibility === "members" ||
              (p.visibility === "followers" && p.following)) &&
            (p.offers === "everyone" ||
              (p.offers === "followers" && p.following)) &&
            (per?.enabled === true || !!listing),
          swaps:
            per?.swaps !== false &&
            (listing
              ? listing.preference === "swap" || listing.preference === "both"
              : per?.swaps === true),
          combinedPolicy: "credit-commission-floor-v1",
          minimum:
            per?.minimum ??
            (p?.minimum_credits === null || p?.minimum_credits === undefined
              ? null
              : Number(p.minimum_credits)),
        };
      }
    },
    undefined,
    async (tx, old, state) => {
      for (const o of Object.values(state.privateCardOffers ?? {})) {
        if (old.privateCardOffers?.[o.id]?.status === o.status) continue;
        if (o.status === "EXPIRED") continue;
        const recipient =
          o.status === "OPEN" || o.status === "CANCELLED" ? o.seller : o.buyer;
        const [p] =
          await tx`select p.id from private.social_profiles p left join private.social_collection_settings s on s.profile_id=p.id where p.user_id=${recipient}::uuid and p.status='active' and not coalesce(s.mute_offers,false)`;
        const [actor] =
          await tx`select id from private.social_profiles where user_id=${who.user.id}::uuid`;
        if (p)
          await enqueueCommunityNotification(tx as unknown as TransactionSql, {
            recipientId: String(p.id),
            actorId: actor?.id ? String(actor.id) : undefined,
            type: "account",
            title: "Your private card offer has an update",
            href: "/profile?tab=offers",
            groupKey: "card-offers",
            dedupeKey: `private-offer:${o.id}:${o.status}`,
          });
      }
    },
    (s, a, r, c, n) => executePrivateOffer(s, a, r, c, n, permission),
  );
  let result: unknown = null;
  if (body) {
    try {
      result = await store.execute(
        { id: who.user.id, role: "member" },
        body.request,
        body.command,
      );
    } catch (error) {
      await recordTradingFailure(sql, who, body.request, error);
      throw error;
    }
  }
  const state = await store.read();
  const profiles =
    await sql`select p.user_id,p.display_name from private.social_profiles p where p.user_id in (select user_id from credits_sandbox.access where enabled)`;
  const offers = Object.values(state.privateCardOffers ?? {})
    .filter((o) => [o.buyer, o.seller].includes(who.user.id))
    .sort((a, b) => b.created - a.created)
    .slice(0, 100)
    .map((o) => ({
      id: o.id,
      counterparty: String(
        profiles.find(
          (p) => p.user_id === (o.seller === who.user.id ? o.buyer : o.seller),
        )?.display_name ?? "Docked member",
      ),
      card: testCard(state, o.card),
      offeredCards: (o.offeredCards ?? []).map((c) => testCard(state, c.id)),
      side: o.seller === who.user.id ? "received" : "sent",
      status: effectiveOfferStatus(o, Date.now()),
      created: o.created,
      expires: o.expires,
      ...privateOfferQuote(o.price, o.feeEach, o.creditFeeMinimum),
      receipt: o.receipt,
      listing: o.listing,
    }));
  const [context] =
    await sql`select credits_sandbox.market_context(${who.user.id}::uuid) context`;
  const inventoryView = marketplaceView(
    state,
    who.user.id,
    [],
    query,
    context.context,
  );
  const trading = await sql.begin(async (tx) => {
    await setCommunityClaims(tx, who);
    return betaTradingAccess(tx as unknown as typeof sql, who.user.id);
  });
  return {
    enabled: trading.offers,
    offers,
    result,
    inventory: inventoryView.inventory,
    inventoryTotal: inventoryView.inventoryTotal,
    inventoryPage: inventoryView.query.inventoryPage,
    member: who.user.id,
    combinedEnabled: trading.combined,
    swapFee: swapFeeQuote(
      state.creditOnly,
      state.policy.swapFeeEach,
      Date.now(),
    ).feeEach,
  };
}
