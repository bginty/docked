import Decimal from "decimal.js";
import { hash, type Quote } from "@/core/pricing";
import type { OddsProvider, OddsFetchResult, Capabilities } from "./contracts";
export type ProviderTrial = {
  schemaVersion: 1;
  provider: string;
  competition: string;
  requestedAsOf: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  status: "OK" | "ERROR" | "NOT_CONFIGURED" | "DISABLED" | "QUOTA_BLOCKED";
  errorCode: string | null;
  result: OddsFetchResult | null;
  capabilities: Capabilities;
};
/** Errors deliberately omit URLs/provider payloads so API keys cannot enter reports. */
export async function runProviderTrial(
  provider: OddsProvider,
  competition: string,
  asOf?: string,
  clock: () => Date = () => new Date(),
): Promise<ProviderTrial> {
  const started = clock();
  let status: ProviderTrial["status"] =
      provider.status === "READY" ? "OK" : provider.status,
    result: OddsFetchResult | null = null,
    errorCode: string | null = null;
  if (status === "OK")
    try {
      result = await provider.fetch(competition, asOf);
    } catch (error) {
      const quota =
        error instanceof Error && /quota|HTTP 429/i.test(error.message);
      status = quota ? "QUOTA_BLOCKED" : "ERROR";
      errorCode = quota ? "QUOTA_BLOCKED" : "FETCH_FAILED";
    }
  const completed = clock();
  if (completed.getTime() < started.getTime())
    throw new Error("Trial clock moved backwards");
  return {
    schemaVersion: 1,
    provider: provider.id,
    competition,
    requestedAsOf: asOf ?? null,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    latencyMs: completed.getTime() - started.getTime(),
    status,
    errorCode,
    result,
    capabilities: provider.capabilities,
  };
}
const set = (values: string[]) => [...new Set(values)].sort();
const median = (values: number[]) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]
    : null;
