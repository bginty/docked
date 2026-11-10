import { createRoot } from "react-dom/client";
import { PublicPhoneVerification } from "../../src/components/public-phone-verification";
import { OperationalIncidents } from "../../src/components/operational-incidents";
const report = {
  incidents: [
    {
      code: "support_delivery_drill",
      severity: "info",
      state: "OPEN",
      observed_count: 1,
      revision: 1,
      last_seen: "2026-11-10T00:00:00Z",
    },
  ],
  events: [],
  delivery: [],
  emailEnabled: false,
  recipient: "support@docked.com.au",
  custodian: "Founder only",
  channel: "Email only",
};
createRoot(document.getElementById("fixture-root")!).render(
  location.pathname.includes("incidents") ? (
    <main className="owner-command-page admin-reference">
      <OperationalIncidents initial={report} />
    </main>
  ) : (
    <section className="app-auth-surface">
      <div className="app-auth-content">
        <PublicPhoneVerification />
      </div>
    </section>
  ),
);
