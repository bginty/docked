import { createRoot } from "react-dom/client";
import { SportProvider } from "../../src/components/sport-context";
import { AppShell, PersistentAppShell } from "../../src/components/app-shell";
import { StartupBoundary } from "../../src/components/startup-loading";
Object.assign(window, { demoPath: location.pathname });
createRoot(document.getElementById("fixture-root")!).render(
  <SportProvider>
    <StartupBoundary>
      <PersistentAppShell>
        <AppShell authenticated>
          <h1>NFL regression fixture</h1>
          <p>Existing NFL screen is unchanged by NBA sport switching.</p>
        </AppShell>
      </PersistentAppShell>
    </StartupBoundary>
  </SportProvider>,
);
