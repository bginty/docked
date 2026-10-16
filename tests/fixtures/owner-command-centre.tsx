import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { OwnerDashboard } from "../../src/components/owner-dashboard";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { SportProvider } from "../../src/components/sport-context";
import type { Operations } from "../../src/core/owner-operations";
Object.assign(window, { demoPath: "/admin/operations" });
function Fixture() {
  const [data, setData] = useState<Operations | null>(null);
  useEffect(() => {
    void fetch("/fixture-state")
      .then((r) => r.json())
      .then(setData);
  }, []);
  return (
    <EnvironmentProvider
      value={{
        production: true,
        liveBeta: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        accountConfigured: true,
        reason: "",
      }}
    >
      <SportProvider>
        <AppShell authenticated>
          <section className="scoring-review owner-command-page">
            <p className="eyebrow">ISOLATED OWNER REVIEW</p>
            <h1>Owner Command Centre</h1>
            <p className="command-muted">
              Synthetic records · No hosted data or actions
            </p>
            <form className="scoring-controls">
              <label>
                From · Sydney
                <input type="date" defaultValue="2026-10-01" />
              </label>
              <label>
                Through · Sydney
                <input type="date" defaultValue="2026-10-16" />
              </label>
              <label>
                Sport
                <select defaultValue="all">
                  <option value="all">All sports</option>
                  <option value="nfl">NFL</option>
                </select>
              </label>
              <label>
                Records
                <select>
                  <option>Beta / test</option>
                </select>
              </label>
              <button type="button" className="button">
                Apply filters
              </button>
            </form>
            <OwnerDashboard data={data} />
          </section>
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
