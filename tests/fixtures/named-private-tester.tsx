import { createRoot } from "react-dom/client";
import { AppAuthForm } from "../../src/components/app-auth-forms";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { namedTesterNoticeVersion } from "../../src/core/named-private-tester";
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
        <h1>Finish your Docked account</h1>
        <AppAuthForm
          mode="complete"
          customerSetup
          namedTester={{
            country: "US",
            state: "CA",
            version: namedTesterNoticeVersion,
          }}
        />
      </div>
    </section>
  </EnvironmentProvider>,
);
