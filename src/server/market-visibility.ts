import "server-only";
import type { TransactionSql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";

/** The caller supplies authenticated claims on this transaction. Never return
 * the aggregate or another member's ownership list to the browser. */
export async function hiddenMarketCards(
  tx: TransactionSql,
  state: CreditsState,
  member: string,
) {
  const hidden: string[] = [];
  const listings = Object.values(state.listings)
    .map((l) => ({ card: l.card, member: state.commerce.cards[l.card]?.owner }))
    .filter((l) => l.member && l.member !== member);
  for (const owner of new Set(listings.map((l) => l.member))) {
    if (!owner) continue;
    const cards = listings
      .filter((l) => l.member === owner)
      .map((l) => ({ id: l.card }));
    const [v] =
      await tx`select private.social_collection_cards(${owner}::uuid,${tx.json(cards)}) cards`;
    const visible = new Set((v?.cards ?? []).map((c: { id: string }) => c.id));
    hidden.push(...cards.filter((c) => !visible.has(c.id)).map((c) => c.id));
  }
  return hidden;
}
