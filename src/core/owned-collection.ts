import { z } from "zod";
import type { AwardedCard } from "./pack-opening";
export const collectionSports = ["nfl", "basketball", "afl", "nrl"] as const;
export const collectionRarities = [
  "CORE",
  "RARE",
  "ELITE",
  "ULTRA_RARE",
  "LEGENDARY",
  "ICON",
] as const;
export const collectionPageSize = 18;
export const collectionQuery = z
  .object({
    sport: z.enum(collectionSports).default("nfl"),
    rarity: z.enum(["ALL", ...collectionRarities]).default("ALL"),
    search: z.string().trim().max(80).default(""),
    team: z.string().max(120).default(""),
    position: z.string().max(40).default(""),
    sort: z.enum(["recent", "rarity", "name", "serial"]).default("recent"),
    cursor: z.string().max(600).optional(),
  })
  .strict();
export type CollectionQuery = z.infer<typeof collectionQuery>;
export type CollectionCard = AwardedCard & {
  canonical_player_id?: string;
  inventory: "collectible" | "beta";
  acquired_at: string | null;
};
export type CollectionPage = {
  member: string;
  sport: CollectionQuery["sport"];
  cards: CollectionCard[];
  total: number;
  filtered: number;
  counts: Partial<Record<(typeof collectionRarities)[number], number>>;
  teams: string[];
  positions: string[];
  revision: string;
  next: string | null;
  changed?: boolean;
};
export const rarityLabel = (value: string) =>
  value === "ALL"
    ? "All"
    : value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
