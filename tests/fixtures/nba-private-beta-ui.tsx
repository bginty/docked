import { createRoot } from "react-dom/client";
import { SportProvider } from "../../src/components/sport-context";
import { AppShell } from "../../src/components/app-shell";
Object.assign(window, { demoPath: location.pathname });
createRoot(document.getElementById("fixture-root")!).render(
  <SportProvider>
    <AppShell authenticated>
      <h1>NFL regression fixture</h1>
      <p>Existing NFL screen is unchanged by NBA sport switching.</p>
    </AppShell>
  </SportProvider>,
);
