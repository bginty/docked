import configuration from "../../config/card-rarities-v1.json";
export const rarityConfiguration = configuration;
export type Rarity = keyof typeof configuration.rarities;
export const rarities = Object.keys(configuration.rarities) as Rarity[];
export const limitedRarities: Rarity[] = rarities.filter((r) => r !== "CORE");
export function rarityRule(rarity: string) {
  if (!Object.hasOwn(configuration.rarities, rarity))
    throw Error("Unknown rarity");
  return configuration.rarities[rarity as Rarity];
}
export function rarityLabel(rarity: string) {
  return rarityRule(rarity).label;
}
/** Integer arithmetic, ties away from zero. Round once after the complete base total. */
export function rarityPoints(
  baseCentipoints: number,
  multiplierTenths: number,
) {
  if (
    !Number.isSafeInteger(baseCentipoints) ||
    !Number.isInteger(multiplierTenths) ||
    multiplierTenths < 10 ||
    multiplierTenths > 15
  )
    throw Error("Invalid rarity score");
  const n = BigInt(baseCentipoints) * BigInt(multiplierTenths);
  return Number((n < 0n ? -1n : 1n) * (((n < 0n ? -n : n) + 5n) / 10n));
}
