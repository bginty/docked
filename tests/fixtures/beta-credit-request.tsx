import { createRoot } from "react-dom/client";
import { AdminShell } from "../../src/components/admin-shell";
import { BetaCreditRequestPanel } from "../../src/components/beta-credit-request-panel";
createRoot(document.getElementById("fixture-root")!).render(
  <AdminShell role="owner" displayName="Isolated QA" active="rewards">
    <section className="admin-workspace owner-command-page">
      <h1>Rewards & Credits</h1>
      <BetaCreditRequestPanel />
    </section>
  </AdminShell>,
);
