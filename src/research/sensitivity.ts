import Decimal from "decimal.js";
import { replay, type HistoricalEvent, type Manifest } from "./replay";
import { hash, strategyV1, type Strategy } from "@/core/pricing";
export function sensitivity(
  events: HistoricalEvent[],
  manifest: Manifest,
  config: Strategy = strategyV1,
) {
  if (!["development", "validation"].includes(manifest.split))
    throw new Error(
      "Sensitivity requires development/validation; never tune a held-out split",
    );
  const base = replay(events, manifest, config);
  const thresholds = ["0.02", "0.03", "0.05"].map((minEV) => {
    const cfg = { ...config, minEV };
    const r = replay(events, { ...manifest, configHash: hash(cfg) }, cfg);
    return {
      minEV,
      configHash: hash(cfg),
      immediate: r.immediate,
      delayed: r.delayed,
    };
  });
  const delays = [300, 600, 900].map((seconds) => {
    const r = replay(events, manifest, config, seconds);
    return {
      minimumSeconds: seconds,
      maximumSeconds: config.maxDelayedSeconds,
      metrics: r.delayed,
      missing: r.coverage.delayedSkipped,
    };
  });
  const missingReferences = [
    ...new Set(
      events.flatMap((e) =>
        e.snapshots.flatMap((s) => s.quotes.map((q) => q.operator)),
      ),
    ),
  ]
    .sort()
    .map((operator) => {
      const reduced = events.map((e) => ({
        ...e,
        snapshots: e.snapshots.map((s) => ({
          ...s,
          quotes: s.quotes.filter((q) => q.operator !== operator),
        })),
      }));
      const derivedHash = hash(reduced);
      const r = replay(
        reduced,
        {
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
        },
        config,
      );
      return {
        removedOperator: operator,
        lineage: {
          sourceDatasetHash: manifest.dataHash,
          sourceManifestHash: hash(manifest),
          derivedDatasetHash: derivedHash,
          transformation: "remove_named_operator_without_substitution",
          rawFiles: manifest.datasetHashes?.rawFiles ?? [],
        },
        metrics: r.immediate,
        coverage: r.coverage,
      };
    });
  const priceAndFeeStress = [
    { oddsReduction: "0.02", feePerSettledStake: "0" },
    { oddsReduction: "0.05", feePerSettledStake: "0.01" },
  ].map((v) => {
    const rows = base.rows.immediate.filter(
      (r) => r.result === "won" || r.result === "lost",
    );
    const net = rows.reduce(
      (n, r) =>
        n
          .plus(
            r.result === "won"
              ? Decimal.max(
                  "1.01",
                  new Decimal(r.odds).minus(v.oddsReduction),
                ).minus(1)
              : -1,
          )
          .minus(v.feePerSettledStake),
      new Decimal(0),
    );
    return {
      ...v,
      settled: rows.length,
      netUnits: rows.length ? net.toFixed(2) : null,
      roi: rows.length ? net.div(rows.length).mul(100).toFixed(2) : null,
    };
  });
  return {
    label:
      "DEVELOPMENT/VALIDATION SENSITIVITY — hypothetical stresses, no optimisation or new approval",
    manifest,
    thresholds,
    delays,
    missingReferences,
    priceAndFeeStress,
    limitations: [
      "Fees are hypothetical fixed costs, not an exchange adapter.",
      "Worse-price stress retains original selections to expose fragility.",
      "Every variant is reported, including negative and empty outcomes.",
      "No bonus, account access or executable stake assumptions.",
    ],
  };
}
