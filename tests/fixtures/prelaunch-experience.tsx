// Isolated production-component fixture. No hosted accounts or persistent data.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SocialComposer } from "../../src/components/social-composer";
import {
  AdminReadPanel,
  ModerationPanel,
} from "../../src/components/community-admin";
import { FantasySheet } from "../../src/components/fantasy-player-sheet";
import type { CommunityModeration } from "../../src/core/community-social";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { SportProvider } from "../../src/components/sport-context";
const moderation: CommunityModeration = {
  status: "ready",
  message: "",
  media: [],
  reports: [
    {
      id: "isolated-report",
      targetId: "isolated-post",
      targetType: "post",
      reason: "harassment",
      details: "Synthetic report for local accessibility and retry testing.",
      status: "open",
      createdAt: "2026-10-16T00:00:00Z",
      reporter: { name: "Local reporter", handle: "local-reporter" },
      target: {
        content: "Synthetic reported commentary for review.",
        status: "review",
      },
      history: [
        {
          id: "local-decision",
          actor: "Local moderator",
          decision: "warn",
          reason: "Isolated existing review history",
          createdAt: "2026-10-16T01:00:00Z",
        },
      ],
    },
  ],
};
function Fixture() {
  const [composer, setComposer] = useState(false);
  const [endpoint, setEndpoint] = useState("/api/records?view=first");
  const admin = location.pathname.includes("admin");
  return (
    <main
      className="app-page"
      style={{ maxWidth: 1000, margin: "auto", padding: 20 }}
    >
      <p className="small-note">LOCAL ISOLATED QA · No member data</p>
      <h1>{admin ? "Community operations" : "Docked Social"}</h1>
      {admin ? (
        <>
          <button onClick={() => setEndpoint("/api/records?view=denied")}>
            Restricted view
          </button>
          <AdminReadPanel title="Operational records" endpoint={endpoint} />
          <ModerationPanel
            data={moderation}
            canWrite={!location.search.includes("readonly")}
          />
        </>
      ) : (
        <>
          <button className="button" onClick={() => setComposer(true)}>
            Create post
          </button>
          {composer && (
            <FantasySheet
              title="Create post"
              onClose={() => setComposer(false)}
            >
              <SocialComposer
                inline
                initialSport="nfl"
                onPublished={() => setComposer(false)}
                onCancel={() => setComposer(false)}
              />
            </FantasySheet>
          )}
          {Array.from({ length: 12 }, (_, i) => (
            <section className="app-panel" key={i} style={{ minHeight: 150 }}>
              <h2>Local discussion {i + 1}</h2>
              <p>Isolated scrolling fixture. No engagement statistics.</p>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(
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
        <Fixture />
      </AppShell>
    </SportProvider>
  </EnvironmentProvider>,
);
