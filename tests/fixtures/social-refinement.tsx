// Isolated UI only. These members, cards and posts never reach application storage.
import { createRoot } from "react-dom/client";
import { SocialHomeContent } from "../../src/components/social-home-content";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { globalFeed } from "./global-sport-data";

Object.assign(window, { demoPath: "/fantasy/social" });
createRoot(document.getElementById("fixture-root")!).render(
  <SportProvider>
    <AppShell authenticated>
      <SocialHomeContent
        feed={{
          ...globalFeed,
          posts: globalFeed.posts.filter((p) => p.sport !== "basketball"),
        }}
        tab="latest"
        announcements={[]}
      />
    </AppShell>
  </SportProvider>,
);
