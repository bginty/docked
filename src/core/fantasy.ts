import { z } from "zod";
import { previewDatabaseBound, dockedPreviewOrigin } from "./preview-auth";
export const fantasyTagline = "COLLECT. BUILD. COMPETE.";
export function fantasyEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.FANTASY_CARDS_PREVIEW === "true" &&
    env.APP_ENV === "preview" &&
    env.SUPABASE_ENV === "preview" &&
    env.DOCKED_HOSTED_PRODUCTION !== "true" &&
    env.VERCEL_ENV !== "production"
  );
}
export function assertFantasyEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  if (!fantasyEnabled(env)) throw Error("Fantasy Preview disabled");
  const auth = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const db = new URL(env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"];
  if (
    !(local.includes(auth.hostname) && local.includes(db.hostname)) &&
    !(auth.origin === dockedPreviewOrigin && previewDatabaseBound(env))
  )
    throw Error("Isolated Preview database required");
}
const uuid = z.string().uuid();
const ids = z.array(uuid).min(1).max(30);
const eventStats = z
  .object({
    minutes: z.number().int().min(0).max(130),
    goals: z.number().int().min(0).max(30),
    assists: z.number().int().min(0).max(30),
    conceded: z.number().int().min(0).max(30),
    saves: z.number().int().min(0).max(100),
    yellow: z.number().int().min(0).max(2),
    red: z.number().int().min(0).max(1),
    own_goals: z.number().int().min(0).max(10),
  })
  .strict();
const point = z.number().int().min(-100).max(100);
const byPosition = z
  .object({ GK: point, DEF: point, MID: point, FWD: point })
  .strict();
const scoringRules = z
  .object({
    appearance: point,
    sixty_minutes: point,
    goal: byPosition,
    assist: point,
    clean_sheet: byPosition,
    save_group: z.number().int().min(1).max(100),
    save_points: point,
    yellow: point,
    red: point,
    own_goal: point,
    conceded_group: z.number().int().min(1).max(100),
    conceded_points: point,
  })
  .strict();
const rules = z
  .object({
    positions: z.record(z.string(), z.number().int().min(0).max(30)).optional(),
    duplicates: z.boolean().optional(),
    tier_max: z
      .partialRecord(
        z.enum(["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"]),
        z.number().int().min(0).max(30),
      )
      .optional(),
    core_min: z.number().int().min(0).max(11).optional(),
    first_year_min: z.number().int().min(0).max(11).optional(),
  })
  .strict();
