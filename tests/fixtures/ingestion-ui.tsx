import { createRoot } from "react-dom/client";
import { AdminShell } from "../../src/components/admin-shell";
import { IngestionOperationsView } from "../../src/components/ingestion-operations";
import {
  ingestionHealth,
  ingestionJobs,
  ingestionDiagnostics,
  type IngestionHealth,
} from "../../src/core/multisport-health";
async function start() {
  const data = await fetch("/fixture-data").then((r) => r.json());
  const state = new URLSearchParams(location.search).get("state");
  const health: IngestionHealth =
    state === "disabled" || state === "unavailable"
      ? { state }
      : { state: "connected", ...ingestionHealth.parse(data.health) };
  createRoot(document.getElementById("fixture-root")!).render(
    <AdminShell role="owner" displayName="Isolated QA" active="competitions">
      <IngestionOperationsView
        health={health}
        jobs={ingestionJobs.parse({ data: data.jobs }).data}
        diagnostics={
          state === "disabled" || state === "unavailable"
            ? null
            : ingestionDiagnostics.parse(data.diagnostics)
        }
        requestId="isolated-browser"
        retry={async () => {
          document
            .querySelector('[aria-label="Statistics ingestion"]')
            ?.insertAdjacentHTML(
              "beforeend",
              '<p role="status">Isolated retry submitted</p>',
            );
        }}
      />
    </AdminShell>,
  );
}
void start();
