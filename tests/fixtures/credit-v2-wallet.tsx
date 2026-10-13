import { createRoot } from "react-dom/client";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
Object.assign(window, { demoPath: "/fantasy/test-wallet" });
fetch("/api/test-wallet")
  .then((r) => r.json())
  .then((data) =>
    createRoot(document.getElementById("fixture-root")!).render(
      <EnvironmentProvider
        value={{
          production: true,
          liveBeta: true,
          registrationAvailable: false,
          emailAvailable: true,
          invitationAllowed: true,
          policyVersions: null,
          accountConfigured: true,
          reason: "",
        }}
      >
        <AppShell authenticated>
          <MemberTestWallet initial={data.state} />
        </AppShell>
      </EnvironmentProvider>,
    ),
  );
