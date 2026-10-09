import Decimal from "decimal.js";
import { hash } from "@/core/pricing";
import {
  evaluateReference,
  validateReferenceStrategy,
  type ReferenceStrategy,
  type ReferenceEdgeStatus,
} from "@/core/reference-pricing";
import { observeReferencePublication } from "@/core/reference-observations";
import { closingValue, ledger, type LedgerRow } from "@/core/ledger";
import { settle } from "@/core/settlement";
import { dayBootstrap, type Manifest } from "./replay";
import {
  toReferenceSources,
  validateReferenceDataset,
  type HistoricalReferenceEvent,
} from "./reference-dataset";

export function replayReference(
  events: HistoricalReferenceEvent[],
  manifest: Manifest,
  configuration: ReferenceStrategy,
  delaySeconds = 300,
) {
  const config = validateReferenceStrategy(configuration),
    validation = validateReferenceDataset(events, manifest, config);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  if (
    !Number.isInteger(delaySeconds) ||
    delaySeconds < 0 ||
    delaySeconds > config.maxDelayedSeconds
  )
    throw new Error("Bounded reference dispatch delay required");
  if (
    delaySeconds !== 300 &&
    !["development", "validation"].includes(manifest.split)
  )
    throw new Error(
      "Reference delay sensitivity prohibited on held-out/subsequent splits",
    );
  const immediate: LedgerRow[] = [],
    delayed: LedgerRow[] = [],
    decisions: unknown[] = [],
    excluded: string[] = [];
  const availability: {
    eventId: string;
    minutes: number;
    observedAt: string;
    odds: string;
    qualifies: boolean;
    priceMeetsMinimum: boolean;
    sourceAt: string;
    status: ReferenceEdgeStatus;
    referenceHash: string;
  }[] = [];
  const closing: {
    eventId: string;
    observedAt: string;
    probability: string;
    clv: string | null;
    sourceAt: string;
    referencePrice: string;
    referenceHash: string;
  }[] = [];
  let missing = 0,
    delaySkipped = 0,
    calibrationCount = 0,
    brier = 0,
    logLoss = 0;
  for (const event of [...events].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  )) {
    if (
      Date.parse(event.startAt) < Date.parse(manifest.from) ||
      Date.parse(event.startAt) >= Date.parse(manifest.to)
    ) {
      excluded.push(`${event.rules.eventId}:outside_split`);
      continue;
    }
    let published = false;
    for (const seconds of config.windowsSeconds) {
      const at = new Date(
        Date.parse(event.startAt) - seconds * 1000,
      ).toISOString();
      if (Date.parse(event.schedule.knownAt) > Date.parse(at)) {
        missing++;
        decisions.push({
          eventId: event.rules.eventId,
          at,
          reason: "schedule_not_yet_known",
        });
        continue;
      }
      const snapshot = [...event.snapshots]
        .filter((s) => Date.parse(s.observedAt) <= Date.parse(at))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
      if (!snapshot) {
        missing++;
        decisions.push({
          eventId: event.rules.eventId,
          at,
          reason: "missing_asof_snapshot",
        });
        continue;
      }
      if (snapshot.eventStatus.status !== "scheduled") {
        decisions.push({
          eventId: event.rules.eventId,
          at,
          reason: "event_not_scheduled",
          eventStatus: snapshot.eventStatus,
        });
        continue;
      }
      const evaluation = evaluateReference(
        {
          rules: event.rules,
          startAt: event.startAt,
          decisionAt: at,
          sources: toReferenceSources(
            snapshot,
            event.rules,
            at,
            manifest.fixture === true,
            config,
            manifest.referenceRegion!,
          ),
          evidenceMode: "research",
        },
        config,
      );
      // Outcome data is consulted only after the common decision engine has returned.
      if (event.result?.authorised && event.result.status === "final")
        for (const point of evaluation.universe) {
          const outcome = settle(event.rules, point.selection, event.result);
          if (!["won", "lost"].includes(outcome) || !point.reference.pricing)
            continue;
          const p = Number(point.reference.pricing.probability),
            y = outcome === "won" ? 1 : 0;
          brier += (p - y) ** 2;
          logLoss -=
            y * Math.log(Math.max(1e-12, p)) +
            (1 - y) * Math.log(Math.max(1e-12, 1 - p));
          calibrationCount++;
        }
      decisions.push({
        eventId: event.rules.eventId,
        at,
        ...evaluation,
        alreadySelected: published,
      });
      const candidate = evaluation.candidates[0];
      if (published || !candidate) continue;
      published = true;
      const row: LedgerRow = {
        id: hash({ event: event.rules.eventId, at, model: config.version }),
        eventId: event.rules.eventId,
        publishedAt: at,
        settledAt: event.result?.observedAt,
        odds: candidate.reference.decimalPrice,
        stake: "1",
        evidence: manifest.evidence,
        result: event.result
          ? settle(event.rules, candidate.selection, event.result)
          : "pending",
        sport: event.rules.competition,
        strategy: config.version,
        ev: candidate.ev,
      };
      immediate.push(row);
      const observations = [...event.snapshots]
        .filter((s) => Date.parse(s.observedAt) > Date.parse(at))
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
      const seen = new Set<number>();
      let previous: ReferenceEdgeStatus = "ACTIVE",
        delayedConsidered = false;
      for (const observation of observations) {
        const observed = observeReferencePublication(
          {
            rules: event.rules,
            startAt: event.startAt,
            observedAt: observation.observedAt,
            selection: candidate.selection,
            sources:
              observation.eventStatus.status === "scheduled"
                ? toReferenceSources(
                    observation,
                    event.rules,
                    observation.observedAt,
                    manifest.fixture === true,
                    config,
                    manifest.referenceRegion!,
                  )
                : [],
            evidenceMode: "research",
            publishedAt: at,
            publicationMarketReference: row.odds,
            publicationProbability: candidate.probability,
            minimumEdgePrice: candidate.minimumOdds,
            previousStatus: previous,
            resolutionSeconds: manifest.sourceResolutionSeconds ?? 300,
          },
          config.marketReference,
        );
        if (!observed) continue;
        previous = observed.status;
        const reference = observed.reference;
        if (reference) {
          for (const minutes of observed.targets)
            if (!seen.has(minutes)) {
              availability.push({
                eventId: event.rules.eventId,
                minutes,
                observedAt: observation.observedAt,
                odds: reference.decimalPrice,
                qualifies: observed.qualifies,
                priceMeetsMinimum: new Decimal(reference.decimalPrice).gte(
                  candidate.minimumOdds,
                ),
                sourceAt: reference.sourceAt,
                status: observed.status,
                referenceHash: reference.evidenceHash,
              });
              seen.add(minutes);
            }
          const before =
            (Date.parse(event.startAt) - Date.parse(observation.observedAt)) /
            1000;
          if (
            reference.pricing &&
            before > 600 &&
            before <= 780 &&
            !closing.some((c) => c.eventId === event.rules.eventId)
          ) {
            const clv = closingValue(
              row.odds,
              reference.pricing.probability,
              reference.sourceAt,
              event.startAt,
              true,
            );
            closing.push({
              eventId: event.rules.eventId,
              observedAt: observation.observedAt,
              probability: reference.pricing.probability,
              clv,
              sourceAt: reference.sourceAt,
              referencePrice: reference.decimalPrice,
              referenceHash: reference.evidenceHash,
            });
            if (clv !== null) row.clv = clv;
          }
        }
        const elapsed =
          (Date.parse(observation.observedAt) - Date.parse(at)) / 1000;
        if (!delayedConsidered && elapsed >= delaySeconds) {
          delayedConsidered = true;
          if (
            elapsed <= config.maxDelayedSeconds &&
            reference &&
            observed.qualifies &&
            new Decimal(reference.decimalPrice).gte(candidate.minimumOdds)
          )
            delayed.push({
              ...row,
              publishedAt: observation.observedAt,
              odds: reference.decimalPrice,
              ev: observed.currentEstimatedEV ?? row.ev,
              clv: undefined,
            });
          else delaySkipped++;
        }
      }
      if (!delayedConsidered) delaySkipped++;
      const delayedRow = delayed.find((r) => r.id === row.id),
        close = closing.find((c) => c.eventId === event.rules.eventId);
      if (delayedRow && close)
        delayedRow.clv =
          closingValue(
            delayedRow.odds,
            close.probability,
            close.sourceAt,
            event.startAt,
            true,
          ) ?? undefined;
    }
  }
  return {
    engine: "market_reference_v1",
    label:
      manifest.evidence === "demo"
        ? "FICTIONAL REFERENCE SOFTWARE FIXTURE — NOT HISTORICAL EVIDENCE"
        : manifest.contaminated
          ? "CONTAMINATED RETROSPECTIVE REFERENCE EVALUATION"
          : "Retrospective reference evaluation; rights and untouched-holdout provenance require independent review",
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
        "First actual reference observation within 60 seconds after target; priceMeetsMinimum and continued publication eligibility remain distinct",
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
        "Separate probability-cohort diagnostic: first fresh observation T-13m to T-10m after selection; never used for earlier decisions",
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
      declaredBaseline: null,
      definition:
        "All eligible complete pricing-reference outcome vectors; correlated observations. No independent comparison baseline has been approved.",
    },
    uncertainty: dayBootstrap(immediate, manifest.seed),
    limitations: [
      "UNVALIDATED methodology; no claim of executed stakes or attainable personal price",
      "Historical availability times require independent archived evidence; actual download times are preserved separately",
      "No interpolation across missing or stale sources",
      "Captured publication reference determines official benchmark; delayed rows are separate hypothetical execution",
      "No automatic reactivation; a recovered price does not create another selection",
      "No independent calibration baseline is declared for this hypothesis",
      "Calendar splits do not establish an untouched holdout",
    ],
  };
}

