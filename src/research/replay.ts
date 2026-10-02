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
import Decimal from "decimal.js";
import { ledger, closingValue, type LedgerRow } from "@/core/ledger";
import { settle, type Result } from "@/core/settlement";
import { observePublication } from "@/core/observations";
import { validateDataset } from "./dataset";
export type HistoricalEvent = {
  rules: Rules;
  startAt: string;
  snapshots: {
    observedAt: string;
    quotes: Quote[];
    archiveRetrievedAt?: string;
    availabilityEvidence?: string;
  }[];
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
  fixture?: boolean;
  provider?: { odds: string; results: string };
  datasetHashes?: {
    canonical: string;
    rawFiles: { name: string; sha256: string }[];
  };
  freezeArtifactHash?: string;
  reviewedBy?: string;
  sourceResolutionSeconds?: number;
  holdoutProvenance?: string;
};
export function replay(
  events: HistoricalEvent[],
  manifest: Manifest,
  config: Strategy = strategyV1,
  delaySeconds = 300,
) {
  const validation = validateDataset(events, manifest, config);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  if (
    (hash({ ...config, version: strategyV1.version }) !== hash(strategyV1) ||
      delaySeconds !== 300) &&
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
  const availability: {
    eventId: string;
    minutes: number;
    observedAt: string;
    odds: string;
    qualifies: boolean;
    sourceAt: string;
  }[] = [];
  const closing: {
    eventId: string;
    observedAt: string;
    probability: string;
    clv: string | null;
    sourceAt: string;
  }[] = [];
  let missing = 0,
    delaySkipped = 0,
    calibrationCount = 0,
    brier = 0,
    logLoss = 0,
    marketBrier = 0,
    marketLogLoss = 0;
  const excluded: string[] = [];
  for (const e of [...events].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  )) {
    if (
      Date.parse(e.startAt) < Date.parse(manifest.from) ||
      Date.parse(e.startAt) >= Date.parse(manifest.to)
    ) {
      excluded.push(`${e.rules.eventId}:outside_split`);
      continue;
    }
    let published = false;
    for (const seconds of config.windowsSeconds) {
      const at = new Date(Date.parse(e.startAt) - seconds * 1000).toISOString();
      const snapshot = [...e.snapshots]
        .filter((s) => Date.parse(s.observedAt) <= Date.parse(at))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
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
        settledAt: e.result
          ? new Date(e.result.observedAt).toISOString()
          : undefined,
        odds: c.offer.prices[c.selection],
        stake: "1",
        evidence: manifest.evidence,
        result,
        sport: e.rules.competition,
        strategy: config.version,
        ev: c.ev,
      };
      immediate.push(row);
      const observations = [...e.snapshots]
        .filter((s) => Date.parse(s.observedAt) > Date.parse(at))
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
      const seenTargets = new Set<number>();
      for (const s of observations) {
        const obs = observePublication(
          {
            rules: e.rules,
            startAt: e.startAt,
            observedAt: s.observedAt,
            publishedAt: at,
            selection: c.selection,
            bookmaker: c.offer.bookmaker,
            minimumOdds: c.minimumOdds,
            quotes: s.quotes,
            resolutionSeconds: manifest.sourceResolutionSeconds ?? 300,
          },
          config,
        );
        if (!obs) continue;
        for (const minutes of obs.targets)
          if (!seenTargets.has(minutes)) {
            availability.push({
              eventId: e.rules.eventId,
              minutes,
              observedAt: s.observedAt,
              odds: obs.odds,
              qualifies: obs.qualifies,
              sourceAt: obs.sourceAt,
            });
            seenTargets.add(minutes);
          }
        const secondsBefore =
          (Date.parse(e.startAt) - Date.parse(s.observedAt)) / 1000;
        if (
          secondsBefore > 600 &&
          secondsBefore <= 780 &&
          !closing.some((x) => x.eventId === e.rules.eventId)
        ) {
          const clv = closingValue(
            row.odds,
            obs.probability,
            obs.referenceSourceAt,
            e.startAt,
            true,
          );
          closing.push({
            eventId: e.rules.eventId,
            observedAt: s.observedAt,
            probability: obs.probability,
            clv,
            sourceAt: obs.referenceSourceAt,
          });
          if (clv !== null) row.clv = clv;
        }
      }
      const after = new Date(
        Date.parse(at) + delaySeconds * 1000,
      ).toISOString();
      const later = [...e.snapshots]
        .filter((s) => Date.parse(s.observedAt) >= Date.parse(after))
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))[0];
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
      if (!d || new Decimal(d.offer.prices[d.selection]).lt(c.minimumOdds)) {
        delaySkipped++;
        continue;
      }
      const close = closing.find((v) => v.eventId === row.eventId);
      delayed.push({
        ...row,
        odds: d.offer.prices[d.selection],
        publishedAt: new Date(later.observedAt).toISOString(),
        clv: close
          ? (closingValue(
              d.offer.prices[d.selection],
              close.probability,
              close.sourceAt,
              e.startAt,
              true,
            ) ?? undefined)
          : undefined,
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
    validation,
    strategy: {
      version: config.version,
      configHash: hash(config),
      config,
      dispatchDelaySeconds: delaySeconds,
    },
    decisions,
    excluded,
    coverage: {
      missingWindows: missing,
      delayedSkipped: delaySkipped,
      ...validation.coverage,
    },
    availability: {
      definition:
        "First actual fresh observation within 60 seconds after each target; absent measurements stay unknown",
      observations: availability,
      targets: [5, 15, 60].map((minutes) => {
        const measured = availability.filter((v) => v.minutes === minutes);
        return {
          minutes,
          eligibleSelections: immediate.length,
          measured: measured.length,
          missing: immediate.length - measured.length,
          qualifying: measured.filter((v) => v.qualifies).length,
          rate: measured.length
            ? measured.filter((v) => v.qualifies).length / measured.length
            : null,
        };
      }),
    },
    closing: {
      definition:
        "Pre-start proxy: first fresh observation T-13 to T-10 minutes, after selection only; never used by decision engine",
      observations: closing,
      missing: immediate.length - closing.length,
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
