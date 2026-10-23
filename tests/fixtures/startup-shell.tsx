import { createRoot } from "react-dom/client";
import { StartupBoundary } from "../../src/components/startup-loading";
import { SportProvider } from "../../src/components/sport-context";
import { AppShell, PersistentAppShell } from "../../src/components/app-shell";
Object.assign(window, { demoPath: location.pathname });
// Mirrors the authenticated fantasy layout and page nesting. Isolated UI only;
// the real server still verifies identity before rendering PersistentAppShell.
createRoot(document.getElementById("fixture-root")!).render(
  <SportProvider>
    <StartupBoundary>
      <PersistentAppShell>
        <AppShell authenticated>
          <h1>NFL regression fixture</h1>
        </AppShell>
      </PersistentAppShell>
    </StartupBoundary>
  </SportProvider>,
);
