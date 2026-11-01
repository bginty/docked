import { z } from "zod";
import { rarityRule } from "./card-rarity";
import type { AwardedCard } from "./pack-opening";
export function commercialSurfaceEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.DOCKED_COMMERCIAL_SERVICE === "true" &&
    env.DOCKED_COMMERCIAL_SURFACES === "true" &&
    env.DOCKED_BETA_STAGING !== "true"
  );
}
export const commercialCardSnapshot = z.object({
  name: z.string().trim().min(1).max(120),
  team: z.string().trim().min(1).max(120),
  position: z.string().trim().min(1).max(40),
  season: z.string().trim().min(1).max(80),
  verifiedJerseyNumber: z.number().int().min(0).max(99).nullable(),
  colour: z.string().regex(/^#[a-f0-9]{6}$/i),
  accentColour: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .optional(),
  status: z.enum(["active", "inactive", "injured"]),
  synthetic: z.boolean(),
});
export function commercialCard(
  row: {
    id: string;
    definition: string;
    serial: number;
    sport: "nfl" | "afl" | "nrl";
    player_id: string;
    rarity: string;
    lifetime_cap: number;
    snapshot: unknown;
  },
  transfers = false,
): AwardedCard {
  const s = commercialCardSnapshot.parse(row.snapshot);
  const rule = rarityRule(row.rarity);
  return {
    ...s,
    id: row.id,
    edition_id: row.definition,
    serial: row.serial,
    sport: row.sport,
    player_id: row.player_id,
    tier: row.rarity as AwardedCard["tier"],
    max_supply: row.lifetime_cap,
    kind: "regular",
    edition_team: s.team,
    shirt: 0,
    tradeable: transfers,
    status: s.status,
    multiplier: rule.multiplierTenths / 10,
    artworkVersion: "afl-owner-2026-10-24-v1",
  };
}
