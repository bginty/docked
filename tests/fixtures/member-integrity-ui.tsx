// Browser-only fixtures. No route, production account or public record imports.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { SocialHomeContent } from "../../src/components/social-home-content";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import { AdminPackCoupons } from "../../src/components/admin-pack-coupons";
import type { CommunityFeed } from "../../src/core/community-social";
Object.assign(window, { demoPath: location.pathname });
function Fixture() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    void fetch("/fixture-state")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return <p>Loading isolated data</p>;
  const tab = new URLSearchParams(location.search).get("tab") ?? "latest";
  const feed = data.feed as CommunityFeed;
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
          {location.pathname.includes("coupons") ? (
            <AdminPackCoupons initial={data.admin} />
          ) : location.pathname.includes("social") ? (
            <SocialHomeContent
              feed={feed}
              announcements={data.announcements}
              tab={tab === "following" ? "following" : "latest"}
              view={tab}
              sport="nfl"
            />
          ) : (
            <MemberTestWallet initial={data.state} surface="packs" />
          )}
        </AppShell>
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
