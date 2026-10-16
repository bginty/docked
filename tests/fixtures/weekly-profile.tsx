// Isolated component harness. These accounts/cards never reach a hosted database.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { ProfileOverview } from "../../src/components/profile-overview";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import type { FantasyState } from "../../src/core/fantasy";
import type { MemberTestView } from "../../src/core/member-test-wallet";
Object.assign(window, { demoPath: location.pathname });
function Fixture() {
  const [data, setData] = useState<{
    fantasy: FantasyState;
    wallet: MemberTestView;
  } | null>(null);
  const read = () => {
    void fetch("/fixture-state")
      .then((r) => r.json())
      .then(setData);
  };
  useEffect(read, []);
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
          {data ? (
            location.pathname === "/fantasy/test-wallet" ? (
              <MemberTestWallet initial={data.wallet} surface="packs" />
            ) : (
              <ProfileOverview
                data={data.fantasy}
                account={{
                  maskedEmail: "a••••@example.test",
                  emailVerified: true,
                }}
                onRefresh={read}
              />
            )
          ) : (
            <p>Loading isolated Profile fixture…</p>
          )}
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
