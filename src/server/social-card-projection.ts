import type { TransactionSql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
import { testCard } from "../core/member-test-wallet";
import { refreshEconomyCatalogue } from "./economy-catalogue";
import type { AwardedCard } from "../core/pack-opening";

/** A projection of existing inventory, never a new collection or issuance path. */
export async function socialInventory(tx: TransactionSql, member: string) {
  const [row] = await tx`select document from credits_sandbox.state where id`;
  const [legacy] =
    await tx`select private.social_legacy_cards(${member}::uuid) cards`;
  const cards = new Map<string, AwardedCard & { offerEligible: boolean }>(
    (legacy?.cards ?? []).map((card: AwardedCard) => [
      card.id,
      { ...card, offerEligible: false },
    ]),
  );
  if (!row) return [...cards.values()];
  const state = row.document as CreditsState;
  await refreshEconomyCatalogue(tx, state);
  const [context] =
    await tx`select credits_sandbox.market_context(${member}::uuid) context`;
  const reserved = new Set<string>(context?.context?.reserved ?? []);
  const now = Date.now();
  for (const id of Object.keys(state.commerce.cards).filter((id) => {
    const instance = state.economy?.instances[id];
    return (
      state.commerce.cards[id].owner === member &&
      state.cards[id] &&
      (!instance || !!state.economy?.packs[instance.source]?.openedAt)
    );
  }))
    cards.set(id, {
      ...testCard(state, id),
      offerEligible:
        state.commerce.cards[id].tier !== "CORE" &&
        !state.cards[id].locked &&
        !state.commerce.cards[id].reserved &&
        !reserved.has(id) &&
        !Object.values(state.listings).some(
          (l) => l.card === id && l.status === "OPEN",
        ) &&
        !Object.values(state.swaps).some(
          (s) =>
            s.status === "OPEN" &&
            s.expires > now &&
            [...s.give, ...s.take].includes(id),
        ),
    });
  const [visible] =
    await tx`select private.social_collection_cards(${member}::uuid,${tx.json([...cards.values()])}) cards`;
  return (visible?.cards ?? []) as (AwardedCard & { offerEligible: boolean })[];
}

export async function snapshotSocialCards(
  tx: TransactionSql,
  member: string,
  ids: string[],
) {
  if (!ids.length) return [];
  // Same order as marketplace/lineup transactions. Ownership remains stable until commit.
  await tx`select pg_advisory_xact_lock(71820342)`;
  const owned = await socialInventory(tx, member);
  return ids.map((id) => {
    const card = owned.find((c) => c.id === id);
    if (!card) throw Error("Only your opened cards can be attached");
    const { offerEligible, ...snapshot } = card;
    void offerEligible;
    return snapshot;
  });
}
