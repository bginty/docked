import {
  evaluate,
  hash,
  strategyV1,
  removeMargin,
  type Rules,
  type Quote,
  type Evidence,
  type Strategy,
} from "@/core/pricing";
import { ledger, type LedgerRow } from "@/core/ledger";
import { settle, type Result } from "@/core/settlement";
export type HistoricalEvent = {
  rules: Rules;
  startAt: string;
  snapshots: { observedAt: string; quotes: Quote[] }[];
  result: Result | null;
};
export type Manifest = {
  datasetId: string;
  evidence: Evidence;
  oddsRights: string;
  resultsRights: string;
  retentionAllowed: boolean;
  configHash: string;
  dataHash: string;
  codeCommit: string;
  seed: number;
  split: "development" | "validation" | "held_out" | "subsequent";
  contaminated: boolean;
  frozenAt: string;
  from: string;
  to: string;
  historicalUniverseEvidence: string;
};
export function replay(
  events: HistoricalEvent[],
  manifest: Manifest,
  config: Strategy = strategyV1,
  delaySeconds = 300,
) {
  if (
    (hash(config) !== hash(strategyV1) || delaySeconds !== 300) &&
    !["development", "validation"].includes(manifest.split)
  )
    throw new Error("Sensitivity is prohibited on held-out/subsequent splits");
  if (
    !manifest.oddsRights ||
    !manifest.resultsRights ||
    !manifest.retentionAllowed ||
    !manifest.historicalUniverseEvidence
  )
    throw new Error("Dataset rights and historical universe evidence required");
  if (
    manifest.evidence !== "retrospective_backtest" &&
    manifest.evidence !== "demo"
  )
    throw new Error("Replay cannot create forward or live evidence");
  if (
    manifest.configHash !== hash(config) ||
    manifest.dataHash !== hash(events)
  )
    throw new Error("Manifest hash mismatch");
  if (!Number.isFinite(Date.parse(manifest.frozenAt)) || !manifest.codeCommit)
    throw new Error("Freeze provenance required");
  if (new Set(events.map((e) => e.rules.eventId)).size !== events.length)
    throw new Error("Duplicate canonical events");
  const decisions: unknown[] = [],
    immediate: LedgerRow[] = [],
    delayed: LedgerRow[] = [];
  let missing = 0,
    delaySkipped = 0,
    calibrationCount = 0,
    brier = 0,
    logLoss = 0,
    marketBrier = 0,
    marketLogLoss = 0;
  const excluded: string[] = [];
  for (const e of [...events].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  )) {
    if (e.startAt < manifest.from || e.startAt >= manifest.to) {
      excluded.push(`${e.rules.eventId}:outside_split`);
      continue;
    }
    let published = false;
    for (const seconds of config.windowsSeconds) {
      const at = new Date(Date.parse(e.startAt) - seconds * 1000).toISOString();
      const snapshot = [...e.snapshots]
        .filter((s) => s.observedAt <= at)
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
      if (!snapshot) {
        missing++;
        decisions.push({
          eventId: e.rules.eventId,
          at,
          reason: "missing_asof_snapshot",
        });
        continue;
      }
      const evaluation = evaluate(
        {
          rules: e.rules,
          startAt: e.startAt,
          decisionAt: at,
          quotes: snapshot.quotes,
        },
        config,
      );
      // Calibration covers all complete valid offered/reference vectors, not just selections that qualify.
      if (e.result?.authorised && e.result.status === "final") {
        for (const point of evaluation.universe) {
          const outcome = settle(e.rules, point.selection, e.result);
          if (!["won", "lost"].includes(outcome)) continue;
          const p = Number(point.probability),
            y = outcome === "won" ? 1 : 0;
          brier += (p - y) ** 2;
          logLoss -=
            y * Math.log(Math.max(1e-12, p)) +
            (1 - y) * Math.log(Math.max(1e-12, 1 - p));
          const ownQuote = snapshot.quotes.find(
            (q) => q.bookmaker === point.bookmaker,
          )!;
          const baseline = removeMargin(ownQuote.prices)[
            point.selection
          ].toNumber();
          marketBrier += (baseline - y) ** 2;
          marketLogLoss -=
            y * Math.log(Math.max(1e-12, baseline)) +
            (1 - y) * Math.log(Math.max(1e-12, 1 - baseline));
          calibrationCount++;
        }
      }
      decisions.push({
        eventId: e.rules.eventId,
        at,
        ...evaluation,
        alreadySelected: published,
      });
      const c = evaluation.candidates[0];
      if (published || !c) continue;
      published = true;
      const result = e.result
        ? settle(e.rules, c.selection, e.result)
        : "pending";
      const row: LedgerRow = {
        id: hash({ event: e.rules.eventId, at }),
        eventId: e.rules.eventId,
        publishedAt: at,
        settledAt: e.result?.observedAt,
        odds: c.offer.prices[c.selection],
        stake: "1",
        evidence: manifest.evidence,
        result,
        sport: e.rules.competition,
        strategy: config.version,
        ev: c.ev,
      };
      immediate.push(row);
      const after = new Date(
        Date.parse(at) + delaySeconds * 1000,
      ).toISOString();
      const later = [...e.snapshots]
        .filter((s) => s.observedAt >= after)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0];
      if (
        !later ||
        Date.parse(later.observedAt) - Date.parse(at) >
          config.maxDelayedSeconds * 1000
      ) {
        delaySkipped++;
        continue;
      }
      // Delayed execution is a price recheck, not a new decision window or new selection.
      const elapsed =
        (Date.parse(e.startAt) - Date.parse(later.observedAt)) / 1000;
      const delayedConfig = {
        ...config,
        windowsSeconds: [elapsed],
        windowToleranceSeconds: 0,
      };
      const recheck = evaluate(
        {
          rules: e.rules,
          startAt: e.startAt,
          decisionAt: later.observedAt,
          quotes: later.quotes,
        },
        delayedConfig,
      );
      const d = recheck.eligibleCandidates.find(
        (x) =>
          x.selection === c.selection &&
          x.offer.bookmaker === c.offer.bookmaker,
      );
      if (!d) {
        delaySkipped++;
        continue;
      }
      delayed.push({
        ...row,
        odds: d.offer.prices[d.selection],
        publishedAt: later.observedAt,
      });
    }
  }
  return {
    label:
      manifest.evidence === "demo"
        ? "FICTIONAL SOFTWARE FIXTURE — NOT HISTORICAL EVIDENCE"
        : manifest.contaminated
          ? "CONTAMINATED RETROSPECTIVE EVALUATION"
          : "Retrospective evaluation; holdout provenance requires independent review",
    manifest,
    decisions,
    excluded,
    coverage: {
      events: events.length,
      missingWindows: missing,
      delayedSkipped: delaySkipped,
    },
    immediate: ledger(immediate, manifest.evidence),
    delayed: ledger(delayed, manifest.evidence),
    rows: { immediate, delayed },
    calibration: {
      selectionProbabilityObservations: calibrationCount,
      brier: calibrationCount ? brier / calibrationCount : null,
      logLoss: calibrationCount ? logLoss / calibrationCount : null,
      declaredBaseline: {
        name: "Offered bookmaker proportional margin-free market, identical outcome observation universe",
        brier: calibrationCount ? marketBrier / calibrationCount : null,
        logLoss: calibrationCount ? marketLogLoss / calibrationCount : null,
      },
      definition:
        "All complete valid offered/reference outcome vectors at eligible windows; correlated observations, not independent trials",
    },
    uncertainty: dayBootstrap(immediate, manifest.seed),
    limitations: [
      "No claim of executed bookmaker stakes",
      "No interpolation across archive gaps",
      "Calendar splits do not establish an untouched holdout",
      "Equal weighting and proportional de-vig remain hypotheses",
    ],
  };
}
export function dayBootstrap(
  rows: LedgerRow[],
  seed: number,
  iterations = 1000,
) {
  const settled = rows.filter((r) => r.result === "won" || r.result === "lost");
  const groups = Object.groupBy(settled, (r) => r.publishedAt.slice(0, 10));
  const days = Object.values(groups).filter(Boolean) as LedgerRow[][];
  if (days.length < 2)
    return {
      interval: null,
      reason: "Fewer than two settled day blocks",
      blocks: days.length,
    };
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const samples: number[] = [];
  for (let n = 0; n < iterations; n++) {
    let net = 0,
      stake = 0;
    for (let i = 0; i < days.length; i++) {
      for (const r of days[Math.floor(random() * days.length)]) {
        net += r.result === "won" ? Number(r.odds) - 1 : -1;
        stake++;
      }
    }
    samples.push(net / stake);
  }
  samples.sort((a, b) => a - b);
  return {
    interval: [
      samples[Math.floor(iterations * 0.025)],
      samples[Math.floor(iterations * 0.975)],
    ],
    blocks: days.length,
    iterations,
    method:
      "Seeded day-block percentile bootstrap of ROI; within-day dependence retained, cross-day dependence unmodelled",
  };
}
