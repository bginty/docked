import { createRoot } from "react-dom/client";
import { CustomerSignup } from "../../src/components/customer-signup";
import { AppAuthForm } from "../../src/components/app-auth-forms";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { FantasyRewards } from "../../src/components/fantasy-rewards";
const step = new URLSearchParams(location.search).get("step");
createRoot(document.getElementById("fixture-root")!).render(
  <EnvironmentProvider
    value={{
      production: true,
      liveBeta: true,
      emailAvailable: true,
      registrationAvailable: false,
      invitationAllowed: false,
      accountConfigured: true,
      policyVersions: { terms: "fixture", privacy: "fixture" },
      reason: null,
    }}
  >
    <section className="app-auth-surface">
      <div className="app-auth-content">
        <p>ISOLATED UI ACCEPTANCE · no real account or cards</p>
        <h1>
          {step === "complete"
            ? "Finish your Docked account"
            : step === "pack"
              ? "Your collection"
              : "Create your Docked account"}
        </h1>
        {step === "complete" ? (
          <AppAuthForm mode="complete" customerSetup />
        ) : step === "pack" ? (
          <FantasyRewards
            busy={false}
            act={(action) => Object.assign(window, { packAction: action })}
            refresh={() => {}}
            rewards={{
              starter_entitled: true,
              starter_claimed: false,
              daily_available: false,
              server_time: "",
              period_timezone: "UTC",
              next_claim_at: "",
              claimed_today: false,
              points: 0,
              history: [],
              policy: {
                version: 1,
                daily_points: 0,
                card_every: 0,
                daily_card_limit: 0,
              },
            }}
          />
        ) : (
          <CustomerSignup />
        )}
      </div>
    </section>
  </EnvironmentProvider>,
);