const key = (q: Quote) => `${q.rules.eventId}:${hash(q.rules)}`;
export function compareProviderTrials(
  trials: ProviderTrial[],
  expected: { eventIds: string[]; marketKeys?: string[] },
  outlierRelative = "0.10",
) {
  if (
    new Decimal(outlierRelative).lte(0) ||
    !new Decimal(outlierRelative).isFinite()
  )
    throw new Error("Finite positive comparison outlier threshold required");
  for (const t of trials) {
    if (
      t.schemaVersion !== 1 ||
      !t.provider ||
      !["OK", "ERROR", "NOT_CONFIGURED", "DISABLED", "QUOTA_BLOCKED"].includes(
        t.status,
      ) ||
      !Number.isFinite(Date.parse(t.startedAt)) ||
      !Number.isFinite(Date.parse(t.completedAt)) ||
      Date.parse(t.completedAt) < Date.parse(t.startedAt) ||
      !Number.isFinite(t.latencyMs) ||
      t.latencyMs < 0 ||
      (t.status === "OK") !== (t.result !== null)
    )
      throw new Error("Invalid trial evidence");
    if (t.result) {
      if (
        ![t.result.receivedAt, t.result.snapshotAt].every((x) =>
          Number.isFinite(Date.parse(x)),
        ) ||
        Date.parse(t.result.snapshotAt) > Date.parse(t.result.receivedAt) ||
        [t.result.remaining, t.result.used, t.result.lastRequestCost].some(
          (x) => x !== null && (!Number.isSafeInteger(x) || x < 0),
        )
      )
        throw new Error("Invalid provider timestamps or quota evidence");
      for (const q of t.result.quotes)
        if (
          ![q.sourceAt, q.snapshotAt, q.receivedAt].every((x) =>
            Number.isFinite(Date.parse(x)),
          ) ||
          Date.parse(q.sourceAt) > Date.parse(q.snapshotAt) ||
          Date.parse(q.snapshotAt) > Date.parse(q.receivedAt) ||
          Object.values(q.prices).some(
            (p) => !new Decimal(p).isFinite() || new Decimal(p).lte(1),
          )
        )
          throw new Error("Invalid canonical quote evidence");
    }
  }
  const providers = set(trials.map((t) => t.provider)).map((provider) => {
    const all = trials.filter((t) => t.provider === provider),
      ok = all.filter((t) => t.status === "OK"),
      quotes = ok.flatMap((t) => t.result!.quotes),
      events = set(quotes.map((q) => q.rules.eventId)),
      markets = set(quotes.map(key));
    const ages = ok
      .flatMap((t) =>
        t.result!.quotes.map(
          (q) =>
            (Date.parse(t.result!.receivedAt) - Date.parse(q.sourceAt)) / 1000,
        ),
      )
      .filter(Number.isFinite);
    const costs = all
      .filter(
        (t) =>
          t.result?.lastRequestCost !== null &&
          t.result?.lastRequestCost !== undefined,
      )
      .map((t) => t.result!.lastRequestCost!);
    const observedAttempts = all.filter(
      (t) =>
        !["NOT_CONFIGURED", "DISABLED", "QUOTA_BLOCKED"].includes(t.status),
    );
    return {
      provider,
      status: ok.length ? "OBSERVED" : "NO_SUCCESSFUL_OBSERVATIONS",
      attempts: all.length,
      successful: ok.length,
      failed: all.filter((t) => t.status === "ERROR").length,
      notConfigured: all.filter((t) => t.status === "NOT_CONFIGURED").length,
      quotaBlocked: all.filter((t) => t.status === "QUOTA_BLOCKED").length,
      observedErrorFraction: observedAttempts.length
        ? all.filter((t) => t.status === "ERROR").length /
          observedAttempts.length
        : null,
      eventIds: events,
      marketKeys: markets,
      eventCoverage: expected.eventIds.length
        ? events.filter((e) => expected.eventIds.includes(e)).length /
          new Set(expected.eventIds).size
        : null,
      missingEvents: expected.eventIds.filter((e) => !events.includes(e)),
      missingMarkets: (expected.marketKeys ?? []).filter(
        (k) => !markets.includes(k),
      ),
      marketCoverage: expected.marketKeys?.length
        ? markets.filter((m) => expected.marketKeys!.includes(m)).length /
          new Set(expected.marketKeys).size
        : null,
      medianLatencyMs: median(
        all
          .filter((t) => !["NOT_CONFIGURED", "DISABLED"].includes(t.status))
          .map((t) => t.latencyMs),
      ),
      medianSourceAgeSeconds: median(ages),
      maxSourceAgeSeconds: ages.length ? Math.max(...ages) : null,
      mappingFailures: ok.length
        ? ok.reduce((sum, t) => sum + t.result!.stats.mappingFailures, 0)
        : null,
      observedQuotaConsumed: costs.length
        ? costs.reduce((a, b) => a + b, 0)
        : null,
      unknownCostAttempts: all.length - costs.length,
      lastQuotaRemaining:
        [...ok].reverse().find((t) => t.result!.remaining !== null)?.result
          ?.remaining ?? null,
      historicalObservedSnapshots: ok
        .filter((t) => t.requestedAsOf !== null)
        .map((t) => ({
          requestedAt: t.requestedAsOf,
          observedAt: t.result!.snapshotAt,
          id: t.result!.historicalSnapshotId,
        })),
      historicalCoverage: ok.some((t) => t.requestedAsOf)
        ? "OBSERVED_REQUESTED_SNAPSHOTS_ONLY"
        : "UNKNOWN",
      resultsAvailable: ok.length
        ? all.some((t) => t.capabilities.results)
        : null,
    };
  });
  const comparisons: {
    providers: string[];
    eventId: string;
    selection: string;
    bookmaker: string;
    mappingAgreement: boolean;
    leftPrice: string | null;
    rightPrice: string | null;
    relativeDifference: string | null;
    outlier: boolean | null;
    sampleSkewSeconds: number;
    comparable: boolean;
  }[] = [];
  const successful = trials.filter((t) => t.status === "OK");
  for (let i = 0; i < successful.length; i++)
    for (let j = i + 1; j < successful.length; j++) {
      const a = successful[i],
        b = successful[j];
      if (
        a.provider === b.provider ||
        a.competition !== b.competition ||
        a.requestedAsOf !== b.requestedAsOf
      )
        continue;
      const skew =
        Math.abs(
          Date.parse(a.result!.snapshotAt) - Date.parse(b.result!.snapshotAt),
        ) / 1000;
      for (const left of a.result!.quotes)
        for (const right of b.result!.quotes) {
          if (
            left.rules.eventId !== right.rules.eventId ||
            left.bookmaker !== right.bookmaker
          )
            continue;
          const match = hash(left.rules) === hash(right.rules),
            comparable = match && skew <= 90;
          for (const selection of set([
            ...Object.keys(left.prices),
            ...Object.keys(right.prices),
          ])) {
            const l = left.prices[selection] ?? null,
              r = right.prices[selection] ?? null;
            let difference: Decimal | null = null;
            try {
              if (
                comparable &&
                l &&
                r &&
                new Decimal(l).gt(1) &&
                new Decimal(r).gt(1)
              )
                difference = new Decimal(l)
                  .minus(r)
                  .abs()
                  .div(Decimal.min(l, r));
            } catch {
              /* Invalid values remain explicitly missing. */
            }
            comparisons.push({
              providers: [a.provider, b.provider],
              eventId: left.rules.eventId,
              selection,
              bookmaker: left.bookmaker,
              mappingAgreement: match,
              leftPrice: l,
              rightPrice: r,
              relativeDifference: difference?.toString() ?? null,
              outlier: difference ? difference.gt(outlierRelative) : null,
              sampleSkewSeconds: skew,
              comparable,
            });
          }
        }
    }
  return {
    schemaVersion: 1,
    methodology: "provider-trial-comparison-v1-unvalidated",
    trialHash: hash(trials),
    expectedUniverseHash: hash(expected),
    providers,
    comparisons,
    limitation:
      "Observed poll failures are not continuous uptime. Missing quota/results/history are unknown. Price comparison requires matching canonical event, full rules, bookmaker and snapshots within 90 seconds; provider trials confer no display rights or strategy approval.",
  };
}
