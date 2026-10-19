import { rarityRule } from "./card-rarity";
export type ExportCard = {
  id: string;
  player_id: string;
  name: string;
  sport: string;
  team: string;
  position: string;
  tier: string;
  serial: number | null;
  max_supply: number | null;
  season: string;
  edition_id: string;
  acquired_at: string | null;
  listing_price: number | null;
};
export const collectionCsvColumns = [
  "card_instance_id",
  "player_id",
  "player_name",
  "sport",
  "team",
  "position",
  "rarity",
  "rarity_multiplier",
  "serial_number",
  "supply_cap",
  "season",
  "edition_id",
  "acquired_at_utc",
  "active_listing",
  "asking_price_credits",
];
/** Excel treats whitespace/control-prefixed formula characters as executable too. */
export function csvCell(value: string | number | null) {
  let s = value === null ? "" : String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/u.test(s))
    s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function collectionCsv(cards: ExportCard[]) {
  const rows = [collectionCsvColumns.map(csvCell).join(",")];
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.id)) throw Error("Duplicate card in collection export");
    seen.add(c.id);
    const rarity = rarityRule(c.tier);
    rows.push(
      [
        c.id,
        c.player_id,
        c.name,
        c.sport,
        c.team,
        c.position,
        rarity.label,
        rarity.multiplierTenths / 10,
        c.tier === "CORE" ? null : c.serial,
        c.tier === "CORE" ? null : c.max_supply,
        c.season,
        c.edition_id,
        c.acquired_at ? new Date(c.acquired_at).toISOString() : null,
        c.listing_price === null ? "No" : "Yes",
        c.listing_price,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}
