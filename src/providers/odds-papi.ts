import { z } from "zod";
import { hash, type Rules } from "@/core/pricing";
import { supportedReferenceRules } from "@/core/market-reference";
import type {
  OddsProvider,
  OddsFetchResult,
  Capabilities,
  ProviderStatus,
  ProviderQuote,
} from "./contracts";

const timestamp = z.string().datetime({ offset: true });
const cell = z.object({
  price: z.number().finite().gt(1),
  active: z.boolean(),
  changedAt: timestamp,
  bookmakerChangedAt: timestamp.nullable().optional(),
  exchangeMeta: z.unknown().optional(),
});
const live = z.object({
  fixtureId: z.string(),
  participant1Id: z.number().int(),
  participant2Id: z.number().int(),
  sportId: z.number().int(),
  tournamentId: z.number().int(),
  statusId: z.number().int(),
  startTime: timestamp,
  bookmakerOdds: z.record(
    z.string(),
    z.object({
      bookmakerIsActive: z.boolean(),
      suspended: z.boolean(),
      markets: z.record(
        z.string(),
        z.object({
          marketActive: z.boolean(),
          outcomes: z.record(
            z.string(),
            z.object({ players: z.record(z.string(), cell) }),
          ),
        }),
      ),
    }),
  ),
});
const historical = z.object({
  fixtureId: z.string(),
  bookmakers: z.record(
    z.string(),
    z.object({
      markets: z.record(
        z.string(),
        z.object({
          outcomes: z.record(
            z.string(),
            z.object({
              players: z.record(
                z.string(),
                z.array(
                  z.object({
                    id: z.union([z.string(), z.number()]).optional(),
                    price: z.number().finite().gt(1),
                    active: z.boolean(),
                    createdAt: timestamp,
                    exchangeMeta: z.unknown().optional(),
                  }),
                ),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type OddsPapiMapping = {
  fixtureId: string;
  rules: Rules;
  startAt: string;
  sportId: number;
  tournamentId: number;
  participant1Id: number;
  participant2Id: number;
  marketId: string;
  outcomes: Record<string, string>;
  mappingEvidence: string;
  bookmakers: Record<
    string,
    { operator: string; approved: boolean; ownershipEvidence: string }
  >;
};
/** One explicitly mapped fixture per trial instance. No fuzzy matching or default standard-price certification. */
export class OddsPapi implements OddsProvider {
  id = "oddspapi";
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
  private budget: number | null;
  private inFlight = false;
  private lastRequest = -Infinity;
  get status(): ProviderStatus {
    return !this.options.key
      ? "NOT_CONFIGURED"
      : this.options.allowPolling && this.options.rights.trim()
        ? "READY"
        : "DISABLED";
  }
  constructor(
    private options: {
      key: string;
      rights: string;
      allowPolling: boolean;
      remaining: number | null;
      mapping: OddsPapiMapping;
      bookmakers: string[];
    },
    private fetcher: typeof fetch = fetch,
    private clock: () => Date = () => new Date(),
  ) {
    this.budget = options.remaining;
  }
  async fetch(sport: string, asOf?: string): Promise<OddsFetchResult> {
    if (this.status !== "READY")
      throw new Error(
        `ODDS_PROVIDER_STATUS=${this.status}; trial authority and rights required`,
      );
    const o = this.options,
      m = o.mapping,
      now = this.clock();
    if (
      !m.mappingEvidence.trim() ||
      !supportedReferenceRules(m.rules) ||
      m.rules.competition !== sport ||
      !timestamp.safeParse(m.startAt).success ||
      Object.values(m.outcomes).sort().join("\0") !==
        [...m.rules.outcomes].sort().join("\0")
    )
      throw new Error("Exact reviewed event and outcome mapping required");
    if (
      !o.bookmakers.length ||
      new Set(o.bookmakers).size !== o.bookmakers.length ||
      o.bookmakers.some(
        (b) =>
          !m.bookmakers[b]?.approved ||
          !m.bookmakers[b].operator ||
          !m.bookmakers[b].ownershipEvidence,
      ) ||
      (asOf && o.bookmakers.length > 3)
    )
      throw new Error(
        "Reviewed bookmaker scope required; historical request supports at most three books",
      );
    if (
      asOf &&
      (!timestamp.safeParse(asOf).success || Date.parse(asOf) > now.getTime())
    )
      throw new Error("Invalid historical decision time");
    if (this.inFlight || now.getTime() - this.lastRequest < (asOf ? 5000 : 500))
      throw new Error("Provider request cooldown or in-flight guard");
    if (
      this.budget === null ||
      !Number.isSafeInteger(this.budget) ||
      this.budget < 1
    )
      throw new Error("Quota exhausted or unknown");
    const cost = asOf ? 0 : 1;
    this.budget -= cost;
    this.lastRequest = now.getTime();
    this.inFlight = true;
    try {
      const url = new URL(
        `https://api.oddspapi.io/v4/${asOf ? "historical-odds" : "odds"}`,
      );
      url.search = new URLSearchParams({
        apiKey: o.key,
        fixtureId: m.fixtureId,
        bookmakers: o.bookmakers.join(","),
        ...(!asOf ? { oddsFormat: "decimal", verbosity: "3" } : {}),
      }).toString();
      let response: Response;
      try {
        response = await this.fetcher(url, {
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
      } catch {
        throw new Error("OddsPapi unavailable");
      }
      if (response.status === 429) this.budget = 0;
      if (!response.ok) throw new Error(`OddsPapi HTTP ${response.status}`);
      const raw: unknown = await response.json(),
        receivedAt = this.clock().toISOString(),
        snapshotAt = asOf ?? receivedAt;
      const quotes: ProviderQuote[] = [];
      const stats = {
        eventsReceived: 1,
        marketsReceived: 0,
        validMarkets: 0,
        rejectedMarkets: 0,
        staleMarkets: 0,
        mappingFailures: 0,
        sourceTimestampAgeSeconds: null as number | null,
        errors: [] as string[],
      };
      const reject = (reason: string) => {
        stats.rejectedMarkets++;
        if (!stats.errors.includes(reason)) stats.errors.push(reason);
      };
      const current = asOf ? null : live.parse(raw),
        archive = asOf ? historical.parse(raw) : null;
      if ((current ?? archive)!.fixtureId !== m.fixtureId)
        throw new Error("Provider fixture mismatch");
      if (
        current &&
        (current.participant1Id !== m.participant1Id ||
          current.participant2Id !== m.participant2Id ||
          current.sportId !== m.sportId ||
          current.tournamentId !== m.tournamentId ||
          Date.parse(current.startTime) !== Date.parse(m.startAt) ||
          current.statusId !== 0)
      )
        throw new Error(
          "Provider event/rules mismatch or event no longer pre-game",
        );
      for (const bookmaker of o.bookmakers) {
        const market =
          current?.bookmakerOdds[bookmaker]?.markets[m.marketId] ??
          archive?.bookmakers[bookmaker]?.markets[m.marketId];
        stats.marketsReceived++;
        if (!market) {
          stats.mappingFailures++;
          reject("missing_mapped_market");
          continue;
        }
        if (
          Object.keys(market.outcomes).sort().join("\0") !==
          Object.keys(m.outcomes).sort().join("\0")
        ) {
          stats.mappingFailures++;
          reject("outcome_mapping_disagreement");
          continue;
        }
        if (
          current &&
          (!current.bookmakerOdds[bookmaker].bookmakerIsActive ||
            current.bookmakerOdds[bookmaker].suspended ||
            !current.bookmakerOdds[bookmaker].markets[m.marketId].marketActive)
        ) {
          reject("suspended_market");
          continue;
        }
        const prices: Record<string, string> = {},
          times: string[] = [];
        let invalid = false;
        for (const [outcomeId, selection] of Object.entries(m.outcomes)) {
          if (archive) {
            const players =
              archive.bookmakers[bookmaker]?.markets[m.marketId]?.outcomes[
                outcomeId
              ]?.players;
            const history = players?.["0"];
            const eligible = history
              ?.filter((p) => Date.parse(p.createdAt) <= Date.parse(asOf!))
              .sort(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
              );
            const value = eligible?.[0];
            if (
              !value ||
              Object.keys(players ?? {}).length !== 1 ||
              !value.active ||
              value.exchangeMeta ||
              eligible!.filter(
                (p) => Date.parse(p.createdAt) === Date.parse(value.createdAt),
              ).length > 1
            ) {
              invalid = true;
              break;
            }
            prices[selection] = String(value.price);
            times.push(value.createdAt);
          } else {
            const players =
              current!.bookmakerOdds[bookmaker].markets[m.marketId].outcomes[
                outcomeId
              ]?.players;
            const value = players?.["0"];
            if (
              !value ||
              Object.keys(players!).length !== 1 ||
              !value.active ||
              value.exchangeMeta
            ) {
              invalid = true;
              break;
            }
            const at = value.bookmakerChangedAt ?? value.changedAt;
            if (
              Date.parse(at) > Date.parse(value.changedAt) ||
              Date.parse(value.changedAt) > Date.parse(receivedAt)
            ) {
              invalid = true;
              break;
            }
            prices[selection] = String(value.price);
            times.push(at);
          }
        }
        if (invalid) {
          reject("missing_inactive_ambiguous_or_exchange_outcome");
          continue;
        }
        if (
          Math.max(...times.map(Date.parse)) -
            Math.min(...times.map(Date.parse)) >
          90000
        ) {
          reject("within_market_source_skew");
          continue;
        }
        const sourceAt = new Date(
          Math.min(...times.map(Date.parse)),
        ).toISOString();
        const age = (Date.parse(snapshotAt) - Date.parse(sourceAt)) / 1000;
        if (age < 0) {
          reject("future_source");
          continue;
        }
        if (age > 180) {
          stats.staleMarkets++;
          reject("stale_price_change_evidence");
          continue;
        }
        stats.sourceTimestampAgeSeconds = Math.max(
          stats.sourceTimestampAgeSeconds ?? age,
          age,
        );
        quotes.push({
          id: hash({
            provider: this.id,
            fixture: m.fixtureId,
            bookmaker,
            snapshotAt,
            sourceAt,
            prices,
          }),
          bookmaker,
          operator: m.bookmakers[bookmaker].operator,
          approved: true,
          rules: structuredClone(m.rules),
          prices,
          sourceAt,
          snapshotAt,
          receivedAt,
          suspended: false,
          sourceTimestampKind: "price_change",
        });
        stats.validMarkets++;
      }
      // Remaining/used are unknown until a separately authorised /account read; local budget is not provider quota.
      return {
        raw,
        quotes,
        remaining: null,
        used: null,
        lastRequestCost: cost,
        receivedAt,
        snapshotAt,
        historicalSnapshotId: asOf
          ? hash({ provider: this.id, fixture: m.fixtureId, asOf, quotes })
          : null,
        stats,
      };
    } finally {
      this.inFlight = false;
    }
  }
}
