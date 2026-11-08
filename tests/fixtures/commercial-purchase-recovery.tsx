import { createRoot } from "react-dom/client";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { SportProvider } from "../../src/components/sport-context";
import { CommercialMember } from "../../src/components/commercial-member";
Object.assign(window, { demoPath: location.pathname });
createRoot(document.getElementById("fixture-root")!).render(
  <EnvironmentProvider
    value={{
      production: false,
      registrationAvailable: false,
      emailAvailable: false,
      invitationAllowed: false,
      policyVersions: null,
      accountConfigured: false,
      commercialSurface: true,
      reason: "ISOLATED SYNTHETIC ACCEPTANCE",
    }}
  >
    <SportProvider>
      <CommercialMember
        member="10000000-0000-4000-8000-000000000001"
        sport="afl"
      />
    </SportProvider>
  </EnvironmentProvider>,
);
