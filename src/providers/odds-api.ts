import { z } from "zod";
import Decimal from "decimal.js";
import type {
  OddsProvider,
  Capabilities,
  OddsFetchResult,
  OddsDiagnostics,
  ProviderStatus,
} from "./contracts";
import type { Quote, Rules } from "@/core/pricing";
import { hash, removeMargin, strategyV1 } from "@/core/pricing";
const timestamp = z.string().datetime({ offset: true });
const outcome = z.object({
  name: z.string().min(1),
  price: z.number().finite().gt(1),
});
const event = z.object({
  id: z.string().min(1),
  sport_key: z.string().min(1),
  commence_time: timestamp,
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  bookmakers: z.array(
    z.object({
      key: z.string().min(1),
      last_update: timestamp,
      markets: z.array(
        z.object({
          key: z.string().min(1),
          last_update: timestamp.optional(),
          outcomes: z.array(outcome),
        }),
      ),
    }),
  ),
});
export type Mapping = {
  bookmakers: Record<
    string,
    {
      operator: string;
      approved: boolean;
      evidence?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    }
  >;
  events: Record<string, { rules: Rules; startAt: string }>;
};
export function quotaHeader(headers: Headers, key: string): number | null {
  const raw = headers.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}
export class TheOddsApi implements OddsProvider {
  id = "the-odds-api";
  capabilities: Capabilities = {
    current: true,
    historical: true,
    results: false,
    sourceTimestamps: true,
    marketRules: false,
    liquidity: false,
    limits: false,
    commission: false,
    retention: false,
    display: false,
    export: false,
  };
  get status(): ProviderStatus {
    if (!this.options.key) return "NOT_CONFIGURED";
    return this.options.allowPolling && this.options.rights.trim()
      ? "READY"
      : "DISABLED";
  }
  private budget: number | null;
  private inFlight = false;
  constructor(
    private options: {
      key: string;
      rights: string;
      remaining: number | null;
      regions: string;
      mapping: Mapping;
      allowPolling: boolean;
    },
    private fetcher: typeof fetch = fetch,
    private clock: () => Date = () => new Date(),
  ) {
    this.budget = options.remaining;
  }
  async fetch(sport: string, asOf?: string): Promise<OddsFetchResult> {
    const o = this.options;
    if (this.status !== "READY")
      throw new Error(
        `ODDS_PROVIDER_STATUS=${this.status}; activation/rights pending`,
      );
    const regions = o.regions.split(",").map((v) => v.trim());
    if (
      !regions.length ||
      new Set(regions).size !== regions.length ||
      regions.some((r) => !["us", "us2", "uk", "au", "eu"].includes(r))
    )
      throw new Error("Invalid provider regions");
    if (!strategyV1.competitions.includes(sport))
      throw new Error("Unsupported sport");
    if (
      asOf &&
      (!timestamp.safeParse(asOf).success ||
        Date.parse(asOf) > this.clock().getTime())
    )
      throw new Error("Invalid historical timestamp");
    const forecast = (asOf ? 10 : 1) * regions.length;
    if (this.inFlight)
      throw new Error(
        "Concurrent provider request rejected; use shared quota lease",
      );
    if (
      this.budget === null ||
      !Number.isSafeInteger(this.budget) ||
      this.budget < forecast
    )
      throw new Error("Quota exhausted or unknown");
    // Reserve before any network call. Failures may still be billed; never refund
    // without authoritative headers. Cross-process reservation belongs to DB ingestion.
    this.budget -= forecast;
    this.inFlight = true;
    try {
      const url = new URL(
        `https://api.the-odds-api.com/v4/${asOf ? "historical/" : ""}sports/${sport}/odds`,
      );
      url.search = new URLSearchParams({
        apiKey: o.key,
        regions: regions.join(","),
        markets: "h2h",
        oddsFormat: "decimal",
        ...(asOf ? { date: asOf } : {}),
      }).toString();
      let response: Response;
      try {
        response = await this.fetcher(url, {
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
      } catch {
        throw new Error("Odds provider unavailable");
      }
      const remaining = quotaHeader(response.headers, "x-requests-remaining");
      this.budget = remaining;
      if (!response.ok)
        throw new Error(`Odds provider HTTP ${response.status}`);
      const raw: unknown = await response.json();
      const receivedAt = this.clock().toISOString();
      const archive = asOf
        ? z.object({ timestamp, data: z.array(z.unknown()) }).parse(raw)
        : null;
      const snapshotAt = archive?.timestamp ?? receivedAt;
      if (asOf && Date.parse(snapshotAt) > Date.parse(asOf))
        throw new Error("Historical look-ahead rejected");
      const rawEvents = z.array(z.unknown()).parse(archive?.data ?? raw);
      const stats: OddsDiagnostics = {
        eventsReceived: rawEvents.length,
        marketsReceived: 0,
        validMarkets: 0,
        rejectedMarkets: 0,
        staleMarkets: 0,
        mappingFailures: 0,
        sourceTimestampAgeSeconds: null,
        errors: [],
      };
      const quotes: Quote[] = [];
      const ids = rawEvents
        .map((e) => event.safeParse(e))
        .filter((e) => e.success)
        .map((e) => e.data.id);
      const count = (values: string[], item: string) =>
        values.filter((v) => v === item).length;
      const reject = (code: string, mapping = false) => {
        stats.rejectedMarkets++;
        if (mapping) stats.mappingFailures++;
        if (!stats.errors.includes(code)) stats.errors.push(code);
      };
      for (const item of rawEvents) {
        const parsed = event.safeParse(item);
        if (!parsed.success) {
          stats.mappingFailures++;
          stats.errors.push("invalid_event_payload");
          continue;
        }
        const e = parsed.data;
        stats.marketsReceived += e.bookmakers.reduce(
          (n, b) => n + b.markets.length,
          0,
        );
        const match = o.mapping.events[e.id];
        if (
          count(ids, e.id) !== 1 ||
          !match ||
          e.sport_key !== sport ||
          match.rules.competition !== sport ||
          Date.parse(match.startAt) !== Date.parse(e.commence_time) ||
          hash([...match.rules.participants].sort()) !==
            hash([e.home_team, e.away_team].sort()) ||
          (sport === "basketball_nba"
            ? match.rules.market !== "nba_moneyline"
            : match.rules.market !== "football_1x2")
        ) {
          stats.mappingFailures++;
          stats.rejectedMarkets += e.bookmakers.reduce(
            (n, b) => n + b.markets.length,
            0,
          );
          stats.errors.push("event_mapping_rejected");
          continue;
        }
        for (const b of e.bookmakers) {
          const operator = o.mapping.bookmakers[b.key];
          const at = Date.parse(snapshotAt);
          if (
            count(
              e.bookmakers.map((v) => v.key),
              b.key,
            ) !== 1 ||
            !operator?.approved ||
            !operator.operator.trim() ||
            (operator.effectiveFrom &&
              (!Number.isFinite(Date.parse(operator.effectiveFrom)) ||
                at < Date.parse(operator.effectiveFrom))) ||
            (operator.effectiveTo &&
              (!Number.isFinite(Date.parse(operator.effectiveTo)) ||
                at >= Date.parse(operator.effectiveTo)))
          ) {
            for (const _ of b.markets)
              reject("bookmaker_mapping_rejected", true);
            continue;
          }
          for (const m of b.markets) {
            if (
              m.key !== "h2h" ||
              count(
                b.markets.map((v) => v.key),
                m.key,
              ) !== 1
            ) {
              reject("unsupported_or_duplicate_market");
              continue;
            }
            if (
              new Set(m.outcomes.map((x) => x.name)).size !==
                m.outcomes.length ||
              hash(m.outcomes.map((x) => x.name).sort()) !==
                hash([...match.rules.outcomes].sort())
            ) {
              reject("incomplete_or_duplicate_outcomes", true);
              continue;
            }
            const sourceAt = m.last_update ?? b.last_update;
            const age = (at - Date.parse(sourceAt)) / 1000;
            if (age < 0 || !Number.isFinite(age)) {
              reject("future_source_timestamp");
              continue;
            }
            stats.sourceTimestampAgeSeconds = Math.max(
              stats.sourceTimestampAgeSeconds ?? 0,
              age,
            );
            if (age > strategyV1.maxAgeSeconds) {
              stats.staleMarkets++;
              reject("stale_market");
              continue;
            }
            const prices = Object.fromEntries(
              m.outcomes.map((x) => [x.name, String(x.price)]),
            );
            const implied = Decimal.sum(
              ...Object.values(prices).map((p) => new Decimal(1).div(p)),
            );
            try {
              removeMargin(prices);
            } catch {
              reject("invalid_prices");
              continue;
            }
            if (implied.lt("0.95") || implied.gt("1.25")) {
              reject("implausible_market");
              continue;
            }
            quotes.push({
              id: hash({
                event: e.id,
                book: b.key,
                sourceAt,
                snapshotAt,
                prices,
              }),
              bookmaker: b.key,
              operator: operator.operator,
              approved: true,
              rules: match.rules,
              prices,
              sourceAt,
              snapshotAt,
              receivedAt,
              suspended: false,
            });
            stats.validMarkets++;
          }
        }
      }
      stats.errors = [...new Set(stats.errors)];
      return {
        raw,
        quotes,
        remaining,
        used: quotaHeader(response.headers, "x-requests-used"),
        lastRequestCost: quotaHeader(response.headers, "x-requests-last"),
        receivedAt,
        snapshotAt,
        historicalSnapshotId: archive
          ? hash({ provider: this.id, sport, snapshotAt })
          : null,
        stats,
      };
    } finally {
      this.inFlight = false;
    }
  }
}
export function forecastCredits(input: {
  sports: number;
  regions: number;
  markets: number;
  intervalMinutes: number;
  hoursPerDay: number;
  days: number;
  historical?: boolean;
}) {
  if (
    Object.entries(input).some(
      ([key, n]) =>
        key !== "historical" &&
        (typeof n !== "number" || !Number.isFinite(n) || n <= 0),
    ) ||
    input.hoursPerDay > 24
  )
    throw new Error("Invalid quota forecast inputs");
  return (
    Math.ceil((input.hoursPerDay * 60) / input.intervalMinutes) *
    input.days *
    input.sports *
    input.regions *
    input.markets *
    (input.historical ? 10 : 1)
  );
}
