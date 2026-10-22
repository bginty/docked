import { createRoot } from "react-dom/client";
import { SportReadinessPanel } from "../../src/components/sport-readiness-panel";
import { AdminShell } from "../../src/components/admin-shell";
createRoot(document.getElementById("fixture-root")!).render(
  <AdminShell role="owner" displayName="Isolated QA" active="competitions">
    <h1>Multi-sport operations</h1>
    <SportReadinessPanel />
  </AdminShell>,
);
