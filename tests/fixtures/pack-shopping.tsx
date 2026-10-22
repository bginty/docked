import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import type { MemberTestView } from "../../src/core/member-test-wallet";
import {
  fixtureSports,
  type FixtureSport,
} from "../../src/core/fixture-sports";
Object.assign(window, { demoPath: location.pathname });
function Fixture() {
  const [state, setState] = useState<MemberTestView | null>(null);
  useEffect(() => {
    void fetch("/api/test-wallet")
      .then((r) => r.json())
      .then((r) => setState(r.state));
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
          {location.pathname === "/fantasy/profile" && (
            <div id="profile-install-slot" />
          )}
          {state ? (
            <MemberTestWallet
              initial={state}
              surface="packs"
              sport={
                Object.hasOwn(
                  fixtureSports,
                  new URLSearchParams(location.search).get("fixtureSport") ??
                    "",
                )
                  ? (new URLSearchParams(location.search).get(
                      "fixtureSport",
                    ) as FixtureSport)
                  : "nfl"
              }
            />
          ) : (
            <p>Loading isolated packs…</p>
          )}
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
