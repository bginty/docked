import { z } from "zod";
import { feedSport } from "./multisport-delivery";
const count = z.number().int().nonnegative();
const time = z.number().finite().nonnegative().nullable();
export const ingestionStatus = z.object({
  sport: feedSport,
  provider: z.string().optional(),
  activation: z.string(),
  last_source_success: time,
  last_delivery: time,
  last_attempt: time.optional(),
  next_sync: time,
  games_imported: count,
  player_records: count,
  missing_mappings: count,
  invalid_records: count,
  errors: count,
  blocked_jobs: count,
  changed_records: count,
  last_error: z.string().nullable().optional(),
  scoring_publication: z.string(),
  licence_status: z.string().optional(),
  licence_expires_at: time.optional(),
  source_environment: z.string().nullable().optional(),
  worker_heartbeat: time.optional(),
  fixtures_total: count.optional(),
  fixtures_complete: count.optional(),
  mapped_players: count.optional(),
  players_total: count.optional(),
  complete_player_records: count.optional(),
  corrections: count.optional(),
  overdue_jobs: count.optional(),
});
export const ingestionHealth = z
  .object({
    schema_version: z.literal("1.1"),
    synthetic: z.boolean(),
    dataset_id: z.uuid(),
    feed_mode: z.literal("postgame"),
    data: z.array(ingestionStatus).max(4),
  })
  .refine(
    (p) => new Set(p.data.map((s) => s.sport)).size === p.data.length,
    "Duplicate sport health",
  );
export const ingestionJobs = z.object({
  data: z
    .array(
      z.object({
        id: z.string().max(200),
        kind: z.string(),
        state: z.string(),
        due: z.number().finite(),
        attempts: count,
        last_error: z.string().nullable(),
      }),
    )
    .max(500),
});
export type IngestionHealth =
  | { state: "disabled" }
  | { state: "unavailable" }
  | ({ state: "connected" } & z.infer<typeof ingestionHealth>);
export type IngestionJobs = z.infer<typeof ingestionJobs>["data"];
const diagnosticId = z.string().max(500);
export const ingestionDiagnostics = z.object({
  schema_version: z.literal("1.1"),
  synthetic: z.boolean(),
  dataset_id: z.uuid(),
  data: z.object({
    coverage: z
      .array(
        z.object({
          sport: feedSport,
          season: z.string(),
          fixtures: count,
          imported: count,
          complete: count,
          first_kickoff: time,
          last_kickoff: time,
          last_success: time,
        }),
      )
      .max(50),
    reviews: z
      .array(
        z.object({
          id: count,
          sport: feedSport,
          provider: diagnosticId,
          external_id: diagnosticId,
          reason: diagnosticId,
          created_at: time,
        }),
      )
      .max(50),
    failures: z
      .array(
        z.object({
          id: count,
          sport: feedSport,
          provider: diagnosticId,
          fixture: diagnosticId.nullable(),
          reason: diagnosticId,
          created_at: time,
        }),
      )
      .max(50),
    corrections: z
      .array(
        z.object({
          seq: count,
          sport: feedSport,
          entity: diagnosticId,
          kind: z.enum(["player_game", "removal"]),
          revision: count,
        }),
      )
      .max(50),
    audit: z
      .array(
        z.object({
          id: count,
          at: time,
          actor: diagnosticId,
          action: z.enum([
            "multisport.retry",
            "multisport.mapping",
            "multisport.backfill",
            "multisport.season_changed",
          ]),
        }),
      )
      .max(50),
    truncated: z
      .array(
        z.enum(["coverage", "reviews", "failures", "corrections", "audit"]),
      )
      .max(5),
  }),
});
export type IngestionDiagnostics = z.infer<typeof ingestionDiagnostics>;
