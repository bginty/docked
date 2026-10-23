import { createRoot } from "react-dom/client";
import { OwnedCollection } from "../../src/components/owned-collection";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { NbaBetaScreen } from "../../src/components/nba-beta-screen";
Object.assign(window, { demoPath: "/fantasy/cards" });
const q = new URLSearchParams(location.search);
createRoot(document.getElementById("fixture-root")!).render(
  <SportProvider>
    <AppShell authenticated>
      <p className="small-note">ISOLATED ACCEPTANCE · sample ownership</p>
      {q.has("baseline") ? (
        <NbaBetaScreen cards sport="basketball" />
      ) : (
        <OwnedCollection member="local-owner" />
      )}
    </AppShell>
  </SportProvider>,
);
