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
  // Legacy synthetic inventory has no canonical player/card instance. Keep its
  // receipts and balances, but never offer it as a public collectible.
  const hidden: string[] = state.economy ? Object.keys(state.commerce.cards).filter((id)=>!state.economy!.instances[id]) : [];
  const listings = Object.values(state.listings)
    .map((l) => ({ card: l.card, member: state.commerce.cards[l.card]?.owner }))
    .filter((l) => l.member && l.member !== member);
  for (const owner of new Set(listings.map((l) => l.member))) {
    if (!owner) continue;
    const cards = listings
      .filter((l) => l.member === owner)
      .map((l) => ({ id: l.card }));
    for (const card of cards) {
      const [v] =
        await tx`select credits_sandbox.market_card_visible(${owner}::uuid,${card.id}) allowed`;
      if (!v?.allowed) hidden.push(card.id);
    }
  }
  return hidden;
}
