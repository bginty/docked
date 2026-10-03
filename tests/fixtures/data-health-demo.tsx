// Isolated presentation fixture. No Auth, provider operation or database access.
import { createRoot } from "react-dom/client";
import {
  DataHealthPanel,
  type DataHealthView,
} from "../../src/components/data-health-panel";
import { trialHealthFixture } from "./provider-trial-health";
import { ScannerDataOnly } from "../../src/components/scanner-data-only";

const hash = "abcdef0123456789".repeat(4);
const base: DataHealthView = {
  oddsStatus: "NOT_CONFIGURED",
  resultsStatus: "NOT_CONFIGURED",
  database: true,
  providers: [],
  polls: [],
  candidateCount: null,
  scannerCandidateCount: null,
  incidents: [],
  trial: trialHealthFixture(),
  marketData: {
    status: "NOT_CONFIGURED",
    provider: null,
    rightsApproved: false,
    configurationVersion: null,
    lastSuccess: null,
    remaining: null,
  },
};
const diagnostics = {
  modelVersion: `DEMO-model-${hash}`,
  configurationHash: hash,
  codeCommit: hash.slice(0, 40),
  snapshotId: `DEMO-snapshot-${hash}`,
  status: "UNVALIDATED",
};
const long: DataHealthView = {
  ...base,
  trial: trialHealthFixture("measured"),
  marketData: {
    ...base.marketData,
    status: "UNAVAILABLE",
    provider: `DEMO-provider-${hash}`,
    rightsApproved: true,
    configurationVersion: `DEMO-reviewed-configuration-${hash}`,
  },
  providers: [
    {
      provider: `DEMO-provider-${hash}`,
      failure_reason: `DEMO-unavailable-reference-${hash}`,
      model_version: diagnostics.modelVersion,
      last_success: null,
      diagnostics,
    },
  ],
  polls: [
    {
      provider: `DEMO-provider-${hash}`,
      sport: `DEMO-canonical-sport-${hash}`,
      started_at: "2026-10-03T12:00:00.000Z",
      status: "DEGRADED",
      error_code: `DEMO-mapping-${hash}`,
      diagnostics,
    },
  ],
  incidents: [
    `DEMO-incident-${hash}: no genuine provider data or performance.`,
  ],
};
const root = createRoot(document.getElementById("demo-root")!);
Object.assign(window, {
  renderDataHealthFixture: (populated: boolean | "approved" | "unavailable") =>
    root.render(
      <>
        <p>ISOLATED DEMO · diagnostic layout only · no real provider records</p>
        <DataHealthPanel
          health={
            typeof populated === "string"
              ? { ...base, trial: trialHealthFixture(populated) }
              : populated
                ? long
                : base
          }
        />
        <section className="page">
          <ScannerDataOnly
            data={{
              status: populated === true ? "MARKET_DATA_READY" : "NOT_RUN",
              modelStatus: "MODEL_PROBABILITY_UNAVAILABLE",
              marketsEvaluated: populated === true ? 1 : null,
              observedAt: populated === true ? "2026-10-04T00:15:00Z" : null,
            }}
          />
        </section>
      </>,
    ),
});
