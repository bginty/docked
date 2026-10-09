import { hash } from "@/core/pricing";
import {
  validateReferenceStrategy,
  type ReferenceStrategy,
} from "@/core/reference-pricing";
import { MarketBaselineModel } from "@/providers/model";
import {
  toReferenceSources,
  validateReferenceDataset,
  type HistoricalReferenceEvent,
} from "./reference-dataset";
import type { Manifest } from "./replay";

/** Uses only contemporaneously available licensed features; later sporting outcomes are not model inputs. */
export function researchModelBaseline(
  events: HistoricalReferenceEvent[],
  manifest: Manifest,
  configuration: ReferenceStrategy,
  generatedAt = new Date().toISOString(),
) {
  const cfg = validateReferenceStrategy(configuration),
    validation = validateReferenceDataset(events, manifest, cfg);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const model = new MarketBaselineModel(cfg.marketReference),
    estimates: unknown[] = [],
    excluded: { eventId: string; reason: string }[] = [];
  for (const event of events)
    for (const window of cfg.windowsSeconds) {
      if (
        Date.parse(event.startAt) < Date.parse(manifest.from) ||
        Date.parse(event.startAt) >= Date.parse(manifest.to)
      )
        continue;
      const at = new Date(
        Date.parse(event.startAt) - window * 1000,
      ).toISOString();
      if (Date.parse(event.schedule.knownAt) > Date.parse(at)) {
        excluded.push({
          eventId: event.rules.eventId,
          reason: "schedule_unknown_at_decision",
        });
        continue;
      }
      const snapshot = [...event.snapshots]
        .filter((s) => Date.parse(s.observedAt) <= Date.parse(at))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
      if (
        !snapshot ||
        snapshot.eventStatus.status !== "scheduled" ||
        Date.parse(snapshot.eventStatus.knownAt) > Date.parse(at)
      ) {
        excluded.push({
          eventId: event.rules.eventId,
          reason: "scheduled_observation_unavailable",
        });
        continue;
      }
      const sources = toReferenceSources(
        snapshot,
        event.rules,
        at,
        manifest.fixture === true,
        cfg,
        manifest.referenceRegion!,
      );
      for (const selection of event.rules.outcomes)
        estimates.push(
          model.estimate({
            rules: event.rules,
            startAt: event.startAt,
            observedAt: at,
            asOfTime: at,
            generatedAt,
            codeCommit: manifest.codeCommit,
            selection,
            sources,
            evidenceMode: "research",
          }),
        );
    }
  return {
    label: manifest.fixture
      ? "FICTIONAL BASELINE TEST ONLY — NOT HISTORICAL PERFORMANCE"
      : "UNVALIDATED MARKET BASELINE RESEARCH — NOT INDEPENDENT ALPHA",
    manifest,
    validation,
    strategy: { version: cfg.version, configHash: hash(cfg) },
    model: { id: model.id, version: model.version, advantageClaim: false },
    estimates,
    excluded,
    limitations: [
      "A market-derived baseline is not an independent predictive model or evidence of profitable edge.",
      "Unavailable features produce exclusions; no closing prices, results, interpolation or future approvals enter earlier estimates.",
      "No probability uncertainty interval is asserted without an independently justified estimation procedure.",
    ],
  };
}
