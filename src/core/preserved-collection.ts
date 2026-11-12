import { testCard, type TestCardSource } from "./member-test-wallet";
import type { CollectionCard } from "./owned-collection";

export type PreservedCollectionRow = {
  id: string;
  inventory: CollectionCard["inventory"];
  card?: CollectionCard;
  commerce: TestCardSource["commerce"]["cards"][string];
  instance?: NonNullable<TestCardSource["economy"]>["instances"][string];
  player?: NonNullable<TestCardSource["economy"]>["players"][string];
};

/** Existing entitlements remain recognisable; this never upgrades them to a
 * purchased commercial card or enables a cross-ledger sale. */
export function preservedCollectionCard(
  raw: PreservedCollectionRow,
  acquiredAt: string | null,
): CollectionCard {
  const card =
    raw.card ??
    testCard(
      {
        commerce: { cards: { [raw.id]: raw.commerce } },
        cards: { [raw.id]: true },
        ...(raw.instance && raw.player
          ? {
              economy: {
                instances: { [raw.id]: raw.instance },
                players: { [raw.instance.playerId]: raw.player },
              },
            }
          : {}),
      },
      raw.id,
    );
  return {
    ...card,
    inventory: raw.inventory,
    acquired_at: acquiredAt,
    tradeable: false,
  };
}
