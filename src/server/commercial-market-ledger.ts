import type { Sql } from "postgres";
import { CommercialLedger } from "./commercial-ledger";
import { commercialMarketEnvelope } from "../core/commercial-market-command";
import { commercialCard } from "../core/commercial-presentation";
import { commercialSports, integer } from "../core/commercial-billing";
import { sellerQuote, saleFeePolicy } from "../core/credits-policy";
import { digest } from "../core/scoring-engine";

type Access = {
  tradingEnabled: boolean;
  /** Recheck verified session and set its claims on this exact transaction. */
  actor(tx: Sql): Promise<void>;
  /** Both parties' live eligibility and block visibility, evaluated in SQL. */
  party(tx: Sql, member: string): Promise<void>;
};
export class CommercialMarketRejected extends Error {}

/** Fixed-price operations share the existing ledger and refund provenance.
 * Every request, quote and settlement receipt is immutable and account-bound. */
export class CommercialMarketLedger extends CommercialLedger {
  async command(member: string, input: unknown, access: Access) {
    const envelope = commercialMarketEnvelope.parse(input);
    const command = envelope.command,
      reference = `market:${envelope.request}`,
      commandDigest = digest(command);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await tx`select pg_advisory_xact_lock(71820342)`;
      await access.actor(tx);
      const [prior] =
        await tx`select details from commercial_billing.audit where actor=${member} and action='market-request' and reference=${reference}`;
      if (prior) {
        if (prior.details.commandDigest !== commandDigest)
          throw new CommercialMarketRejected(
            "This request was already used for different listing details.",
          );
        return prior.details.result as Record<string, any>;
      }
      // Owner cancellations and confirmed receipts remain possible after an
      // emergency sales stop. No new purchase/listing/price change is admitted.
      if (command.kind !== "cancel-listing" && !access.tradingEnabled)
        throw new CommercialMarketRejected(
          "Card sales are temporarily unavailable.",
        );
      await this.control(
        tx,
        command.kind === "cancel-listing" ? undefined : "transfers_enabled",
      );
      await access.party(tx, member);
      if (command.kind !== "cancel-listing") await this.noHold(tx, member);
      let result: Record<string, any>;
      if (command.kind === "list") {
        await this.accounts(tx, [member]);
        const [card] =
          await tx`select c.id,d.sport from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack where c.id=${command.card} and c.owner_id=${member} and not c.locked and p.opened_at is not null for update of c`;
        if (!card || !commercialSports.includes(card.sport))
          throw new CommercialMarketRejected(
            "Only an owned, opened commercial card can be listed.",
          );
        if (
          (
            await tx`select id from commercial_billing.listings where card=${command.card} and state='OPEN'`
          ).length
        )
          throw new CommercialMarketRejected("This card is already listed.");
        const [row] =
          await tx`insert into commercial_billing.listings(card,seller,price) values(${command.card},${member},${command.price}) returning id,revision`;
        result = {
          listing: row.id,
          card: command.card,
          status: "OPEN",
          revision: row.revision,
          ...sellerQuote(command.price),
        };
      } else {
        const [listing] =
          await tx`select * from commercial_billing.listings where id=${command.listing} for update`;
        if (!listing)
          throw new CommercialMarketRejected("Listing unavailable.");
        if (
          command.kind === "cancel-listing" ||
          command.kind === "reprice-listing"
        ) {
          if (listing.seller !== member)
            throw new CommercialMarketRejected(
              "Only the seller can change this listing.",
            );
          if (
            listing.state !== "OPEN" ||
            (command.expectedRevision !== undefined &&
              command.expectedRevision !== listing.revision)
          )
            throw new CommercialMarketRejected(
              "Listing changed; refresh its current details.",
            );
          if (command.kind === "cancel-listing") {
            await tx`update commercial_billing.listings set state='CANCELLED' where id=${listing.id}`;
            result = {
              listing: listing.id,
              card: listing.card,
              status: "CANCELLED",
              revision: listing.revision,
            };
          } else {
            const [owned] =
              await tx`select id from commercial_billing.cards where id=${listing.card} and owner_id=${member} and not locked for update`;
            if (!owned) throw new CommercialMarketRejected("Card unavailable.");
            await tx`update commercial_billing.listings set price=${command.price},revision=revision+1 where id=${listing.id}`;
            result = {
              listing: listing.id,
              card: listing.card,
              status: "OPEN",
              revision: listing.revision + 1,
              ...sellerQuote(command.price),
            };
          }
        } else {
          if (listing.seller === member || listing.state !== "OPEN")
            throw new CommercialMarketRejected(
              "Listing is no longer available for purchase.",
            );
          await access.party(tx, listing.seller);
          await this.noHold(tx, listing.seller);
          const [card] =
            await tx`select c.id,c.definition,c.serial,d.player_id,d.sport,d.rarity,d.lifetime_cap,d.snapshot from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack where c.id=${listing.card} and c.owner_id=${listing.seller} and not c.locked and p.opened_at is not null for update of c`;
          if (!card || !commercialSports.includes(card.sport))
            throw new CommercialMarketRejected("Card unavailable.");
          const snapshot = commercialCard(
            { ...card, serial: integer(card.serial) } as Parameters<
              typeof commercialCard
            >[0],
            false,
          );
          const quote = sellerQuote(integer(listing.price));
          if (command.kind === "review-buy") {
            result = {
              review: envelope.request,
              listing: listing.id,
              card: listing.card,
              revision: listing.revision,
              ...quote,
              expires: Date.now() + 5 * 60000,
              cardSnapshot: snapshot,
            };
          } else {
            const [review] =
              await tx`select details from commercial_billing.audit where actor=${member} and action='market-request' and reference=${"market:" + command.review}`;
            const accepted = review?.details.result;
            if (
              review?.details.kind !== "review-buy" ||
              accepted?.listing !== listing.id ||
              accepted.card !== listing.card ||
              accepted.revision !== listing.revision ||
              accepted.price !== quote.price ||
              accepted.policy !== saleFeePolicy ||
              command.policy !== saleFeePolicy ||
              command.expectedPrice !== quote.price ||
              !Number.isSafeInteger(accepted.expires) ||
              accepted.expires <= Date.now() ||
              digest(accepted.cardSnapshot) !== digest(snapshot)
            )
              throw new CommercialMarketRejected(
                "Purchase review changed or expired; review the current listing again.",
              );
            const sale = await this.settleListing(
              tx,
              member,
              listing.id,
              quote.price,
              listing.revision,
              async (transaction) => access.actor(transaction),
            );
            const [settled] =
              await tx`select sold_at from commercial_billing.listings where id=${listing.id}`;
            result = {
              listing: listing.id,
              card: listing.card,
              status: "SOLD",
              ...sale,
              receipt: {
                reference: "sale:" + listing.id,
                at: new Date(settled.sold_at).getTime(),
                ...quote,
                cardSnapshot: snapshot,
              },
            };
          }
        }
      }
      await this.audit(tx, member, "market-request", reference, {
        kind: command.kind,
        commandDigest,
        result,
        policy: saleFeePolicy,
      });
      return result;
    });
  }
}