export const fantasyAction = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("claim_starter"),
      payload: z.object({}).strict(),
    }),
    z.object({
      action: z.literal("buy_pack"),
      payload: z.object({ definition_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("open_pack"),
      payload: z.object({ pack_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("list"),
      payload: z
        .object({ card_id: uuid, price: z.number().int().min(1).max(1e9) })
        .strict(),
    }),
    z.object({
      action: z.enum(["buy", "cancel_listing"]),
      payload: z.object({ listing_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("offer_trade"),
      payload: z.object({ recipient: uuid, give: ids, receive: ids }).strict(),
    }),
    z.object({
      action: z.enum(["accept_trade", "decline_trade", "cancel_trade"]),
      payload: z.object({ trade_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("save_lineup"),
      payload: z.object({ competition_id: uuid, cards: ids }).strict(),
    }),
    z.object({
      action: z.literal("admin_credit"),
      payload: z
        .object({ user_id: uuid, amount: z.number().int().min(1).max(1e6) })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_status"),
      payload: z
        .object({
          player_id: uuid,
          status: z.enum([
            "active",
            "injured",
            "suspended",
            "unavailable",
            "dropped",
            "retired",
            "delisted",
          ]),
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_replacement"),
      payload: z.object({ card_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("admin_simulate"),
      payload: z
        .object({
          competition_id: uuid,
          seed: z.number().int().min(0).max(2147483647),
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_competition"),
      payload: z
        .object({
          name: z.string().min(2).max(80),
          season: z.string().min(1).max(20),
          round: z.number().int().min(1).max(1000),
          locks_at: z.iso.datetime(),
          scoring_version: z.string().min(1).max(80).optional(),
          rules,
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_player"),
      payload: z
        .object({
          name: z.string().min(2).max(80),
          sport: z.literal("football"),
          position: z.enum(["GK", "DEF", "MID", "FWD"]),
          team: z.string().min(2).max(80),
          colour: z.string().regex(/^#[0-9a-f]{6}$/i),
          shirt: z.number().int().min(1).max(99),
          first_season: z.string().min(1).max(20),
          prospect_rank: z.number().int().min(1).max(10000),
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_edition"),
      payload: z
        .object({
          player_id: uuid,
          tier: z.enum(["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"]),
          season: z.string().min(1).max(20),
          kind: z.enum(["first_year", "regular", "special"]),
          max_supply: z.number().int().min(1).max(1000000),
          prospect_rank: z.number().int().min(1).max(10000),
          launch_at: z.iso.datetime(),
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_lock_edition"),
      payload: z.object({ edition_id: uuid }).strict(),
    }),
    z.object({
      action: z.literal("admin_pack"),
      payload: z
        .object({
          name: z
            .string()
            .min(2)
            .max(80)
            .refine((n) => !["Starter", "Replacement"].includes(n)),
          version: z.number().int().min(1),
          slots: z
            .array(z.enum(["ANY", "GK", "DEF", "MID", "FWD"]))
            .min(1)
            .max(30),
          pool: ids,
          weights: z.partialRecord(
            z.enum(["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"]),
            z.number().min(0).max(100),
          ),
          guarantees: z.record(
            z.string().regex(/^\d+$/),
            z.enum(["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"]),
          ),
          price: z.number().int().min(0).max(1e6),
          max_quantity: z.number().int().min(1).max(1000),
          tradeable: z.boolean(),
          starts_at: z.iso.datetime(),
          ends_at: z.iso.datetime(),
        })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_fee"),
      payload: z
        .object({ fee_bps: z.number().int().min(0).max(10000) })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_stats"),
      payload: z
        .object({ competition_id: uuid, player_id: uuid, stats: eventStats })
        .strict(),
    }),
    z.object({
      action: z.literal("admin_scoring"),
      payload: z
        .object({ version: z.string().min(2).max(80), rules: scoringRules })
        .strict(),
    }),
  ])
  .and(z.object({ request_id: uuid }));
export type FantasyCard = {
  id: string;
  edition_id: string;
  owner_id: string;
  serial: number;
  tradeable: boolean;
  created_at: string;
  acquired_at: string;
  name: string;
  position: string;
  tier: string;
  season: string;
  kind: string;
  max_supply: number;
  player_id: string;
  team: string;
  colour: string;
  shirt: number;
  status: string;
  sport: string;
  listed: boolean;
};
export type FantasyCompetition = {
  id: string;
  name: string;
  season: string;
  round: number;
  locks_at: string;
  scored_at: string | null;
  rules: Record<string, unknown>;
};
export type FantasyState = {
  user_id: string;
  credits: number;
  admin: boolean;
  fee_bps: number;
  catalog: {
    players: { id: string; name: string }[];
    editions: {
      id: string;
      tier: string;
      player_id: string;
      max_supply: number;
      status: string;
    }[];
    replacements: {
      card_id: string;
      user_id: string;
      pack_id: string | null;
    }[];
    sales: unknown[];
    ownership: unknown[];
  } | null;
  cards: FantasyCard[];
  packs: {
    id: string;
    name: string;
    opened_at: string | null;
    cards: string[] | null;
  }[];
  shop: {
    id: string;
    name: string;
    price: number;
    slots: string[];
    weights: Record<string, number>;
    guarantees: Record<string, string>;
    sold: number;
    max_quantity: number;
  }[];
  market: {
    id: string;
    card_id: string;
    seller: string;
    price: number;
    fee_bps: number;
    name: string;
    tier: string;
    serial: number;
    max_supply: number;
    position: string;
    season: string;
    kind: string;
    status: string;
  }[];
  trades: {
    id: string;
    sender: string;
    recipient: string;
    state: string;
    expires_at: string;
    items: { card_id: string; from_user: string }[];
  }[];
  competitions: FantasyCompetition[];
  entries: { competition_id: string; cards: string[] }[];
  results: {
    competition_id: string;
    user_id: string;
    score: number;
    rank: number;
    championship_points: number;
  }[];
  ledger: { id: string; amount: number; reason: string; created_at: string }[];
  provenance: {
    id: string;
    card_id: string;
    from_user: string | null;
    to_user: string;
    reason: string;
    created_at: string;
  }[];
  members: { id: string; name: string }[];
  replacements: { card_id: string; user_id: string; pack_id: string | null }[];
};