export function referenceSensitivity(
  events: HistoricalReferenceEvent[],
  manifest: Manifest,
  config: ReferenceStrategy,
) {
  if (!["development", "validation"].includes(manifest.split))
    throw new Error(
      "Reference sensitivity requires development/validation; held-out/subsequent tuning prohibited",
    );
  const baseline = replayReference(events, manifest, config);
  const variants = ["0.00", "0.02", "0.04"].map((addition, index) => {
    const minEV = new Decimal(config.minEV).plus(addition).toString();
    if (new Decimal(minEV).gt(config.maxEV))
      return { minEV, status: "UNSUPPORTED_SAFETY_BOUND" as const };
    const variant = validateReferenceStrategy({
      ...config,
      version: `${config.version.slice(0, 65)}-stress-threshold-${index}`,
      minEV,
    });
    const result = replayReference(
      events,
      { ...manifest, configHash: hash(variant) },
      variant,
    );
    return {
      minEV,
      status: "HYPOTHETICAL_UNAPPROVED_VARIANT" as const,
      version: variant.version,
      configHash: hash(variant),
      immediate: result.immediate,
      delayed: result.delayed,
    };
  });
  const delays = [300, 600, 900].map((seconds) =>
    seconds > config.maxDelayedSeconds
      ? { seconds, status: "OUTSIDE_FROZEN_DELAY_BOUND" as const }
      : {
          seconds,
          status: "HYPOTHETICAL_DELAY" as const,
          result: replayReference(events, manifest, config, seconds).delayed,
        },
  );
  const removedOperators = [
    ...new Set(
      events.flatMap((e) =>
        e.snapshots.flatMap((s) => s.sources.map((q) => q.ownership.operator)),
      ),
    ),
  ]
    .sort()
    .map((operator) => {
      const derived = events.map((e) => ({
        ...e,
        snapshots: e.snapshots.map((s) => ({
          ...s,
          sources: s.sources.filter((q) => q.ownership.operator !== operator),
        })),
      }));
      const derivedHash = hash(derived),
        derivedManifest = {
          ...manifest,
          dataHash: derivedHash,
          ...(manifest.datasetHashes
            ? {
                datasetHashes: {
                  ...manifest.datasetHashes,
                  canonical: derivedHash,
                },
              }
            : {}),
        };
      const result = replayReference(derived, derivedManifest, config);
      return {
        operator,
        lineage: {
          sourceDatasetHash: manifest.dataHash,
          sourceManifestHash: hash(manifest),
          derivedDatasetHash: derivedHash,
          transformation: "remove_named_operator_without_substitution",
          rawFiles: manifest.datasetHashes?.rawFiles ?? [],
        },
        immediate: result.immediate,
        coverage: result.coverage,
      };
    });
  return {
    engine: "market_reference_v1",
    label:
      "DEVELOPMENT/VALIDATION REFERENCE STRESS — every variant disclosed, no optimisation or approval",
    manifest,
    strategy: { version: config.version, configHash: hash(config) },
    baseline: baseline.immediate,
    thresholds: variants,
    delays,
    removedOperators,
    limitations: baseline.limitations,
  };
}
