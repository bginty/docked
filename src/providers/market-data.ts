import { z } from "zod";
import { type Rules } from "@/core/pricing";
import { phase5Hash } from "@/core/phase5-hash";
import {
  marketDataApprovalActive,
  validateMarketDataConfig,
  type MarketDataConfig,
  type ProviderFixture,
} from "@/core/market-data";
import {
  TheOddsApi,
  quotaHeader,
  theOddsApiHasUnreviewedLifecycle,
  type Mapping,
} from "./odds-api";
import { OddsPapi, type OddsPapiMapping } from "./odds-papi";
import type { OddsDiagnostics, ProviderQuote } from "./contracts";

type Competition = MarketDataConfig["competitions"][number];
const timestamp = z.string().datetime({ offset: true });
const apiFixture = z.object({
  id: z.string().min(1),
  sport_key: z.string(),
  commence_time: timestamp,
  home_team: z.string().trim().min(1),
  away_team: z.string().trim().min(1),
  bookmakers: z.array(z.unknown()).optional(),
});
const papiFixture = z.object({
  fixtureId: z.string().min(1),
  participant1Id: z.number().int(),
  participant2Id: z.number().int(),
  sportId: z.number().int(),
  tournamentId: z.number().int(),
  statusId: z.number().int(),
  startTime: timestamp,
  updatedAt: timestamp,
  participant1Name: z.string().trim().min(1),
  participant2Name: z.string().trim().min(1),
  hasOdds: z.boolean(),
});
export type MarketDataBatch = {
  provider: MarketDataConfig["provider"];
  fixtures: ProviderFixture[];
  fixtureEvidence: Record<string, string>;
  quotes: (ProviderQuote & { rawPayloadId: string })[];
  rawRecords: { id: string; payload: unknown; receivedAt: string }[];
  remaining: number | null;
  used: number | null;
  chargedCredits: number;
  receivedAt: string;
  stats: OddsDiagnostics;
};
export type MarketDataRequestAuthority = {
  key: string;
  reserve: (credits: number, scope: string) => Promise<void>;
  observeQuota?: (quota: {
    remaining: number | null;
    used: number | null;
    lastRequestCost: number | null;
    reservedCost: number;
  }) => Promise<void>;
};
async function readBoundedProviderPayload(
  response: Response,
): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 8000000)
    throw new Error("Provider response exceeds bounded import size");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider response missing");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 8000000) {
      await reader.cancel();
      throw new Error("Provider response exceeds bounded import size");
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid market data provider payload");
  }
}
async function fetchTrialCatalog(
  path: string,
  scope: string,
  authority: MarketDataRequestAuthority,
  fetcher: typeof fetch,
  clock: () => Date,
  reservedCost = 0,
) {
  if (!authority.key.trim())
    throw new Error("MARKET_DATA_STATUS=NOT_CONFIGURED");
  const url = new URL(path, "https://api.the-odds-api.com");
  url.searchParams.set("apiKey", authority.key);
  await authority.reserve(reservedCost, scope);
  let response: Response;
  try {
    response = await fetcher(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch {
    throw new Error("Market data provider unavailable");
  }
  const quota = {
    remaining: quotaHeader(response.headers, "x-requests-remaining"),
    used: quotaHeader(response.headers, "x-requests-used"),
    lastRequestCost: quotaHeader(response.headers, "x-requests-last"),
    reservedCost,
  };
  await authority.observeQuota?.(quota);
  if (!response.ok)
    throw new Error(`Market data provider HTTP ${response.status}`);
  const payload = await readBoundedProviderPayload(response),
    receivedAt = clock().toISOString();
  return {
    rawRecords: [
      {
        id: phase5Hash({ provider: "the-odds-api", payload, receivedAt }),
        payload,
        receivedAt,
      },
    ],
    remaining: quota.remaining,
    used: quota.used,
    chargedCredits: quota.lastRequestCost ?? reservedCost,
    receivedAt,
  };
}
/** Free catalogue requests still consume one explicit, durable trial permit. */
export async function fetchTrialSports(
  authority: MarketDataRequestAuthority,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
) {
  const data = await fetchTrialCatalog(
    "/v4/sports",
    "sports",
    authority,
    fetcher,
    clock,
  );
  const rawSports = z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9_]+$/),
        group: z.string(),
        title: z.string().min(1),
        description: z.string(),
        active: z.boolean(),
        has_outrights: z.boolean(),
      }),
    )
    .max(5000)
    .safeParse(data.rawRecords[0].payload);
  if (
    !rawSports.success ||
    new Set(rawSports.data.map((s) => s.key)).size !== rawSports.data.length
  )
    throw new Error("Invalid provider sports catalogue");
  return {
    ...data,
    sports: rawSports.data.map(({ has_outrights, ...sport }) => ({
      ...sport,
      hasOutrights: has_outrights,
    })),
  };
}
/** Catalogue facts only. In particular, NFL fixtures never imply supported odds rules. */
export async function fetchTrialEvents(
  configuration: MarketDataConfig,
  providerCompetitionId: string,
  authority: MarketDataRequestAuthority,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
): Promise<MarketDataBatch> {
  const config = validateMarketDataConfig(configuration),
    competition = config.competitions.find(
      (c) => c.providerCompetitionId === providerCompetitionId,
    );
  if (
    config.provider !== "the-odds-api" ||
    !competition ||
    competition.providerCompetitionId !== competition.competitionId
  )
    throw new Error("The Odds API competition identity mismatch");
  const data = await fetchTrialCatalog(
      `/v4/sports/${encodeURIComponent(providerCompetitionId)}/events`,
      `events:${providerCompetitionId}`,
      authority,
      fetcher,
      clock,
    ),
    fixtures = providerFixtures(
      data.rawRecords[0].payload,
      config,
      competition,
      data.receivedAt,
    );
  return {
    ...data,
    provider: "the-odds-api",
    fixtures,
    fixtureEvidence: Object.fromEntries(
      fixtures.map((f) => [f.providerEventId, data.rawRecords[0].id]),
    ),
    quotes: [],
    stats: {
      ...emptyStats(),
      // providerFixtures has validated the array; returned rows include excluded events.
      eventsReceived: (data.rawRecords[0].payload as unknown[]).length,
    },
  };
}
/** Recent scores are diagnostic evidence, never an authorised settlement adapter. */
export async function fetchTrialScores(
  providerCompetitionId: string,
  authority: MarketDataRequestAuthority,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
) {
  if (
    ![
      "soccer_epl",
      "soccer_spain_la_liga",
      "basketball_nba",
      "americanfootball_nfl",
    ].includes(providerCompetitionId)
  )
    throw new Error("Unsupported trial scores competition");
  const data = await fetchTrialCatalog(
    `/v4/sports/${encodeURIComponent(providerCompetitionId)}/scores?daysFrom=3`,
    `scores:${providerCompetitionId}`,
    authority,
    fetcher,
    clock,
    2,
  );
  const scores = z
    .array(
      z.object({
        id: z.string().min(1),
        sport_key: z.literal(providerCompetitionId),
        commence_time: timestamp,
        completed: z.boolean(),
        home_team: z.string().trim().min(1),
        away_team: z.string().trim().min(1),
        scores: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              score: z.string().regex(/^\d+$/),
            }),
          )
          .length(2)
          .nullable(),
        last_update: timestamp.nullable(),
      }),
    )
    .max(10000)
    .safeParse(data.rawRecords[0].payload);
  if (
    !scores.success ||
    new Set(scores.data.map((s) => s.id)).size !== scores.data.length ||
    scores.data.some(
      (s) =>
        s.home_team === s.away_team ||
        (s.last_update !== null &&
          Date.parse(s.last_update) > Date.parse(data.receivedAt)) ||
        (s.scores !== null &&
          (new Set(s.scores.map((v) => v.name)).size !== 2 ||
            s.scores.some(
              (v) => ![s.home_team, s.away_team].includes(v.name),
            ))),
    )
  )
    throw new Error("Invalid provider scores payload");
  return { ...data, scores: scores.data, settlementReady: false as const };
}
export function canonicalProviderEventId(
  provider: string,
  providerEventId: string,
) {
  return `provider-${phase5Hash({ provider, providerEventId }).slice(0, 40)}`;
}
export function fixtureRules(fixture: ProviderFixture): Rules | null {
  if (fixture.competitionId === "americanfootball_nfl") return null;
  const basketball = fixture.competitionId === "basketball_nba";
  return {
    eventId: canonicalProviderEventId(
      fixture.provider,
      fixture.providerEventId,
    ),
    competition: fixture.competitionId,
    participants: fixture.participants,
    market: basketball ? "nba_moneyline" : "football_1x2",
    period: "full_game",
    overtime: basketball,
    draw: !basketball,
    line: null,
    settlement: basketball
      ? "full_game_including_overtime"
      : "regulation_90_plus_stoppage",
    outcomes: basketball
      ? [...fixture.participants]
      : [...fixture.participants, "Draw"],
  };
}
/** Catalog normalization is exact and provider scoped. It does not fuzzy-merge two feeds. */
export function providerFixtures(
  raw: unknown,
  config: MarketDataConfig,
  competition: Competition,
  receivedAt: string,
): ProviderFixture[] {
  timestamp.parse(receivedAt);
  const values = z.array(z.unknown()).max(10000).parse(raw),
    seen = new Set<string>();
  if (config.provider === "the-odds-api") {
    if (competition.providerCompetitionId !== competition.competitionId)
      throw new Error("The Odds API competition identity mismatch");
    for (const value of values) {
      const identity = z.object({ id: z.string().min(1) }).safeParse(value);
      if (!identity.success) continue;
      if (seen.has(identity.data.id))
        throw new Error("Duplicate provider fixture identity");
      seen.add(identity.data.id);
    }
    seen.clear();
  }
  const from = Date.parse(receivedAt),
    to = from + config.horizonHours * 3600000;
  const fixtures: ProviderFixture[] = [];
  for (const value of values) {
    let fixture: ProviderFixture;
    if (config.provider === "the-odds-api") {
      if (theOddsApiHasUnreviewedLifecycle(value)) continue;
      const result = apiFixture.safeParse(value);
      if (!result.success) continue;
      const v = result.data;
      if (v.sport_key !== competition.providerCompetitionId) continue;
      fixture = {
        provider: config.provider,
        providerEventId: v.id,
        providerCompetitionId: v.sport_key,
        competitionId: competition.competitionId,
        sport: competition.sport,
        competition: competition.displayName,
        participants: [v.home_team, v.away_team],
        startAt: v.commence_time,
        status: Date.parse(v.commence_time) > from ? "scheduled" : "unknown",
        observedAt: receivedAt,
        sourceUpdatedAt: null,
      };
    } else {
      const result = papiFixture.safeParse(value);
      if (!result.success) continue;
      const v = result.data;
      if (
        String(v.tournamentId) !== competition.providerCompetitionId ||
        v.sportId !== competition.providerSportId ||
        Date.parse(v.updatedAt) > from
      )
        continue;
      fixture = {
        provider: config.provider,
        providerEventId: v.fixtureId,
        providerCompetitionId: String(v.tournamentId),
        competitionId: competition.competitionId,
        sport: competition.sport,
        competition: competition.displayName,
        participants: [v.participant1Name, v.participant2Name],
        startAt: v.startTime,
        status:
          (
            {
              0: "scheduled",
              1: "live",
              2: "finished",
              3: "cancelled",
            } as const
          )[v.statusId as 0 | 1 | 2 | 3] ?? "unknown",
        observedAt: receivedAt,
        sourceUpdatedAt: v.updatedAt,
      };
    }
    if (
      fixture.participants[0] === fixture.participants[1] ||
      Date.parse(fixture.startAt) <= from ||
      Date.parse(fixture.startAt) > to
    )
      continue;
    if (seen.has(fixture.providerEventId))
      throw new Error("Duplicate provider fixture identity");
    seen.add(fixture.providerEventId);
    fixtures.push(fixture);
  }
  return fixtures
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.providerEventId.localeCompare(b.providerEventId),
    )
    .slice(0, config.maxEvents);
}
function reviewedQuotes(
  quotes: ProviderQuote[],
  config: MarketDataConfig,
  fixtures: ProviderFixture[],
) {
  return quotes.map((q) => {
    const b = config.bookmakers[q.bookmaker],
      fixture = fixtures.find(
        (f) =>
          canonicalProviderEventId(f.provider, f.providerEventId) ===
          q.rules.eventId,
      );
    if (!b || !fixture || !marketDataApprovalActive(b, q.receivedAt)) return q;
    return {
      ...q,
      communityMetadata: {
        sourceKind: "current_provider" as const,
        sourceType: b.sourceType,
        receivedByDocked: true as const,
        providerEventId: fixture.providerEventId,
        observedStartAt: fixture.startAt,
        priceClass: b.classification,
        classificationVersion: b.classificationVersion,
        classificationEvidence: b.classificationEvidence,
        promotionFlags:
          b.classification === "STANDARD_VERIFIED" ? [] : [b.classification],
      },
    };
  });
}
const emptyStats = (): OddsDiagnostics => ({
  eventsReceived: 0,
  marketsReceived: 0,
  validMarkets: 0,
  rejectedMarkets: 0,
  staleMarkets: 0,
  mappingFailures: 0,
  sourceTimestampAgeSeconds: null,
  errors: [],
});
/** Network is possible only after a caller reserves each bounded request in the durable quota ledger. */
export async function fetchCurrentMarketData(
  configuration: MarketDataConfig,
  authority: MarketDataRequestAuthority,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
): Promise<MarketDataBatch> {
  const config = validateMarketDataConfig(configuration);
  if (
    config.provider === "the-odds-api" &&
    config.competitions.some((c) => c.providerCompetitionId !== c.competitionId)
  )
    throw new Error("The Odds API competition identity mismatch");
  if (!authority.key.trim())
    throw new Error("MARKET_DATA_STATUS=NOT_CONFIGURED");
  const output: MarketDataBatch = {
    provider: config.provider,
    fixtures: [],
    fixtureEvidence: {},
    quotes: [],
    rawRecords: [],
    remaining: null,
    used: null,
    chargedCredits: 0,
    receivedAt: clock().toISOString(),
    stats: emptyStats(),
  };
  let requests = 0,
    lastRequest = -Infinity,
    knownRemaining: number | null = null;
  const request = async (
    url: URL,
    cost: number,
    cooldown: number,
    scope: string,
  ) => {
    if (requests >= config.maxRequestsPerRun)
      throw new Error("Market data request cap reached");
    if (knownRemaining !== null && knownRemaining < cost)
      throw new Error("Provider quota exhausted");
    const wait = cooldown - (Date.now() - lastRequest);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    await authority.reserve(cost, scope);
    if (knownRemaining !== null) knownRemaining -= cost;
    requests++;
    output.chargedCredits += cost;
    lastRequest = Date.now();
    let response: Response;
    try {
      response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw new Error("Market data provider unavailable");
    }
    if (config.provider === "the-odds-api") {
      const quota = {
        remaining: quotaHeader(response.headers, "x-requests-remaining"),
        used: quotaHeader(response.headers, "x-requests-used"),
        lastRequestCost: quotaHeader(response.headers, "x-requests-last"),
        reservedCost: cost,
      };
      if (quota.remaining !== null) knownRemaining = quota.remaining;
      else if (knownRemaining !== null)
        knownRemaining = Math.max(
          0,
          knownRemaining - Math.max(0, (quota.lastRequestCost ?? cost) - cost),
        );
      output.remaining = knownRemaining;
      output.used = quota.used;
      output.chargedCredits += Math.max(
        0,
        (quota.lastRequestCost ?? cost) - cost,
      );
      await authority.observeQuota?.(quota);
    }
    if (!response.ok)
      throw new Error(`Market data provider HTTP ${response.status}`);
    const raw = await readBoundedProviderPayload(response);
    const receivedAt = clock().toISOString(),
      id = phase5Hash({ provider: config.provider, payload: raw, receivedAt });
    output.receivedAt = receivedAt;
    output.rawRecords.push({ id, payload: raw, receivedAt });
    return { raw, receivedAt, id, headers: response.headers };
  };
  const merge = (stats: OddsDiagnostics) => {
    for (const k of [
      "marketsReceived",
      "validMarkets",
      "rejectedMarkets",
      "staleMarkets",
      "mappingFailures",
    ] as const)
      output.stats[k] += stats[k];
    output.stats.errors.push(...stats.errors);
    if (stats.sourceTimestampAgeSeconds !== null)
      output.stats.sourceTimestampAgeSeconds = Math.max(
        output.stats.sourceTimestampAgeSeconds ?? 0,
        stats.sourceTimestampAgeSeconds,
      );
  };
  for (const competition of config.competitions) {
    if (
      requests >= config.maxRequestsPerRun ||
      output.fixtures.length >= config.maxEvents
    )
      break;
    const url = new URL(
      config.provider === "the-odds-api"
        ? `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(competition.providerCompetitionId)}/odds`
        : "https://api.oddspapi.io/v4/fixtures",
    );
    url.searchParams.set("apiKey", authority.key);
    if (config.provider === "the-odds-api") {
      url.searchParams.set("regions", config.regions.join(","));
      url.searchParams.set("markets", "h2h");
      url.searchParams.set("oddsFormat", "decimal");
    } else {
      if (!competition.providerSportId)
        throw new Error("Reviewed provider sport mapping required");
      url.searchParams.set("sportId", String(competition.providerSportId));
      url.searchParams.set("tournamentId", competition.providerCompetitionId);
      url.searchParams.set("from", clock().toISOString());
      url.searchParams.set(
        "to",
        new Date(
          clock().getTime() + config.horizonHours * 3600000,
        ).toISOString(),
      );
    }
    const cost = config.provider === "the-odds-api" ? config.regions.length : 1;
    const data = await request(
      url,
      cost,
      config.provider === "odds-papi" ? 2000 : 0,
      config.provider === "the-odds-api"
        ? `odds:${competition.providerCompetitionId}`
        : competition.providerCompetitionId,
    );
    const fixtures = providerFixtures(
      data.raw,
      config,
      competition,
      data.receivedAt,
    ).slice(0, config.maxEvents - output.fixtures.length);
    output.fixtures.push(...fixtures);
    for (const f of fixtures)
      output.fixtureEvidence[f.providerEventId] = data.id;
    // Keep provider response counts separate from the bounded eligible fixture subset.
    output.stats.eventsReceived += (data.raw as unknown[]).length;
    if (
      config.provider === "the-odds-api" &&
      competition.competitionId !== "americanfootball_nfl"
    ) {
      const mapping: Mapping = { events: {}, bookmakers: {} };
      for (const f of fixtures) {
        const rules = fixtureRules(f);
        if (rules && f.status === "scheduled")
          mapping.events[f.providerEventId] = { rules, startAt: f.startAt };
      }
      for (const [id, b] of Object.entries(config.bookmakers))
        mapping.bookmakers[id] = {
          operator: b.operator,
          approved:
            marketDataApprovalActive(b, data.receivedAt) &&
            b.sourceType === "bookmaker",
          evidence: b.ownershipEvidence,
          effectiveFrom: b.effectiveFrom,
          effectiveTo: b.effectiveTo,
        };
      // Reuse the existing quote validator; this fetcher only replays the retained response, never performs I/O.
      const parser = new TheOddsApi(
        {
          key: authority.key,
          rights: config.rights.reference,
          remaining: cost,
          regions: config.regions.join(","),
          mapping,
          allowPolling: true,
        },
        async () =>
          new Response(JSON.stringify(data.raw), { headers: data.headers }),
        () => new Date(data.receivedAt),
      );
      const result = await parser.fetch(competition.competitionId);
      output.quotes.push(
        ...reviewedQuotes(result.quotes, config, fixtures).map((q) => ({
          ...q,
          rawPayloadId: data.id,
        })),
      );
      merge(result.stats);
    } else if (config.provider === "odds-papi") {
      for (const fixture of fixtures) {
        if (requests >= config.maxRequestsPerRun) break;
        const rules = fixtureRules(fixture);
        if (
          !rules ||
          fixture.status !== "scheduled" ||
          !competition.marketId ||
          !competition.outcomes
        )
          continue;
        const original = z
          .array(papiFixture)
          .parse(data.raw)
          .find((x) => x.fixtureId === fixture.providerEventId);
        if (!original?.hasOdds) continue;
        const books = Object.entries(config.bookmakers).filter(
          ([, b]) =>
            marketDataApprovalActive(b, data.receivedAt) &&
            b.sourceType === "bookmaker",
        );
        if (!books.length) continue;
        const mapping: OddsPapiMapping = {
          fixtureId: fixture.providerEventId,
          rules,
          startAt: fixture.startAt,
          sportId: original.sportId,
          tournamentId: original.tournamentId,
          participant1Id: original.participant1Id,
          participant2Id: original.participant2Id,
          marketId: competition.marketId,
          outcomes: Object.fromEntries(
            Object.entries(competition.outcomes).map(([id, side]) => [
              id,
              side === "draw"
                ? "Draw"
                : fixture.participants[side === "home" ? 0 : 1],
            ]),
          ),
          mappingEvidence: competition.mappingEvidence,
          bookmakers: Object.fromEntries(
            books.map(([id, b]) => [
              id,
              {
                operator: b.operator,
                approved: true,
                ownershipEvidence: b.ownershipEvidence,
              },
            ]),
          ),
        };
        const oddsUrl = new URL("https://api.oddspapi.io/v4/odds");
        oddsUrl.search = new URLSearchParams({
          apiKey: authority.key,
          fixtureId: fixture.providerEventId,
          bookmakers: books.map(([id]) => id).join(","),
          oddsFormat: "decimal",
          verbosity: "3",
        }).toString();
        const odds = await request(oddsUrl, 1, 500, fixture.providerEventId);
        const parser = new OddsPapi(
          {
            key: authority.key,
            rights: config.rights.reference,
            allowPolling: true,
            remaining: 1,
            mapping,
            bookmakers: books.map(([id]) => id),
          },
          async () => new Response(JSON.stringify(odds.raw)),
          () => new Date(odds.receivedAt),
        );
        const result = await parser.fetch(competition.competitionId);
        output.quotes.push(
          ...reviewedQuotes(result.quotes, config, fixtures).map((q) => ({
            ...q,
            rawPayloadId: odds.id,
          })),
        );
        merge(result.stats);
      }
    }
  }
  output.stats.errors = [...new Set(output.stats.errors)];
  return output;
}
