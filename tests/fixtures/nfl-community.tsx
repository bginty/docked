import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { FeedTabs } from "../../src/components/community-feed";
import { EdgeBoardHeader } from "../../src/components/edge-board-header";
import { NflDirectory } from "../../src/components/nfl-directory";
import { MySportPosts } from "../../src/components/my-sport-posts";
import { SocialComposer } from "../../src/components/social-composer";

const root = createRoot(document.getElementById("fixture-root")!);
declare global {
  interface Window {
    renderNflFixture: (view: string, preview?: boolean) => void;
  }
}
window.renderNflFixture = (view, preview = false) =>
  root.render(
    <EnvironmentProvider
      value={{
        production: !preview,
        liveBeta: !preview,
        fantasyProduction: !preview,
        fantasyPreview: preview,
        accountConfigured: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        reason: "Authored UI fixture only",
      }}
    >
      <AppShell authenticated>
        <p>ISOLATED NFL UI FIXTURE · no real accounts or sporting results</p>
        <h1>NFL community</h1>
        {view === "directory" && <NflDirectory />}
        {view === "feed" && <FeedTabs base="/feed" tab="latest" sport="nfl" />}
        {view === "edges" && (
          <EdgeBoardHeader
            query={{ sport: "nfl" }}
            tab="community"
            view="upcoming"
            status={{ strategy: false, feed: false, publication: false }}
          />
        )}
        {view === "my-edge" && (
          <MySportPosts
            sport="nfl"
            feed={{
              status: "ready",
              message: "Authored empty view",
              posts: [],
              profiles: [],
              viewer: null,
              nextCursor: null,
            }}
          />
        )}
        {view === "compose" && <SocialComposer initialSport="nfl" />}
      </AppShell>
    </EnvironmentProvider>,
  );
