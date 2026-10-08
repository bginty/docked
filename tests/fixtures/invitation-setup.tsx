import { createRoot } from "react-dom/client";
import { AppAuthForm } from "../../src/components/app-auth-forms";
import { EnvironmentProvider } from "../../src/components/environment-context";
createRoot(document.getElementById("fixture-root")!).render(
  <EnvironmentProvider
    value={{
      production: true,
      accountConfigured: true,
      registrationAvailable: false,
      emailAvailable: true,
      invitationAllowed: false,
      policyVersions: {
        terms: "authored-terms-v1",
        privacy: "authored-privacy-v1",
      },
      reason: null,
    }}
  >
    <h1>Authored invited setup</h1>
    <AppAuthForm mode="complete" />
  </EnvironmentProvider>,
);
