import type { ScannerDashboard } from "@/core/edge-scanner";
import { LocalTimestamp } from "./local-timestamp";
import { trialMetric } from "@/core/provider-trial-health";

export function ScannerDataOnly({
  data,
}: {
  data: NonNullable<ScannerDashboard["dataOnly"]>;
}) {
  return (
    <section aria-label="Data-only trial diagnostics">
      <h3>Last data-only dry run</h3>
      <p>
        {data.status} · {data.modelStatus}
      </p>
      <p>
        Markets evaluated: {trialMetric(data.marketsEvaluated)}
        {data.observedAt && (
          <>
            {" "}
            · Observed <LocalTimestamp value={data.observedAt} />
          </>
        )}
      </p>
      <p>
        Market-implied measurements do not supply an approved Docked probability
        model. This dry run creates no candidate, official Edge, paper selection
        or notification.
      </p>
      <p>Status applies to the recorded observation time, not continuous feed freshness.</p>
    </section>
  );
}
