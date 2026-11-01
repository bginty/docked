import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { OwnedCollection } from "../../src/components/owned-collection";
import { CommercialBillingReview } from "../../src/components/commercial-billing-review";
import { CommercialMember } from "../../src/components/commercial-member";
Object.assign(window, { demoPath: location.pathname });
function Fixture() {
  const [member, setMember] = useState("");
  useEffect(() => {
    void fetch("/local-identity")
      .then((r) => r.json())
      .then((v) => setMember(v.member));
  }, []);
  return (
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
        <AppShell authenticated>
          {member &&
            (location.pathname === "/admin/commercial-billing" ? (
              <CommercialBillingReview />
            ) : location.pathname === "/fantasy/cards" ? (
              <OwnedCollection member={member} />
            ) : (
              <CommercialMember member={member} surface="wallet" />
            ))}
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
