import type { AwardedCard } from "./pack-opening";
import { rarities } from "./card-rarity";
/** Historical attachments are self-contained. Never resolve them by caption/name/index. */
export function socialAttachments(raw: unknown): {
  cards: AwardedCard[];
  unavailable: number;
} {
  if (!Array.isArray(raw))
    return { cards: [], unavailable: raw == null ? 0 : 1 };
  const seen = new Set<string>(),
    cards: AwardedCard[] = [];
  let unavailable = 0;
  for (const value of raw) {
    const c = value as AwardedCard | null;
    if (
      !c ||
      typeof c !== "object" ||
      ![
        "id",
        "player_id",
        "edition_id",
        "name",
        "sport",
        "position",
        "team",
      ].every(
        (k) =>
          typeof (c as Record<string, unknown>)[k] === "string" &&
          !!(c as Record<string, unknown>)[k],
      ) ||
      !rarities.includes(c.tier as (typeof rarities)[number]) ||
      seen.has(c.id)
    ) {
      unavailable++;
      continue;
    }
    seen.add(c.id);
    cards.push(c);
  }
  return { cards, unavailable };
}
