import type { FantasyCard } from "./fantasy";

/** Presentation-only receipt. No owner identifiers or allocation instructions. */
export type AwardedCard = Pick<
  FantasyCard,
  | "id"
  | "edition_id"
  | "serial"
  | "name"
  | "position"
  | "tier"
  | "season"
  | "kind"
  | "max_supply"
  | "player_id"
  | "team"
  | "edition_team"
  | "colour"
  | "shirt"
  | "status"
  | "sport"
  | "tradeable"
> & { rarity_version?: string; multiplier?: number; presentation?: string };
export type PackReceipt = {
  id: string;
  name: string;
  opened_at: string;
  cards: AwardedCard[];
};

export function packRevealPreview(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.DOCKED_PACK_REVEAL_PREVIEW === "true" &&
    (env.VERCEL_ENV === "preview" ||
      (!env.VERCEL && env.NODE_ENV === "development"))
  );
}
/** Only an index is stored on this device. Server receipts always determine cards/order. */
export function revealKey(user: string, receipt: PackReceipt) {
  return `docked:reveal:v1:${user}:${receipt.id}:${receipt.cards.map((c) => c.id).join(",")}`;
}
export function revealIndex(raw: string | null, count: number) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && value <= count
    ? value
    : 0;
}
