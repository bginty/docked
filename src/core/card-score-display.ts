import { rarityPoints } from "./card-rarity";
export const formatBasePoints = (centipoints: number | null) =>
  centipoints === null ? "—" : (centipoints / 100).toFixed(2);
export const adjustedCardPoints = (base: number | null, multiplier: number) =>
  base === null ? null : rarityPoints(base, Math.round(multiplier * 10));
