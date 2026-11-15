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
  const hidden: string[] = state.economy
    ? Object.keys(state.commerce.cards).filter(
        (id) => !state.economy!.instances[id],
      )
    : [];
  const listings = Object.values(state.listings)
    .map((l) => ({ card: l.card, member: state.commerce.cards[l.card]?.owner }))
    .filter((l) => l.member && l.member !== member);
  // Evaluate the same permission function under the same authenticated
  // transaction snapshot, with one database round trip instead of one per card.
  const unique = [...new Map(listings.map((l) => [l.card, l])).values()];
  if (unique.length) {
    const checks = await tx`select x.card,
      credits_sandbox.market_card_visible(x.member,x.card) allowed
      from jsonb_to_recordset(${tx.json(unique)}) x(card text,member uuid)`;
    for (const card of checks) if (!card.allowed) hidden.push(card.card);
  }
  return hidden;
}
