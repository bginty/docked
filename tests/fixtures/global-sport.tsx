import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider, useSport } from "../../src/components/sport-context";
import { OwnedCollection } from "../../src/components/owned-collection";
import { HistoricalFixtures } from "../../src/components/historical-fixtures";
import { SocialHomeContent } from "../../src/components/social-home-content";
import { globalFeed } from "./global-sport-data";
function Content() {
  const { sport } = useSport();
  const q = new URLSearchParams(location.search);
  if (location.pathname.endsWith("/social"))
    return (
      <SocialHomeContent
        sport={sport}
        feed={{
          ...globalFeed,
          posts: globalFeed.posts.filter((p) => p.sport === sport),
        }}
        tab={q.get("tab") === "following" ? "following" : "latest"}
        view={q.get("tab") ?? undefined}
        announcements={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Isolated global announcement",
            body: "One canonical publication",
            cta: null,
            published_at: "2026-10-23T00:00:00Z",
            pinned: true,
          },
        ]}
      />
    );
  if (location.pathname.endsWith("/cards"))
    return <OwnedCollection member="local-owner" />;
  if (location.pathname.endsWith("/history")) return <HistoricalFixtures />;
  return <h1>Isolated {sport} workspace</h1>;
}
function Fixture() {
  const [path, setPath] = useState(location.pathname + location.search);
  Object.assign(window, {
    demoPath: path.split("?")[0],
    fixtureNavigate: (url: string) => {
      history.pushState(null, "", url);
      setPath(location.pathname + location.search);
      window.dispatchEvent(new Event("popstate"));
    },
  });
  return (
    <SportProvider>
      <AppShell authenticated>
        <p className="small-note">ISOLATED UI ACCEPTANCE</p>
        <Content />
      </AppShell>
    </SportProvider>
  );
}
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("a");
  if (a && a.origin === location.origin && a.pathname.startsWith("/fantasy/")) {
    e.preventDefault();
    (
      window as unknown as { fixtureNavigate: (url: string) => void }
    ).fixtureNavigate(a.href);
  }
});
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
