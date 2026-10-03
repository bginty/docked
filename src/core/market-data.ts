import { z } from "zod";
import { validateMarketReferenceConfig } from "./market-reference";

const instant = z.string().datetime({ offset: true });
const evidence = z.string().trim().min(8).max(2000);
const competition = z
  .object({
    providerCompetitionId: z.string().min(1).max(100),
    competitionId: z.enum([
      "soccer_epl",
      "soccer_spain_la_liga",
      "basketball_nba",
      "americanfootball_nfl",
    ]),
    sport: z.enum(["football", "basketball", "nfl"]),
    displayName: z.string().trim().min(1).max(120),
    providerSportId: z.number().int().positive().optional(),
    marketId: z.string().min(1).max(100).optional(),
    outcomes: z
      .record(z.string().min(1), z.enum(["home", "away", "draw"]))
      .optional(),
    mappingEvidence: evidence,
  })
  .strict()
  .refine(
    (c) =>
      c.sport ===
      (c.competitionId === "basketball_nba"
        ? "basketball"
        : c.competitionId === "americanfootball_nfl"
          ? "nfl"
          : "football"),
    "Sport/competition mismatch",
  );
const bookmaker = z
  .object({
    operator: z.string().trim().min(1).max(150),
    ownershipEvidence: evidence,
    sourceType: z.enum(["bookmaker", "exchange"]),
    classification: z.enum([
      "STANDARD_VERIFIED",
      "PROMOTIONAL_EXCLUDED",
      "UNKNOWN_REVIEW",
    ]),
    classificationVersion: z.string().trim().min(1).max(120),
    classificationEvidence: evidence,
    knownAt: instant,
    effectiveFrom: instant,
    effectiveTo: instant,
  })
  .strict()
  .refine(
    (b) => Date.parse(b.effectiveFrom) < Date.parse(b.effectiveTo),
    "Invalid approval interval",
  );
const schema = z
  .object({
    version: z.string().regex(/^market-data-v\d+\.\d+\.\d+$/),
    provider: z.enum(["the-odds-api", "odds-papi"]),
    rights: z
      .object({
        reference: evidence,
        display: z.literal(true),
        storage: z.literal(true),
        derived: z.literal(true),
        rawRetentionDays: z.number().int().min(1).max(30),
      })
      .strict(),
    monthlyCreditLimit: z.number().int().min(1).max(1000000),
    pollIntervalSeconds: z.number().int().min(60).max(86400),
    horizonHours: z.number().int().min(1).max(168),
    maxEvents: z.number().int().min(1).max(100),
    maxRequestsPerRun: z.number().int().min(1).max(20),
    regions: z
      .array(z.enum(["au", "uk", "us", "us2", "eu"]))
      .min(1)
      .max(5),
    competitions: z.array(competition).min(1).max(4),
    bookmakers: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), bookmaker),
    referenceConfiguration: z
      .unknown()
      .optional()
      .transform((v) =>
        v === undefined ? undefined : validateMarketReferenceConfig(v),
      ),
  })
  .strict()
  .refine(
    (c) =>
      new Set(c.regions).size === c.regions.length &&
      new Set(c.competitions.map((x) => x.competitionId)).size ===
        c.competitions.length &&
      new Set(c.competitions.map((x) => x.providerCompetitionId)).size ===
        c.competitions.length,
    "Duplicate provider scope",
  )
  .refine(
    (c) => Object.keys(c.bookmakers).length <= 100,
    "Too many bookmaker mappings",
  );
export type MarketDataConfig = z.infer<typeof schema>;
export function validateMarketDataConfig(value: unknown): MarketDataConfig {
  return schema.parse(value);
}
export function marketDataApprovalActive(
  value: MarketDataConfig["bookmakers"][string],
  at: string,
) {
  const now = Date.parse(at);
  return (
    Number.isFinite(now) &&
    Date.parse(value.knownAt) <= now &&
    Date.parse(value.effectiveFrom) <= now &&
    now < Date.parse(value.effectiveTo)
  );
}
export type ProviderFixture = {
  provider: MarketDataConfig["provider"];
  providerEventId: string;
  providerCompetitionId: string;
  competitionId: string;
  sport: string;
  competition: string;
  participants: [string, string];
  startAt: string;
  status: "scheduled" | "live" | "finished" | "cancelled" | "unknown";
  observedAt: string;
  sourceUpdatedAt: string | null;
};
/** Public factual projection only: no research probability, model price or estimated EV. */
export type MonitoredMarket = {
  eventId: string;
  eventLabel: string;
  sport: string;
  competition: string;
  startAt: string;
  status:
    | ProviderFixture["status"]
    | "manual_review"
    | "rescheduled"
    | "postponed"
    | "abandoned";
  markets: {
    marketId: string;
    label: string;
    referencePrice: string | null;
    sourceAt: string | null;
    observedAt: string | null;
    freshness: "FRESH" | "STALE" | "UNKNOWN";
    standardStatus: "STANDARD_VERIFIED" | "UNKNOWN_REVIEW";
  }[];
};
export type MonitoredMarkets = {
  status: "READY" | "NOT_CONFIGURED" | "DISABLED" | "UNAVAILABLE";
  message: string;
  observedAt: string | null;
  provider: string | null;
  configurationReference?: { version: string; hash: string };
  window: "today" | "upcoming" | "weekend";
  from: string;
  to: string;
  timezone: "UTC";
  events: MonitoredMarket[];
};
export function monitoredWindow(
  window: MonitoredMarkets["window"],
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid observation time");
  const from = new Date(now);
  const to = new Date(now);
  if (window === "today") to.setUTCHours(24, 0, 0, 0);
  else if (window === "upcoming") to.setTime(now.getTime() + 7 * 86400000);
  else {
    const day = now.getUTCDay();
    if (day !== 0 && day !== 6) {
      from.setUTCDate(from.getUTCDate() + ((6 - day + 7) % 7));
      from.setUTCHours(0, 0, 0, 0);
    }
    to.setTime(from.getTime());
    to.setUTCDate(to.getUTCDate() + (to.getUTCDay() === 0 ? 1 : 2));
    to.setUTCHours(0, 0, 0, 0);
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    timezone: "UTC" as const,
  };
}
